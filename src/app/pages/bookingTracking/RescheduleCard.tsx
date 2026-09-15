import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { combineBangkokDateTime, formatTimeLabel, generateTimeSlots } from '../../../lib/requestSchedule';

type Role = 'client' | 'freelancer';

const START_TIME_SLOTS = generateTimeSlots('08:00', '22:00');

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatBangkokRange(startAt: string, endAt: string) {
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Bangkok', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Bangkok', hour: 'numeric', minute: '2-digit' };
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateLabel = start.toLocaleDateString(undefined, options);
  const startLabel = start.toLocaleTimeString(undefined, timeOptions);
  const endLabel = end.toLocaleTimeString(undefined, timeOptions);
  return `${dateLabel} at ${startLabel} – ${endLabel}`;
}

// Only meaningful while a booking still actually holds a slot and hasn't
// happened yet — once work is marked complete (or later), moving the time
// no longer makes sense.
export function isBookingRescheduleEligible(escrowState: string) {
  return escrowState === 'awaiting_deposit' || escrowState === 'deposit_secured';
}

export function RescheduleCard({
  booking,
  role,
  userId,
  onRefresh,
}: {
  booking: any;
  role: Role;
  userId: string;
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const otherLabel = role === 'client' ? 'freelancer' : 'client';
  const hasPendingProposal = Boolean(booking.reschedule_proposed_start_at && booking.reschedule_proposed_end_at);
  const proposedByMe = hasPendingProposal && booking.reschedule_proposed_by === userId;

  const endTimeSlots = startTime
    ? generateTimeSlots(startTime, '23:30').filter((slot) => slot > startTime)
    : [];

  const resetForm = () => {
    setShowForm(false);
    setDate('');
    setStartTime('');
    setEndTime('');
    setReason('');
    setActionError(null);
  };

  const handlePropose = async () => {
    if (!date || !startTime || !endTime) {
      setActionError('Choose a date, start time, and end time.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);

    const newStartAt = combineBangkokDateTime(date, startTime);
    const newEndAt = combineBangkokDateTime(date, endTime);
    const response = await DataService.proposeBookingReschedule(booking.id, {
      proposerId: userId,
      proposerRole: role,
      newStartAt,
      newEndAt,
      reason,
    });

    setIsSubmitting(false);
    if (response.error) {
      setActionError((response.error as any).message || 'Unable to propose a new time.');
      return;
    }
    resetForm();
    await onRefresh();
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    setActionError(null);
    const response = await DataService.acceptBookingReschedule(booking.id, userId, role);
    setIsSubmitting(false);
    if (response.error) {
      setActionError((response.error as any).message || 'Unable to accept the new time.');
      return;
    }
    await onRefresh();
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    setActionError(null);
    const response = await DataService.declineBookingReschedule(booking.id, userId, role);
    setIsSubmitting(false);
    if (response.error) {
      setActionError((response.error as any).message || 'Unable to decline.');
      return;
    }
    await onRefresh();
  };

  const handleWithdraw = async () => {
    setIsSubmitting(true);
    setActionError(null);
    const response = await DataService.withdrawBookingRescheduleProposal(booking.id, role);
    setIsSubmitting(false);
    if (response.error) {
      setActionError((response.error as any).message || 'Unable to withdraw.');
      return;
    }
    await onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 p-5 mb-6">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-gray-900" />
        <h2 className="font-bold text-gray-900">Reschedule</h2>
      </div>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

      {hasPendingProposal ? (
        proposedByMe ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              You proposed moving this to {formatBangkokRange(booking.reschedule_proposed_start_at, booking.reschedule_proposed_end_at)}.
            </p>
            <p className="mt-1 text-xs text-amber-700">Waiting for the {otherLabel} to respond.</p>
            <button
              onClick={() => void handleWithdraw()}
              disabled={isSubmitting}
              className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              Withdraw proposal
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-sky-400 bg-sky-50/50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              The {otherLabel} proposed moving this to {formatBangkokRange(booking.reschedule_proposed_start_at, booking.reschedule_proposed_end_at)}.
            </p>
            {booking.reschedule_proposed_reason && (
              <p className="mt-1 text-xs text-gray-600">"{booking.reschedule_proposed_reason}"</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void handleAccept()}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
              >
                {isSubmitting ? 'Accepting...' : 'Accept new time'}
              </button>
              <button
                onClick={() => void handleDecline()}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-sky-50 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-sky-100 disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </div>
        )
      ) : !showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-xl border border-sky-100 bg-sky-50/50 py-3 px-4 text-sm font-semibold text-gray-700 hover:bg-sky-100"
        >
          Propose a new time
        </button>
      ) : (
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Propose a new time</p>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-900">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="date"
              min={todayDateString()}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setStartTime('');
                setEndTime('');
              }}
              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
            />
            <select
              disabled={!date}
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                setEndTime('');
              }}
              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60"
            >
              <option value="" disabled>{!date ? 'Choose a date first' : 'Start time'}</option>
              {START_TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
              ))}
            </select>
            <select
              disabled={!startTime}
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60"
            >
              <option value="" disabled>{!startTime ? 'Choose a start time first' : 'End time'}</option>
              {endTimeSlots.map((slot) => (
                <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
              ))}
            </select>
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why are you proposing this change? (optional)"
            className="mt-3 w-full min-h-[60px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
          />
          <p className="mt-2 text-xs text-gray-500">
            The {otherLabel} will need to accept before this takes effect — nothing changes until then.
          </p>
          <button
            onClick={() => void handlePropose()}
            disabled={isSubmitting || !date || !startTime || !endTime}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 px-4 text-sm font-bold text-white hover:shadow-lg transition-all disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Send proposal'}
          </button>
        </div>
      )}
    </div>
  );
}
