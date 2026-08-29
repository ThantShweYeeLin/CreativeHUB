import { MapPin, MapPinned } from 'lucide-react';
import { LocationChipList } from '../../../components/common/LocationChipList';

interface StoredLocation {
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  city: string | null;
  district: string | null;
}

interface StepServiceLocationsProps {
  location: string;
  onLocationChange: (value: string) => void;
  hasPreciseLocation: boolean;
  onOpenBaseLocationPicker: () => void;
  studioName: string;
  onStudioNameChange: (value: string) => void;
  studioLocations: StoredLocation[];
  onOpenStudioLocationPicker: () => void;
  onRemoveStudioLocation: (address: string) => void;
  preferredLocations: StoredLocation[];
  onOpenPreferredLocationPicker: () => void;
  onRemovePreferredLocation: (address: string) => void;
  onAddPreferredPreset: () => void;
}

const TRAVEL_ANYWHERE = 'Open to travel anywhere';

export function StepServiceLocations({
  location,
  onLocationChange,
  hasPreciseLocation,
  onOpenBaseLocationPicker,
  studioName,
  onStudioNameChange,
  studioLocations,
  onOpenStudioLocationPicker,
  onRemoveStudioLocation,
  preferredLocations,
  onOpenPreferredLocationPicker,
  onRemovePreferredLocation,
  onAddPreferredPreset,
}: StepServiceLocationsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Your city / area</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder="Bangkok, Thailand"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            type="button"
            onClick={onOpenBaseLocationPicker}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border-2 border-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
          >
            <MapPinned className="h-4 w-4" /> Pin on map
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {hasPreciseLocation ? 'Exact location pinned on the map.' : 'We use this for map-based discovery — no exact address needed.'}
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Preferred service locations</label>
        <LocationChipList
          locations={preferredLocations}
          onRemove={onRemovePreferredLocation}
          onAddFromMap={onOpenPreferredLocationPicker}
          presetLabel={TRAVEL_ANYWHERE}
          onAddPreset={onAddPreferredPreset}
          presetDisabled={preferredLocations.some((loc) => loc.formattedAddress === TRAVEL_ANYWHERE)}
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Pick real places from the map (e.g. Bangkok only, or Bangkok + Chiang Mai), or mark yourself open to travel anywhere.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Studio name (if applicable)</label>
        <input
          value={studioName}
          onChange={(event) => onStudioNameChange(event.target.value)}
          placeholder="e.g. Vipa Creative Studio"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {studioName.trim() && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">Studio location</label>
          <LocationChipList locations={studioLocations} onRemove={onRemoveStudioLocation} onAddFromMap={onOpenStudioLocationPicker} />
        </div>
      )}
    </div>
  );
}
