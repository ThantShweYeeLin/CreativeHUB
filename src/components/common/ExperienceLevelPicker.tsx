import { SKILL_EXPERIENCE_LEVELS } from '../../lib/skillsTaxonomy';

interface ExperienceLevelPickerProps {
  value: string | null;
  onChange: (level: string) => void;
  label?: string;
}

/** Small pill picker for a single skill's experience level — shared between the major-skill selector and each minor skill row. */
export function ExperienceLevelPicker({ value, onChange, label }: ExperienceLevelPickerProps) {
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-semibold text-gray-500">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {SKILL_EXPERIENCE_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
              value === level ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}
