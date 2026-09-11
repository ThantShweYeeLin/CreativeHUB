import { Clock } from 'lucide-react';
import { getAttendanceWindow, type AttendanceConfirmation, type AttendanceReport } from '../../../lib/attendanceVerification';

interface TimelineEntry {
  time: Date;
  label: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const EVENT_LABEL: Record<string, (actor: string) => string> = {
  presence_confirmed: (actor) => `${actor === 'client' ? 'Client' : 'Freelancer'} confirmed the other party's presence`,
  attendance_report_submitted: (actor) => `${actor === 'client' ? 'Client' : 'Freelancer'} reported an attendance problem`,
  attendance_evidence_requested: () => 'CreativeHUB support requested additional evidence',
  attendance_report_resolved: () => 'CreativeHUB support resolved the attendance report',
};

export function AttendanceTimeline({
  events,
  confirmations,
  report,
  scheduledAt,
}: {
  events: any[];
  confirmations: AttendanceConfirmation[];
  report: AttendanceReport | null;
  scheduledAt: Date | null;
}) {
  const window_ = getAttendanceWindow(scheduledAt);
  const entries: TimelineEntry[] = [];

  if (window_) {
    entries.push({ time: window_.opensAt, label: 'Attendance verification opened' });
  }
  if (scheduledAt) {
    entries.push({ time: scheduledAt, label: 'Scheduled booking time' });
  }

  events
    .filter((event) => Object.prototype.hasOwnProperty.call(EVENT_LABEL, event.action))
    .forEach((event) => {
      entries.push({ time: new Date(event.created_at), label: EVENT_LABEL[event.action](event.actor) });
    });

  if (window_ && Date.now() > window_.closesAt.getTime()) {
    entries.push({ time: window_.closesAt, label: 'Attendance window closed' });
  }

  const clientConfirmation = confirmations.find((c) => c.confirmer_role === 'client');
  const freelancerConfirmation = confirmations.find((c) => c.confirmer_role === 'freelancer');
  if (clientConfirmation && freelancerConfirmation && !report) {
    const verifiedAt = new Date(
      Math.max(new Date(clientConfirmation.confirmed_at).getTime(), new Date(freelancerConfirmation.confirmed_at).getTime())
    );
    entries.push({ time: verifiedAt, label: 'Attendance verified' });
  }

  if (!entries.length) return null;

  entries.sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-gray-900" />
        <h2 className="font-bold text-gray-900">Attendance Timeline</h2>
      </div>
      <div className="space-y-3 border-l-2 border-gray-200 pl-4">
        {entries.map((entry, index) => (
          <div key={index} className="relative">
            <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
            <p className="text-xs text-gray-500">{formatTime(entry.time)}</p>
            <p className="text-sm text-gray-800">{entry.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
