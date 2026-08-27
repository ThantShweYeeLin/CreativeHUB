export interface ScheduleMeta {
  date: string;
  time: string;
}

const SCHEDULE_META_PATTERN = /\[\[SCHEDULE_META:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})\]\]/;

export function buildScheduleMetaTag(meta: ScheduleMeta) {
  return `[[SCHEDULE_META:${meta.date}:${meta.time}]]`;
}

export function appendScheduleMeta(message: string, meta: ScheduleMeta) {
  return `${message.trim()}\n\n${buildScheduleMetaTag(meta)}`;
}

export function extractScheduleMeta(...texts: Array<string | null | undefined>): ScheduleMeta | null {
  for (const text of texts) {
    const source = text || '';
    const match = source.match(SCHEDULE_META_PATTERN);
    if (match) {
      return { date: match[1], time: match[2] } satisfies ScheduleMeta;
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
  return `${dateLabel} at ${formatTimeLabel(meta.time)}`;
}
