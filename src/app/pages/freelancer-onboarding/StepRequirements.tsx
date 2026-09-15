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
          className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                  ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                  : 'border-sky-100 text-gray-600 hover:border-sky-300'
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
          className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </div>
    </div>
  );
}
