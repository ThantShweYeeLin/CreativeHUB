import type { BookingCheckIn } from './bookingCheckIn';

export type AttendanceClassification =
  | 'normal'
  | 'potential_freelancer_no_show'
  | 'potential_client_no_show'
  | 'attendance_conflict'
  | 'insufficient_evidence';

export const ATTENDANCE_CLASSIFICATION_LABEL: Record<AttendanceClassification, string> = {
  normal: 'No attendance issue',
  potential_freelancer_no_show: 'Potential freelancer no-show',
  potential_client_no_show: 'Potential client no-show',
  attendance_conflict: 'Attendance conflict',
  insufficient_evidence: 'Insufficient attendance evidence',
};

/**
 * Pure, display-only classification of platform-recorded attendance evidence
 * for a no_show dispute — never writes anything, never assigns fault on its
 * own. Ambiguous cases (both checked in, or neither did) intentionally stay
 * unresolved rather than getting auto-blamed.
 */
export function classifyAttendance(params: {
  clientCheckIn: BookingCheckIn | null | undefined;
  freelancerCheckIn: BookingCheckIn | null | undefined;
  disputeCategory: string | null | undefined;
}): AttendanceClassification {
  const { clientCheckIn, freelancerCheckIn, disputeCategory } = params;

  if (disputeCategory !== 'no_show') return 'normal';

  const clientPresent = Boolean(clientCheckIn);
  const freelancerPresent = Boolean(freelancerCheckIn);

  if (clientPresent && freelancerPresent) return 'attendance_conflict';
  if (!clientPresent && !freelancerPresent) return 'insufficient_evidence';
  if (clientPresent && !freelancerPresent) return 'potential_freelancer_no_show';
  return 'potential_client_no_show';
}
