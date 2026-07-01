export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const value = address.trim();
  if (!value) {
    return null;
  }

  async function tryQuery(q: string) {
    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      q,
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to contact OpenStreetMap geocoding service.');
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string; osm_id?: number }>;
    const first = results[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      latitude,
      longitude,
      formattedAddress: first.display_name,
      placeId: typeof first.osm_id === 'number' ? String(first.osm_id) : null,
    } as GeocodeResult;
  }

  // Primary try
  const primary = await tryQuery(value);
  if (primary) return primary;

  // Normalization / fallbacks
  const normalized = value.replace(/\s*,\s*/g, ', ').replace(/chiang\s?mai/ig, 'Chiang Mai');

  if (normalized !== value) {
    const tryNorm = await tryQuery(normalized);
    if (tryNorm) return tryNorm;
  }

  // If country not present, try appending Thailand for common Chiang Mai entry or general fallback
  if (!/thailand/i.test(value)) {
    const tryWithCountry = await tryQuery(`${value}, Thailand`);
    if (tryWithCountry) return tryWithCountry;
  }

  return null;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const params = new URLSearchParams({
    format: 'json',
    lat: String(latitude),
    lon: String(longitude),
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to contact OpenStreetMap reverse geocoding service.');
  }

  const result = (await response.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    osm_id?: number;
  };

  const lat = Number(result.lat ?? latitude);
  const lon = Number(result.lon ?? longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lon,
    formattedAddress: result.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    placeId: typeof result.osm_id === 'number' ? String(result.osm_id) : null,
  };
}
