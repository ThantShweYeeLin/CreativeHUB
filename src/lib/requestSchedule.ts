export interface ScheduleMeta {
  date: string;
  time: string;
  /** Optional so old tags (created before end time existed) still parse. */
  endTime?: string;
}

// The end-time segment is optional in the pattern itself so tags written
// before end time existed (just date:time) still match.
const SCHEDULE_META_PATTERN = /\[\[SCHEDULE_META:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})(?::(\d{2}:\d{2}))?\]\]/;

export function buildScheduleMetaTag(meta: ScheduleMeta) {
  return `[[SCHEDULE_META:${meta.date}:${meta.time}${meta.endTime ? `:${meta.endTime}` : ''}]]`;
}

export function appendScheduleMeta(message: string, meta: ScheduleMeta) {
  return `${message.trim()}\n\n${buildScheduleMetaTag(meta)}`;
}

export function extractScheduleMeta(...texts: Array<string | null | undefined>): ScheduleMeta | null {
  for (const text of texts) {
    const source = text || '';
    const match = source.match(SCHEDULE_META_PATTERN);
    if (match) {
      return { date: match[1], time: match[2], endTime: match[3] || undefined } satisfies ScheduleMeta;
    }
  }

  return null;
}

export function stripScheduleMeta(text: string | null | undefined) {
  return (text || '').replace(SCHEDULE_META_PATTERN, '').trim();
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function generateTimeSlots(start: string | null | undefined, end: string | null | undefined, stepMinutes = 30) {
  const startMinutes = toMinutes(start || '09:00');
  const endMinutes = toMinutes(end || '18:00');
  const slots: string[] = [];

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  return slots;
}

export function formatTimeLabel(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatScheduleMeta(meta: ScheduleMeta) {
  const [year, month, day] = meta.date.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = meta.endTime ? `${formatTimeLabel(meta.time)} – ${formatTimeLabel(meta.endTime)}` : formatTimeLabel(meta.time);
  return `${dateLabel} at ${timeLabel}`;
}

/** Adds `minutes` to a "HH:MM" time, wrapping past midnight if needed. */
export function addMinutesToTime(value: string, minutes: number) {
  const total = (toMinutes(value) + minutes + 24 * 60) % (24 * 60);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Minutes between two "HH:MM" times on the same day (negative if `end` is before `start`). */
export function minutesBetween(start: string, end: string) {
  return toMinutes(end) - toMinutes(start);
}

// Thailand has no DST, so Asia/Bangkok is always a flat UTC+7 — treating
// the wall-clock date+time as if it were already UTC and then subtracting
// 7 hours gives the real instant, no timezone library needed. Matches the
// interpretation supabase/booking_checkin.sql already documents/relies on.
const BANGKOK_UTC_OFFSET_HOURS = 7;

/** Combines a "YYYY-MM-DD" date and "HH:MM" time, interpreted as Asia/Bangkok wall-clock, into the real UTC instant. */
export function combineBangkokDateTime(date: string, time: string): Date {
  const utcAsIfBangkok = new Date(`${date}T${time}:00Z`);
  return new Date(utcAsIfBangkok.getTime() - BANGKOK_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}
