import { useMemo, useState } from 'react';
import { Ban, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTimeLabel } from '../../lib/requestSchedule';

interface AvailabilityCalendarProps {
  bookings: any[];
  blockedDates: any[];
}

const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'rejected']);

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Public-facing, read-only version of the freelancer dashboard's CalendarView
// — shows clients which dates/times are already taken so they can pick a
// free slot, without exposing who booked them (that's the other client's
// private info).
export function AvailabilityCalendar({ bookings, blockedDates }: AvailabilityCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const activeBookings = useMemo(() => bookings.filter((booking) => !INACTIVE_BOOKING_STATUSES.has(booking.status)), [bookings]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const booking of activeBookings) {
      if (!booking.start_date) continue;
      const key = booking.start_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(booking);
    }
    return map;
  }, [activeBookings]);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, any>();
    for (const blocked of blockedDates) {
      map.set(blocked.blocked_date, blocked);
    }
    return map;
  }, [blockedDates]);

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const items: Array<{ date: Date | null; key: string | null }> = [];
    for (let i = 0; i < leadingBlank; i++) items.push({ date: null, key: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      items.push({ date, key: toDateKey(date) });
    }
    while (items.length % 7 !== 0) items.push({ date: null, key: null });
    return items;
  }, [monthCursor]);

  const monthLabel = monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayKey = toDateKey(new Date());
  const selectedBookings = selectedDateKey ? bookingsByDate.get(selectedDateKey) || [] : [];
  const selectedBlocked = selectedDateKey ? blockedByDate.get(selectedDateKey) : null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-900" />
          <h2 className="text-xl font-bold text-gray-900">Availability</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            className="rounded-lg border border-gray-200 bg-white p-1.5 hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8rem] text-center text-sm font-semibold text-gray-900">{monthLabel}</span>
          <button
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            className="rounded-lg border border-gray-200 bg-white p-1.5 hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className="py-1.5">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.date || !cell.key) {
            return <div key={`blank-${index}`} className="h-11 rounded-lg" />;
          }

          const dayBookings = bookingsByDate.get(cell.key) || [];
          const blocked = blockedByDate.get(cell.key);
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDateKey;

          return (
            <button
              key={cell.key}
              onClick={() => setSelectedDateKey(cell.key)}
              className={`h-11 rounded-lg border text-xs font-semibold transition-colors ${
                isSelected
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : blocked
                  ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
                  : dayBookings.length > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
                  : 'border-gray-100 text-gray-700 hover:border-gray-300'
              } ${isToday && !isSelected ? 'ring-1 ring-gray-400' : ''}`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Partially booked</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Unavailable</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-gray-300" /> Open</span>
      </div>

      {selectedDateKey && (
        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
          <p className="mb-2 font-semibold text-gray-900">
            {new Date(selectedDateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {selectedBlocked ? (
            <p className="flex items-center gap-1.5 text-red-700">
              <Ban className="h-4 w-4 flex-shrink-0" /> Not available this day.
            </p>
          ) : selectedBookings.length === 0 ? (
            <p className="text-gray-600">Fully open — no bookings yet.</p>
          ) : (
            <div>
              <p className="mb-1 text-gray-600">Already booked at:</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedBookings.map((booking) => (
                  <span key={booking.id} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {formatTimeLabel(booking.start_time?.slice(0, 5) || '00:00')}
                    {booking.end_time ? `–${formatTimeLabel(booking.end_time.slice(0, 5))}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
