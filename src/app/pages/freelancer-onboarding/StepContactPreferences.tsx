import { CONTACT_PREFERENCE_OPTIONS, toggle } from './types';

interface StepContactPreferencesProps {
  contactPreference: string[];
  onContactPreferenceChange: (value: string[]) => void;
}

export function StepContactPreferences({ contactPreference, onContactPreferenceChange }: StepContactPreferencesProps) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">Preferred Communication</p>
      <p className="mb-4 text-xs text-gray-500">
        We keep your personal contact details private — clients reach you through CreativeHUB.
      </p>
      <div className="space-y-3">
        {CONTACT_PREFERENCE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-sky-100 px-4 py-3 hover:border-sky-300"
          >
            <input
              type="checkbox"
              checked={contactPreference.includes(option.value)}
              onChange={() => onContactPreferenceChange(toggle(contactPreference, option.value))}
              className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-400"
            />
            <span className="text-sm font-semibold text-gray-800">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
