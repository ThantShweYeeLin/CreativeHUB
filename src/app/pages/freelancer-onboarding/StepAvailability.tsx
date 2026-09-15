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
                  ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                  : 'border-sky-100 text-gray-600 hover:border-sky-300'
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
                  ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                  : 'border-sky-100 text-gray-600 hover:border-sky-300'
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
              className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">To</label>
            <input
              type="time"
              value={workingHoursEnd}
              onChange={(event) => onWorkingHoursEndChange(event.target.value)}
              className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
