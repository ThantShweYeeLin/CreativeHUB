import { Moon, Sun } from 'lucide-react';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ['00', '15', '30', '45'];

interface TimeOfDayPickerProps {
  /** 24-hour "HH:MM", or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function parse(value: string) {
  if (!value) return { hour12: 9, minute: '00', isPM: false };
  const [hStr, mStr] = value.split(':');
  const hour24 = Number(hStr) || 0;
  const isPM = hour24 >= 12;
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  const minute = MINUTES.includes(mStr) ? mStr : (mStr || '00').padStart(2, '0');
  return { hour12, minute, isPM };
}

function toValue(hour12: number, minute: string, isPM: boolean) {
  const hour24 = (hour12 % 12) + (isPM ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

/**
 * A native `<input type="time">` renders AM/PM as plain, unstylable OS chrome
 * (or hides it entirely, depending on the browser/locale) - so there's no way
 * to make morning and evening hours visually distinct. This picker owns the
 * AM/PM state directly and shows it via icon (sun for AM, moon for PM) and an
 * explicit toggle, while still producing the same 24-hour "HH:MM" string
 * every other working-hours consumer already expects.
 */
export function TimeOfDayPicker({ value, onChange, className = '' }: TimeOfDayPickerProps) {
  const { hour12, minute, isPM } = parse(value);

  const set = (nextHour: number, nextMinute: string, nextIsPM: boolean) => {
    onChange(toValue(nextHour, nextMinute, nextIsPM));
  };

  return (
    <div className={`flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 ${className}`}>
      {isPM ? <Moon className="h-4 w-4 flex-shrink-0 text-gray-500" /> : <Sun className="h-4 w-4 flex-shrink-0 text-gray-500" />}
      <select
        aria-label="Hour"
        value={hour12}
        onChange={(event) => set(Number(event.target.value), minute, isPM)}
        className="bg-transparent text-sm font-semibold text-gray-900 outline-none"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-sm font-semibold text-gray-400">:</span>
      <select
        aria-label="Minute"
        value={minute}
        onChange={(event) => set(hour12, event.target.value, isPM)}
        className="bg-transparent text-sm font-semibold text-gray-900 outline-none"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <div className="ml-auto flex flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => set(hour12, minute, false)}
          className={`px-2 py-1 text-xs font-bold transition-colors ${
            !isPM ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-sky-50'
          }`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => set(hour12, minute, true)}
          className={`px-2 py-1 text-xs font-bold transition-colors ${
            isPM ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-sky-50'
          }`}
        >
          PM
        </button>
      </div>
    </div>
  );
}
