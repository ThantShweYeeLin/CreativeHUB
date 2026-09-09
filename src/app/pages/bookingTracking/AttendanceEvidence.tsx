import { classifyAttendance, ATTENDANCE_CLASSIFICATION_LABEL } from '../../../lib/attendance';
import type { BookingCheckIn } from '../../../lib/bookingCheckIn';

/**
 * Neutral, platform-recorded attendance evidence for a no_show dispute.
 * Never assigns fault — classifyAttendance only produces a label; whether
 * something is disputed further still goes through the existing dispute
 * response flow. `detailed` (admin-only) additionally shows timestamps and
 * distance bucket; the participant-facing view intentionally shows only
 * whether each party's attendance was recorded.
 */
export function AttendanceEvidence({
  checkIns,
  disputeCategory,
  detailed = false,
}: {
  checkIns: BookingCheckIn[];
  disputeCategory: string | null | undefined;
  detailed?: boolean;
}) {
  if (disputeCategory !== 'no_show') return null;

  const clientCheckIn = checkIns.find((c) => c.role === 'client') || null;
  const freelancerCheckIn = checkIns.find((c) => c.role === 'freelancer') || null;
  const classification = classifyAttendance({ clientCheckIn, freelancerCheckIn, disputeCategory });

  const rowLabel = (checkIn: BookingCheckIn | null) => {
    if (!checkIn) return 'No check-in record';
    if (!detailed) return '✓ Attendance recorded';
    const time = new Date(checkIn.checked_in_at).toLocaleString();
    const parts = [`✓ Checked in ${time}`];
    if (checkIn.is_late) parts.push('(late)');
    if (checkIn.distance_bucket) parts.push(`— ${checkIn.distance_bucket.replace('_', ' ')}`);
    return parts.join(' ');
  };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Attendance Evidence</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Client</span>
          <span className={clientCheckIn ? 'font-semibold text-green-700' : 'text-gray-400'}>{rowLabel(clientCheckIn)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Freelancer</span>
          <span className={freelancerCheckIn ? 'font-semibold text-green-700' : 'text-gray-400'}>{rowLabel(freelancerCheckIn)}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">{ATTENDANCE_CLASSIFICATION_LABEL[classification]}</p>
    </div>
  );
}
