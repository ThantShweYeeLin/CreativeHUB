import { EXPERIENCE_LEVEL_OPTIONS, EXPERIENCE_YEAR_OPTIONS } from './types';

interface StepExperienceProps {
  experienceYears: string;
  onExperienceYearsChange: (value: string) => void;
  experienceLevel: string;
  onExperienceLevelChange: (value: string) => void;
}

export function StepExperience({
  experienceYears,
  onExperienceYearsChange,
  experienceLevel,
  onExperienceLevelChange,
}: StepExperienceProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Years of Experience</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {EXPERIENCE_YEAR_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onExperienceYearsChange(option)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                experienceYears === option
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Experience Level</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onExperienceLevelChange(option)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                experienceLevel === option
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
