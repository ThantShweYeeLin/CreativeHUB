import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { LatLngExpression, divIcon } from 'leaflet';
import { reverseGeocode, searchPlaces, type GeocodeResult } from '../../lib/osmGeocoding';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
  city?: string | null;
  district?: string | null;
}

interface LeafletLocationPickerProps {
  initialPoint?: LocationPoint | null;
  onCancel: () => void;
  onConfirm: (point: LocationPoint) => void;
}

const pinIcon = divIcon({
  className: '',
  html: `
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 42C18 42 32 28.6 32 18C32 10.3 25.7 4 18 4C10.3 4 4 10.3 4 18C4 28.6 18 42 18 42Z" fill="#111827" stroke="#ffffff" stroke-width="2"/>
      <circle cx="18" cy="18" r="5" fill="#22c55e"/>
    </svg>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 42],
});

function MapClickCapture({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapFlyTo({ target, zoom }: { target: LatLngExpression | null; zoom: number | null }) {
  const map = useMap();

  useEffect(() => {
    if (target && zoom !== null) {
      map.flyTo(target, zoom, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, zoom]);

  return null;
}

export function LeafletLocationPicker({ initialPoint, onCancel, onConfirm }: LeafletLocationPickerProps) {
  const [searchText, setSearchText] = useState(initialPoint?.formattedAddress || '');
  const [selectedLat, setSelectedLat] = useState<number | null>(initialPoint?.latitude ?? null);
  const [selectedLng, setSelectedLng] = useState<number | null>(initialPoint?.longitude ?? null);
  const [resolvedAddress, setResolvedAddress] = useState(initialPoint?.formattedAddress || '');
  const [resolvedPlaceId, setResolvedPlaceId] = useState<string | null>(initialPoint?.placeId || null);
  const [resolvedCity, setResolvedCity] = useState<string | null>(initialPoint?.city ?? null);
  const [resolvedDistrict, setResolvedDistrict] = useState<string | null>(initialPoint?.district ?? null);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [flyTarget, setFlyTarget] = useState<{ point: LatLngExpression; zoom: number } | null>(null);

  const center: LatLngExpression =
    selectedLat !== null && selectedLng !== null
      ? [selectedLat, selectedLng]
      : [13.7563, 100.5018];

  const applyResult = (result: GeocodeResult) => {
    setSelectedLat(result.latitude);
    setSelectedLng(result.longitude);
    setResolvedAddress(result.formattedAddress);
    setResolvedPlaceId(result.placeId);
    setResolvedCity(result.city);
    setResolvedDistrict(result.district);
    setSearchText(result.formattedAddress);
    setSearchResults([]);
    setFlyTarget({ point: [result.latitude, result.longitude], zoom: 16 });
  };

  const applyClickedPoint = async (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setErrorMessage(null);
    setSearchResults([]);
    setIsResolving(true);

    try {
      const reversed = await reverseGeocode(lat, lng);
      const nextAddress = reversed?.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setResolvedAddress(nextAddress);
      setSearchText(nextAddress);
      setResolvedPlaceId(reversed?.placeId || null);
      setResolvedCity(reversed?.city ?? null);
      setResolvedDistrict(reversed?.district ?? null);
    } catch {
      setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setResolvedPlaceId(null);
      setResolvedCity(null);
      setResolvedDistrict(null);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setErrorMessage('Enter a place, street, or neighborhood before searching.');
      return;
    }

    setErrorMessage(null);
    setIsResolving(true);
    setSearchResults([]);

    try {
      const results = await searchPlaces(query, { limit: 5 });
      if (results.length === 0) {
        setErrorMessage('No matches found. Try a more specific place, street, or district.');
        return;
      }

      if (results.length === 1) {
        applyResult(results[0]);
        return;
      }

      setSearchResults(results);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to search for that place.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSave = () => {
    if (selectedLat === null || selectedLng === null) {
      setErrorMessage('Search for a place or click a point on the map before saving.');
      return;
    }

    onConfirm({
      latitude: selectedLat,
      longitude: selectedLng,
      formattedAddress: resolvedAddress || `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`,
      placeId: resolvedPlaceId,
      city: resolvedCity,
      district: resolvedDistrict,
    });
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900">Pick a Location</h3>
          <p className="text-sm text-gray-600">
            Search a place, building, street, neighborhood, district, or city — or click directly on the map.
          </p>
        </div>

        <div className="space-y-3 border-b border-gray-200 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder='e.g. "Siam Paragon", "Thonglor", "Sukhumvit 24"'
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={isResolving}
              className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {isResolving ? 'Searching...' : 'Find Address'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <ul className="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
              {searchResults.map((result, index) => (
                <li key={`${result.placeId ?? 'result'}-${index}`}>
                  <button
                    type="button"
                    onClick={() => applyResult(result)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                  >
                    <span aria-hidden className="mt-0.5">📍</span>
                    <span className="text-gray-800">{result.formattedAddress}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          {selectedLat !== null && selectedLng !== null && (
            <p className="text-xs text-gray-600">
              Selected: {resolvedAddress || `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`}
            </p>
          )}
        </div>

        <div className="h-[420px] w-full">
          <MapContainer center={center} zoom={13} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickCapture onPick={(lat, lng) => void applyClickedPoint(lat, lng)} />
            <MapFlyTo target={flyTarget?.point ?? null} zoom={flyTarget?.zoom ?? null} />

            {selectedLat !== null && selectedLng !== null && (
              <Marker position={[selectedLat, selectedLng]} icon={pinIcon} />
            )}
          </MapContainer>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Save Location
          </button>
        </div>
      </div>
    </div>
  );
}
