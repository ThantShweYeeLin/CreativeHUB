// Geocoding is behind a small provider interface so the backing service can
// be swapped later (e.g. for one that supports live autocomplete) without
// touching any call site. Nominatim's public usage policy forbids
// client-side autocomplete-on-keystroke, so this stays explicit
// search-on-submit only — see LeafletLocationPicker's "Find Address" button.

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
  city: string | null;
  district: string | null;
}

export interface GeocodeSearchOptions {
  limit?: number;
  /** ISO 3166-1 alpha-2 country code to bias/prefer results toward, e.g. "th". */
  preferCountryCode?: string;
  language?: 'en' | 'th';
}

interface GeocodingProvider {
  search(query: string, options?: GeocodeSearchOptions): Promise<GeocodeResult[]>;
  reverse(latitude: number, longitude: number, language?: 'en' | 'th'): Promise<GeocodeResult | null>;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  city_district?: string;
  district?: string;
  county?: string;
  state?: string;
  state_district?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  osm_id?: number;
  osm_type?: string;
  address?: NominatimAddress;
}

function extractCity(address?: NominatimAddress): string | null {
  if (!address) return null;
  return address.city || address.town || address.village || address.state || null;
}

function extractDistrict(address?: NominatimAddress): string | null {
  if (!address) return null;
  return address.city_district || address.district || address.suburb || address.county || address.state_district || null;
}

function toGeocodeResult(place: NominatimPlace): GeocodeResult | null {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    formattedAddress: place.display_name,
    placeId: place.osm_type && typeof place.osm_id === 'number' ? `${place.osm_type}:${place.osm_id}` : (typeof place.osm_id === 'number' ? String(place.osm_id) : null),
    city: extractCity(place.address),
    district: extractDistrict(place.address),
  };
}

class NominatimProvider implements GeocodingProvider {
  private async fetchSearch(query: string, language: 'en' | 'th', limit: number, countryCodes?: string) {
    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
      q: query,
    });
    if (countryCodes) {
      params.set('countrycodes', countryCodes);
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': language === 'th' ? 'th' : 'en',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to contact OpenStreetMap geocoding service.');
    }

    const results = (await response.json()) as NominatimPlace[];
    return results.map(toGeocodeResult).filter((result): result is GeocodeResult => result !== null);
  }

  async search(query: string, options: GeocodeSearchOptions = {}): Promise<GeocodeResult[]> {
    const value = query.trim();
    if (!value) return [];

    const limit = options.limit ?? 5;
    const language = options.language ?? 'en';
    const preferCountryCode = options.preferCountryCode;

    // Prefer results within the given country first (e.g. "Asok" -> Bangkok,
    // not a place of the same name elsewhere), but fall back to an
    // unrestricted worldwide search if the biased query comes up empty.
    if (preferCountryCode) {
      const biased = await this.fetchSearch(value, language, limit, preferCountryCode);
      if (biased.length > 0) return biased;
    }

    const unrestricted = await this.fetchSearch(value, language, limit);
    if (unrestricted.length > 0) return unrestricted;

    // Last resort: light normalization for common Thai shorthand, then retry.
    const normalized = value
      .replace(/\s*,\s*/g, ', ')
      .replace(/chiang\s?mai/ig, 'Chiang Mai')
      .replace(/\bbkk\b/ig, 'Bangkok');

    if (normalized !== value) {
      const retried = await this.fetchSearch(normalized, language, limit, preferCountryCode);
      if (retried.length > 0) return retried;
    }

    return [];
  }

  async reverse(latitude: number, longitude: number, language: 'en' | 'th' = 'en'): Promise<GeocodeResult | null> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      lat: String(latitude),
      lon: String(longitude),
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': language === 'th' ? 'th' : 'en',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to contact OpenStreetMap reverse geocoding service.');
    }

    const result = (await response.json()) as NominatimPlace & { lat?: string; lon?: string };
    if (!result || (!result.lat && !result.lon && !result.display_name)) {
      return {
        latitude,
        longitude,
        formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        placeId: null,
        city: null,
        district: null,
      };
    }

    const parsed = toGeocodeResult({
      ...result,
      lat: result.lat ?? String(latitude),
      lon: result.lon ?? String(longitude),
    });

    return parsed || {
      latitude,
      longitude,
      formattedAddress: result.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      placeId: null,
      city: extractCity(result.address),
      district: extractDistrict(result.address),
    };
  }
}

// Swap this single instance to change geocoding provider app-wide.
const activeProvider: GeocodingProvider = new NominatimProvider();

/** Returns multiple candidate results for a search-on-submit query, biased toward Thailand. */
export async function searchPlaces(query: string, options: GeocodeSearchOptions = {}): Promise<GeocodeResult[]> {
  return activeProvider.search(query, { preferCountryCode: 'th', ...options });
}

export async function reverseGeocode(latitude: number, longitude: number, language: 'en' | 'th' = 'en'): Promise<GeocodeResult | null> {
  return activeProvider.reverse(latitude, longitude, language);
}

/** Back-compat single-result helper for callers that just want the best match. */
export async function geocodeAddress(address: string, language: 'en' | 'th' = 'en'): Promise<GeocodeResult | null> {
  const results = await searchPlaces(address, { limit: 1, language });
  return results[0] ?? null;
}
