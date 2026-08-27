import { AVAILABILITY_OPTIONS, WORKING_DAY_OPTIONS, toggle } from './types';

const AVAILABILITY_DOT: Record<string, string> = {
  Available: '🟢',
  Busy: '🟡',
  Unavailable: '🔴',
};

interface StepAvailabilityProps {
  availability: string;
  onAvailabilityChange: (value: string) => void;
  workingDays: string[];
  onWorkingDaysChange: (value: string[]) => void;
  workingHoursStart: string;
  onWorkingHoursStartChange: (value: string) => void;
  workingHoursEnd: string;
  onWorkingHoursEndChange: (value: string) => void;
}

export function StepAvailability({
  availability,
  onAvailabilityChange,
  workingDays,
  onWorkingDaysChange,
  workingHoursStart,
  onWorkingHoursStartChange,
  workingHoursEnd,
  onWorkingHoursEndChange,
}: StepAvailabilityProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Current Availability</p>
        <div className="grid grid-cols-3 gap-3">
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAvailabilityChange(option)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                availability === option
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {AVAILABILITY_DOT[option]} {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Working Days</p>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
          {WORKING_DAY_OPTIONS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => onWorkingDaysChange(toggle(workingDays, day))}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                workingDays.includes(day)
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Working Hours</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">From</label>
            <input
              type="time"
              value={workingHoursStart}
              onChange={(event) => onWorkingHoursStartChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">To</label>
            <input
              type="time"
              value={workingHoursEnd}
              onChange={(event) => onWorkingHoursEndChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
