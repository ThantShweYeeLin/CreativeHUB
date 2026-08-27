import { MapPin } from 'lucide-react';
import { SERVICE_AREA_OPTIONS, SERVICE_RADIUS_OPTIONS } from './types';

interface StepServiceAreaProps {
  location: string;
  onLocationChange: (value: string) => void;
  serviceAreaType: string;
  onServiceAreaTypeChange: (value: string) => void;
  serviceRadiusKm: string;
  onServiceRadiusKmChange: (value: string) => void;
}

export function StepServiceArea({
  location,
  onLocationChange,
  serviceAreaType,
  onServiceAreaTypeChange,
  serviceRadiusKm,
  onServiceRadiusKmChange,
}: StepServiceAreaProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Your city / area</label>
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
            placeholder="Bangkok, Thailand"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">We use this for map-based discovery — no exact address needed.</p>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Where do you provide services?</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SERVICE_AREA_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onServiceAreaTypeChange(option.value)}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all ${
                serviceAreaType === option.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Service radius</p>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {SERVICE_RADIUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onServiceRadiusKmChange(option.value)}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                serviceRadiusKm === option.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
