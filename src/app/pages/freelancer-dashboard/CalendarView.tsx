import { useMemo, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { extractScheduleMeta, formatTimeLabel } from '../../../lib/requestSchedule';

interface CalendarViewProps {
  bookings: any[];
  /** Requests still awaiting a decision (status 'pending' or 'countered') — a soft, non-exclusive hold, never blocking. */
  pendingRequests: any[];
  blockedDates: any[];
  onBlockDate: (date: string, reason: string) => void | Promise<void>;
  onUnblockDate: (blockedDateId: string) => void | Promise<void>;
  isSavingBlockedDate?: boolean;
}

type DayEntry =
  | { kind: 'confirmed'; id: string; label: string; time: string | null }
  | { kind: 'deposit_pending'; id: string; label: string; time: string | null }
  | { kind: 'pending_request'; id: string; label: string; time: string | null }
  | { kind: 'past'; id: string; label: string; status: string };

const KIND_STYLES: Record<'confirmed' | 'deposit_pending' | 'pending_request', { chip: string; cellActive: string; dot: string }> = {
  confirmed: { chip: 'bg-rose-600 text-white', cellActive: 'border-rose-300 bg-rose-50 hover:border-rose-400', dot: 'bg-rose-600' },
  deposit_pending: { chip: 'bg-orange-500 text-white', cellActive: 'border-orange-300 bg-orange-50 hover:border-orange-400', dot: 'bg-orange-500' },
  pending_request: { chip: 'bg-amber-400 text-amber-950', cellActive: 'border-amber-300 bg-amber-50 hover:border-amber-400', dot: 'bg-amber-400' },
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeRangeLabel(startTime: string | null | undefined, endTime: string | null | undefined) {
  if (!startTime) return null;
  const start = formatTimeLabel(startTime.slice(0, 5));
  return endTime ? `${start} – ${formatTimeLabel(endTime.slice(0, 5))}` : start;
}

// A counter offer may propose a different date/time than the original ask
// — same precedence src/lib/acceptRequest.ts uses when actually accepting
// one. Falls back to parsing the legacy [[SCHEDULE_META:...]] tag for
// requests created before start_date/start_time were structured columns.
function resolveRequestSchedule(request: any): { date: string | null; time: string | null; endTime: string | null } {
  if (request.status === 'countered' && request.counter_date) {
    return { date: request.counter_date, time: request.counter_time || null, endTime: null };
  }
  if (request.start_date) {
    return { date: request.start_date, time: request.start_time || null, endTime: request.end_time || null };
  }
  const meta = extractScheduleMeta(request.message, request.description);
  return { date: meta?.date || null, time: meta?.time || null, endTime: meta?.endTime || null };
}

export function CalendarView({ bookings, pendingRequests, blockedDates, onBlockDate, onUnblockDate, isSavingBlockedDate }: CalendarViewProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [blockReasonDraft, setBlockReasonDraft] = useState('');

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (key: string | null | undefined, entry: DayEntry) => {
      if (!key) return;
      const dateKey = key.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(entry);
    };

    for (const booking of bookings) {
      if (!booking.start_date) continue;
      const label = booking.client?.full_name || booking.project_name || 'Booked';
      const time = timeRangeLabel(booking.start_time, booking.end_time);
      if (booking.status === 'confirmed') {
        push(booking.start_date, { kind: 'confirmed', id: booking.id, label, time });
      } else if (booking.status === 'pending') {
        // freelancer already accepted — awaiting the client's deposit (see
        // src/lib/bookingEscrow.ts). Not the same "pending" as a not-yet-
        // accepted request below, despite the shared column value.
        push(booking.start_date, { kind: 'deposit_pending', id: booking.id, label, time });
      } else {
        push(booking.start_date, { kind: 'past', id: booking.id, label, status: booking.status });
      }
    }

    for (const request of pendingRequests) {
      const schedule = resolveRequestSchedule(request);
      if (!schedule.date) continue;
      push(schedule.date, {
        kind: 'pending_request',
        id: request.id,
        label: request.client?.full_name || request.project_name || 'Request',
        time: timeRangeLabel(schedule.time, schedule.endTime),
      });
    }

    return map;
  }, [bookings, pendingRequests]);

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
  const selectedEntries = selectedDateKey ? entriesByDate.get(selectedDateKey) || [] : [];
  const selectedBlocked = selectedDateKey ? blockedByDate.get(selectedDateKey) : null;
  const hasActiveBookingOnSelected = selectedEntries.some((entry) => entry.kind === 'confirmed' || entry.kind === 'deposit_pending');

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
            className="rounded-lg border border-sky-100 bg-white p-2 hover:bg-sky-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-gray-900">{monthLabel}</span>
          <button
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            className="rounded-lg border border-sky-100 bg-white p-2 hover:bg-sky-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-3 shadow-lg md:p-5">
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

            const dayEntries = entriesByDate.get(cell.key) || [];
            const blocked = blockedByDate.get(cell.key);
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedDateKey;

            // Cell background reflects the single highest-priority state
            // present that day — a manual block always wins (the
            // freelancer said so explicitly), then an actually-locked
            // confirmed booking, then a deposit-pending hold, then a
            // merely-requested (never exclusive) slot.
            const topEntry = dayEntries.find((e) => e.kind === 'confirmed')
              || dayEntries.find((e) => e.kind === 'deposit_pending')
              || dayEntries.find((e) => e.kind === 'pending_request');
            const cellActiveClass = blocked
              ? 'border-red-200 bg-red-50 hover:border-red-300'
              : topEntry
                ? KIND_STYLES[topEntry.kind as 'confirmed' | 'deposit_pending' | 'pending_request'].cellActive
                : 'border-sky-100 hover:border-sky-300';

            // Show up to 3 markers, most important first (confirmed, then
            // deposit-pending, then every pending request individually —
            // not just a count), with an overflow indicator beyond that.
            const sortedEntries = [
              ...dayEntries.filter((e) => e.kind === 'confirmed'),
              ...dayEntries.filter((e) => e.kind === 'deposit_pending'),
              ...dayEntries.filter((e) => e.kind === 'pending_request'),
            ];
            const visibleEntries = sortedEntries.slice(0, 3);
            const overflowCount = sortedEntries.length - visibleEntries.length;

            return (
              <button
                key={cell.key}
                onClick={() => handleSelectDate(cell.key as string)}
                className={`min-h-20 rounded-lg border p-1.5 text-left align-top text-xs transition-colors md:min-h-28 md:p-2 ${
                  isSelected ? 'border-sky-500 bg-sky-50' : cellActiveClass
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
                {visibleEntries.map((entry) => (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    className={`mb-1 flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold ${KIND_STYLES[entry.kind as 'confirmed' | 'deposit_pending' | 'pending_request'].chip}`}
                    title={entry.kind === 'pending_request' ? `${entry.label} — pending request` : entry.label}
                  >
                    <User className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate">{entry.label}</span>
                  </div>
                ))}
                {overflowCount > 0 && (
                  <div className="text-[10px] font-semibold text-gray-500">+{overflowCount} more</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Pending request</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Deposit pending</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Confirmed — unavailable</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Blocked</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-sky-200" /> Available</span>
        </div>
      </div>

      {selectedDateKey && (
        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg md:p-6">
          <h3 className="mb-3 text-lg font-bold text-gray-900">
            {new Date(selectedDateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>

          {selectedEntries.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing on this date.</p>
          ) : (
            <div className="space-y-2">
              {selectedEntries.map((entry) => {
                const isPast = entry.kind === 'past';
                const badgeClass = isPast
                  ? 'border-sky-100 bg-sky-50/50 text-gray-600'
                  : `border-transparent ${KIND_STYLES[entry.kind as 'confirmed' | 'deposit_pending' | 'pending_request'].chip}`;
                const badgeLabel = isPast
                  ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1)
                  : entry.kind === 'confirmed'
                    ? 'Confirmed — unavailable'
                    : entry.kind === 'deposit_pending'
                      ? 'Deposit pending'
                      : 'Pending request';
                return (
                  <div key={`${entry.kind}-${entry.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{entry.label}</p>
                      {entry.kind !== 'past' && entry.time && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="h-3 w-3 flex-shrink-0" /> {entry.time}
                        </p>
                      )}
                    </div>
                    <span className={`flex-shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass}`}>
                      {badgeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 border-t border-sky-100 pt-4">
            {selectedBlocked ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <Ban className="h-4 w-4 flex-shrink-0" />
                  Blocked{selectedBlocked.reason ? ` — ${selectedBlocked.reason}` : ''}
                </div>
                <button
                  onClick={() => void onUnblockDate(selectedBlocked.id)}
                  disabled={isSavingBlockedDate}
                  className="flex-shrink-0 rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                >
                  Unblock this date
                </button>
              </div>
            ) : hasActiveBookingOnSelected ? (
              <p className="text-xs text-gray-500">This date already has a confirmed or deposit-pending booking, so it can't be marked as blocked.</p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={blockReasonDraft}
                  onChange={(event) => setBlockReasonDraft(event.target.value)}
                  placeholder="Reason (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  onClick={() => void onBlockDate(selectedDateKey, blockReasonDraft)}
                  disabled={isSavingBlockedDate}
                  className="flex-shrink-0 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
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
