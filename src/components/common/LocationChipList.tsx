interface LocationLike {
  formattedAddress: string;
}

interface LocationChipListProps {
  locations: LocationLike[];
  onRemove: (address: string) => void;
  onAddFromMap: () => void;
  presetLabel?: string;
  onAddPreset?: () => void;
  presetDisabled?: boolean;
}

/**
 * "📍 address … Remove" list + "+ Add from Map" button, shared between Edit
 * Profile and freelancer onboarding so Preferred Service Locations / Studio
 * Location use one implementation instead of two.
 */
export function LocationChipList({ locations, onRemove, onAddFromMap, presetLabel, onAddPreset, presetDisabled }: LocationChipListProps) {
  return (
    <div>
      {locations.length > 0 && (
        <ul className="mb-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {locations.map((loc) => (
            <li key={loc.formattedAddress} className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-gray-800">
                <span aria-hidden>📍</span>
                {loc.formattedAddress}
              </span>
              <button
                type="button"
                onClick={() => onRemove(loc.formattedAddress)}
                className="flex-shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddFromMap}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          + Add from Map
        </button>
        {presetLabel && onAddPreset && (
          <button
            type="button"
            onClick={onAddPreset}
            disabled={presetDisabled}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + {presetLabel}
          </button>
        )}
      </div>
    </div>
  );
}
