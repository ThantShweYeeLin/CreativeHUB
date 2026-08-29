import { useMemo, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface CalendarViewProps {
  bookings: any[];
  blockedDates: any[];
  onBlockDate: (date: string, reason: string) => void | Promise<void>;
  onUnblockDate: (blockedDateId: string) => void | Promise<void>;
  isSavingBlockedDate?: boolean;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CalendarView({ bookings, blockedDates, onBlockDate, onUnblockDate, isSavingBlockedDate }: CalendarViewProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [blockReasonDraft, setBlockReasonDraft] = useState('');

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const booking of bookings) {
      if (!booking.start_date) continue;
      const key = booking.start_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(booking);
    }
    return map;
  }, [bookings]);

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
    // Monday-first grid: JS getDay() is 0=Sunday, shift so Monday=0.
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

  const handleSelectDate = (key: string) => {
    setSelectedDateKey(key);
    setBlockReasonDraft('');
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Calendar</h2>
          <p className="text-sm text-gray-600 md:text-base">See who booked which date, and block off dates you're not available</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-gray-900">{monthLabel}</span>
          <button
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-lg md:p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 md:text-sm">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell.date || !cell.key) {
              return <div key={`blank-${index}`} className="min-h-20 rounded-lg md:min-h-28" />;
            }

            const dayBookings = bookingsByDate.get(cell.key) || [];
            const blocked = blockedByDate.get(cell.key);
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedDateKey;

            return (
              <button
                key={cell.key}
                onClick={() => handleSelectDate(cell.key as string)}
                className={`min-h-20 rounded-lg border p-1.5 text-left align-top text-xs transition-colors md:min-h-28 md:p-2 ${
                  isSelected
                    ? 'border-gray-900 bg-gray-50'
                    : blocked
                    ? 'border-red-200 bg-red-50 hover:border-red-300'
                    : dayBookings.length > 0
                    ? 'border-green-200 bg-green-50 hover:border-green-300'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className={`mb-1 font-semibold ${isToday ? 'text-black underline' : 'text-gray-700'}`}>
                  {cell.date.getDate()}
                </div>
                {blocked && (
                  <div className="mb-1 flex items-center gap-1 truncate rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700">
                    <Ban className="h-2.5 w-2.5 flex-shrink-0" />
                    Blocked
                  </div>
                )}
                {dayBookings.slice(0, 2).map((booking) => (
                  <div
                    key={booking.id}
                    className="mb-1 flex items-center gap-1 truncate rounded bg-green-700 px-1 py-0.5 text-[10px] font-semibold text-white"
                    title={`${booking.client?.full_name || 'Client'} — ${booking.project_name}`}
                  >
                    <User className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate">{booking.client?.full_name || 'Booked'}</span>
                  </div>
                ))}
                {dayBookings.length > 2 && (
                  <div className="text-[10px] font-semibold text-gray-500">+{dayBookings.length - 2} more</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-700" /> Booked</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Blocked</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-gray-300" /> Available</span>
        </div>
      </div>

      {selectedDateKey && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
          <h3 className="mb-3 text-lg font-bold text-gray-900">
            {new Date(selectedDateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>

          {selectedBookings.length === 0 ? (
            <p className="text-sm text-gray-500">No bookings on this date.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Booked by</p>
              {selectedBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900">{booking.client?.full_name || 'Client'}</p>
                    <p className="text-xs text-gray-600">
                      {booking.project_name}
                      {booking.start_time ? ` · ${booking.start_time.slice(0, 5)}${booking.end_time ? `–${booking.end_time.slice(0, 5)}` : ''}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold capitalize text-gray-700">
                    {booking.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-gray-100 pt-4">
            {selectedBlocked ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <Ban className="h-4 w-4 flex-shrink-0" />
                  Blocked{selectedBlocked.reason ? ` — ${selectedBlocked.reason}` : ''}
                </div>
                <button
                  onClick={() => void onUnblockDate(selectedBlocked.id)}
                  disabled={isSavingBlockedDate}
                  className="flex-shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Unblock this date
                </button>
              </div>
            ) : selectedBookings.length > 0 ? (
              <p className="text-xs text-gray-500">This date already has a booking, so it can't be marked as blocked.</p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={blockReasonDraft}
                  onChange={(event) => setBlockReasonDraft(event.target.value)}
                  placeholder="Reason (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => void onBlockDate(selectedDateKey, blockReasonDraft)}
                  disabled={isSavingBlockedDate}
                  className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {isSavingBlockedDate ? 'Blocking...' : 'Block this date'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
