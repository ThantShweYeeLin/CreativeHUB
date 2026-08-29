// Shared by the client-facing booking request form (grey out taken times,
// block submission on a conflict) and could be reused anywhere else that
// needs to answer "is this freelancer free at this date/time."

const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'rejected']);

// Most bookings only ever get a start_time (the request form collects a
// single point in time, not a duration) — assume a reasonable default
// session length so a booked slot actually blocks the time after it too.
const DEFAULT_BOOKING_DURATION_MINUTES = 120;

function toMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function isDateBlocked(blockedDates: Array<{ blocked_date: string }>, date: string) {
  return blockedDates.some((blocked) => blocked.blocked_date === date);
}

export function isTimeSlotTaken(bookings: Array<any>, date: string, time: string) {
  const slotMinutes = toMinutes(time);

  return bookings.some((booking) => {
    if (!booking.start_date || booking.start_date.slice(0, 10) !== date) return false;
    if (!booking.start_time) return false;
    if (INACTIVE_BOOKING_STATUSES.has(booking.status)) return false;

    const startMinutes = toMinutes(booking.start_time);
    const endMinutes = booking.end_time ? toMinutes(booking.end_time) : startMinutes + DEFAULT_BOOKING_DURATION_MINUTES;

    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  });
}

export function isFreelancerFreeAt(
  bookings: Array<any>,
  blockedDates: Array<{ blocked_date: string }>,
  date: string,
  time: string
) {
  return !isDateBlocked(blockedDates, date) && !isTimeSlotTaken(bookings, date, time);
}
