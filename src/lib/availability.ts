// Shared by the client-facing booking request form (grey out taken times,
// block submission on a conflict) and could be reused anywhere else that
// needs to answer "is this freelancer free at this date/time."

// 'annulled' (a lapsed 24h deposit deadline) releases the slot exactly like
// an intentional cancellation does — see supabase/booking_overlap_protection.sql.
const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'rejected', 'annulled']);

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

// Real interval-overlap check (not just "is the start point taken") — used
// once a request has an actual end time, not just a single point. This is
// a client-side pre-check for instant form feedback only; the database's
// bookings_no_overlap exclusion constraint (see
// supabase/booking_overlap_protection.sql) is the real, race-safe
// enforcement, since two clients could submit at nearly the same instant.
export function isRangeAvailable(
  bookings: Array<any>,
  blockedDates: Array<{ blocked_date: string }>,
  date: string,
  startTime: string,
  endTime: string
) {
  if (isDateBlocked(blockedDates, date)) return false;

  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);

  return !bookings.some((booking) => {
    if (!booking.start_date || booking.start_date.slice(0, 10) !== date) return false;
    if (!booking.start_time) return false;
    if (INACTIVE_BOOKING_STATUSES.has(booking.status)) return false;

    const existingStart = toMinutes(booking.start_time);
    const existingEnd = booking.end_time ? toMinutes(booking.end_time) : existingStart + DEFAULT_BOOKING_DURATION_MINUTES;

    return newStart < existingEnd && existingStart < newEnd;
  });
}

// Whole-day check for flows (like the Event Matcher) that only collect a
// date, not a specific time — any active booking that day is treated as a
// full-day commitment rather than checking for a free slot around it.
export function hasActiveBookingOnDate(bookings: Array<any>, date: string) {
  return bookings.some((booking) => {
    if (!booking.start_date || booking.start_date.slice(0, 10) !== date) return false;
    return !INACTIVE_BOOKING_STATUSES.has(booking.status);
  });
}

export function isFreelancerFreeOnDate(
  bookings: Array<any>,
  blockedDates: Array<{ blocked_date: string }>,
  date: string
) {
  return !isDateBlocked(blockedDates, date) && !hasActiveBookingOnDate(bookings, date);
}
