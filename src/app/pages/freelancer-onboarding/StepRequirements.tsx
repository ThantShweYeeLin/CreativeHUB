import { LIMITATION_DAY_OPTIONS, toggle } from './types';

interface StepRequirementsProps {
  requirements: string;
  onRequirementsChange: (value: string) => void;
  limitationDays: string[];
  onLimitationDaysChange: (value: string[]) => void;
  limitationNote: string;
  onLimitationNoteChange: (value: string) => void;
}

export function StepRequirements({
  requirements,
  onRequirementsChange,
  limitationDays,
  onLimitationDaysChange,
  limitationNote,
  onLimitationNoteChange,
}: StepRequirementsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Things I require from clients</label>
        <textarea
          value={requirements}
          onChange={(event) => onRequirementsChange(event.target.value)}
          rows={3}
          placeholder="Minimum 3 days advance booking. 30% deposit required. Travel fee applies outside city limits."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">I don't work on</p>
        <div className="grid grid-cols-3 gap-3">
          {LIMITATION_DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onLimitationDaysChange(toggle(limitationDays, option))}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                limitationDays.includes(option)
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
        <label className="mb-2 block text-sm font-semibold text-gray-700">Other limitations (optional)</label>
        <input
          value={limitationNote}
          onChange={(event) => onLimitationNoteChange(event.target.value)}
          placeholder="I only accept outdoor shoots within Bangkok."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
    </div>
  );
}
