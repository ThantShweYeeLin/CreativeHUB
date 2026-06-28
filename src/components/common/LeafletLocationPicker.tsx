import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { LatLngExpression, divIcon } from 'leaflet';
import { geocodeAddress, reverseGeocode } from '../../lib/osmGeocoding';

interface LocationPoint {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
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

export function LeafletLocationPicker({ initialPoint, onCancel, onConfirm }: LeafletLocationPickerProps) {
  const [searchText, setSearchText] = useState(initialPoint?.formattedAddress || '');
  const [selectedLat, setSelectedLat] = useState<number | null>(initialPoint?.latitude ?? null);
  const [selectedLng, setSelectedLng] = useState<number | null>(initialPoint?.longitude ?? null);
  const [resolvedAddress, setResolvedAddress] = useState(initialPoint?.formattedAddress || '');
  const [resolvedPlaceId, setResolvedPlaceId] = useState<string | null>(initialPoint?.placeId || null);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const center: LatLngExpression =
    selectedLat !== null && selectedLng !== null
      ? [selectedLat, selectedLng]
      : [13.7563, 100.5018];

  const applyPoint = async (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setErrorMessage(null);
    setIsResolving(true);

    try {
      const reversed = await reverseGeocode(lat, lng);
      const nextAddress = reversed?.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setResolvedAddress(nextAddress);
      setSearchText(nextAddress);
      setResolvedPlaceId(reversed?.placeId || null);
    } catch {
      setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setResolvedPlaceId(null);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setErrorMessage('Enter an address before searching.');
      return;
    }

    setErrorMessage(null);
    setIsResolving(true);

    try {
      const result = await geocodeAddress(query);
      if (!result) {
        setErrorMessage('Address not found. Try a more specific location.');
        return;
      }

      setSelectedLat(result.latitude);
      setSelectedLng(result.longitude);
      setResolvedAddress(result.formattedAddress);
      setResolvedPlaceId(result.placeId);
      setSearchText(result.formattedAddress);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to resolve address.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSave = () => {
    if (selectedLat === null || selectedLng === null) {
      setErrorMessage('Click a point on the map (or search an address) before saving.');
      return;
    }

    onConfirm({
      latitude: selectedLat,
      longitude: selectedLng,
      formattedAddress: resolvedAddress || `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`,
      placeId: resolvedPlaceId,
    });
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900">Pick Exact Location</h3>
          <p className="text-sm text-gray-600">Search or click directly on the map to place your location pin.</p>
        </div>

        <div className="space-y-3 border-b border-gray-200 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Street address, district, city"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isResolving}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {isResolving ? 'Resolving...' : 'Find Address'}
            </button>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          {selectedLat !== null && selectedLng !== null && (
            <p className="text-xs text-gray-600">
              Selected: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
            </p>
          )}
        </div>

        <div className="h-[420px] w-full">
          <MapContainer center={center} zoom={13} className="h-full w-full" key={`${center}`}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickCapture onPick={applyPoint} />

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
