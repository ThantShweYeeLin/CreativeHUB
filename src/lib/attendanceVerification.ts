// Kept in sync with supabase/attendance_verification.sql's confirm_attendance()/
// submit_attendance_report() — those RPCs are the actual enforcement; these
// are used client-side so the UI doesn't show controls the server will reject.
export const ATTENDANCE_WINDOW_MINUTES = 30;

export type AttendanceRole = 'client' | 'freelancer';

export interface AttendanceConfirmation {
  id: string;
  booking_id: string;
  confirmer_id: string;
  confirmer_role: AttendanceRole;
  confirmed_at: string;
  scheduled_at: string | null;
}

export type AttendanceReportStatus = 'open' | 'under_review' | 'resolved';

export type AttendanceReportDecision =
  | 'confirm_client_no_show'
  | 'confirm_freelancer_no_show'
  | 'reject_report'
  | 'mark_mutual_dispute'
  | 'resolve_without_penalty';

export interface AttendanceReport {
  id: string;
  booking_id: string;
  reporter_id: string;
  reporter_role: AttendanceRole;
  reported_user_id: string;
  reason: string;
  explanation: string | null;
  evidence_paths: string[];
  status: AttendanceReportStatus;
  admin_decision: AttendanceReportDecision | null;
  admin_decision_reason: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ReportReasonOption {
  value: string;
  label: string;
}

// The client reports on the FREELANCER's attendance.
export const CLIENT_REPORT_REASONS: ReportReasonOption[] = [
  { value: 'freelancer_no_show', label: 'Freelancer did not show up' },
  { value: 'freelancer_late', label: 'Freelancer arrived more than 30 minutes late' },
  { value: 'freelancer_wrong_location', label: 'Freelancer went to the wrong location' },
  { value: 'freelancer_cancelled_last_minute', label: 'Freelancer cancelled at the last minute' },
  { value: 'freelancer_refused_service', label: 'Freelancer refused to perform the agreed service' },
  { value: 'freelancer_identity_mismatch', label: 'Freelancer was not the person shown/booked on the platform' },
  { value: 'freelancer_off_platform_request', label: 'Freelancer requested payment or communication outside the platform' },
  { value: 'other', label: 'Other' },
];

// The freelancer reports on the CLIENT's attendance.
export const FREELANCER_REPORT_REASONS: ReportReasonOption[] = [
  { value: 'client_no_show', label: 'Client did not show up' },
  { value: 'client_late', label: 'Client arrived more than 30 minutes late' },
  { value: 'client_wrong_location', label: 'Client went to the wrong location' },
  { value: 'client_cancelled_last_minute', label: 'Client cancelled at the last minute' },
  { value: 'client_different_work_requested', label: 'Client requested work different from the original booking' },
  { value: 'client_refused_payment_conditions', label: 'Client refused the agreed payment or conditions' },
  { value: 'client_unsafe_situation', label: 'Client created an unsafe or inappropriate situation' },
  { value: 'client_off_platform_request', label: 'Client requested payment or communication outside the platform' },
  { value: 'other', label: 'Other' },
];

export function getReportReasonOptions(role: AttendanceRole): ReportReasonOption[] {
  return role === 'client' ? CLIENT_REPORT_REASONS : FREELANCER_REPORT_REASONS;
}

export function getReportReasonLabel(reason: string): string {
  return (
    [...CLIENT_REPORT_REASONS, ...FREELANCER_REPORT_REASONS].find((option) => option.value === reason)?.label || reason
  );
}

export type EvidenceField = 'location_photo' | 'screenshot' | 'explanation';

export interface EvidenceRequirement {
  required: EvidenceField[];
  optional: EvidenceField[];
  /** Never force photo/screenshot evidence for a safety-sensitive report. */
  safetyExempt?: boolean;
}

const EVIDENCE_FIELD_LABEL: Record<EvidenceField, string> = {
  location_photo: 'Photo of the agreed meeting location',
  screenshot: 'Chat / cancellation screenshot',
  explanation: 'Written explanation',
};

export { EVIDENCE_FIELD_LABEL };

const DEFAULT_EVIDENCE: EvidenceRequirement = { required: ['explanation'], optional: ['location_photo', 'screenshot'] };

export const EVIDENCE_REQUIREMENTS: Record<string, EvidenceRequirement> = {
  freelancer_no_show: { required: ['location_photo'], optional: ['screenshot', 'explanation'] },
  freelancer_late: { required: ['location_photo'], optional: ['screenshot', 'explanation'] },
  freelancer_wrong_location: { required: ['location_photo'], optional: ['screenshot'] },
  freelancer_cancelled_last_minute: { required: ['screenshot'], optional: ['explanation'] },
  freelancer_off_platform_request: { required: ['screenshot'], optional: [] },
  client_no_show: { required: ['location_photo'], optional: ['screenshot', 'explanation'] },
  client_late: { required: ['location_photo'], optional: ['screenshot', 'explanation'] },
  client_wrong_location: { required: ['location_photo'], optional: ['screenshot'] },
  client_cancelled_last_minute: { required: ['screenshot'], optional: ['explanation'] },
  client_different_work_requested: { required: ['screenshot', 'explanation'], optional: [] },
  client_off_platform_request: { required: ['screenshot'], optional: [] },
  // Never require photographic evidence for a safety report — spec explicitly
  // calls this out so a user isn't pressured to put themselves at risk to
  // document it.
  client_unsafe_situation: { required: ['explanation'], optional: ['location_photo', 'screenshot'], safetyExempt: true },
  other: { required: ['explanation'], optional: ['location_photo', 'screenshot'] },
};

export function getEvidenceRequirement(reason: string): EvidenceRequirement {
  return EVIDENCE_REQUIREMENTS[reason] || DEFAULT_EVIDENCE;
}

export function getAttendanceWindow(scheduledAt: Date | null): { opensAt: Date; closesAt: Date } | null {
  if (!scheduledAt) return null;
  return {
    opensAt: new Date(scheduledAt.getTime() - ATTENDANCE_WINDOW_MINUTES * 60 * 1000),
    closesAt: new Date(scheduledAt.getTime() + ATTENDANCE_WINDOW_MINUTES * 60 * 1000),
  };
}

export function isAttendanceWindowOpen(scheduledAt: Date | null): boolean {
  const window = getAttendanceWindow(scheduledAt);
  if (!window) return true; // No known schedule — don't block, matches this app's graceful fallback elsewhere.
  const now = Date.now();
  return now >= window.opensAt.getTime() && now <= window.closesAt.getTime();
}

export function hasAttendanceWindowClosed(scheduledAt: Date | null): boolean {
  const window = getAttendanceWindow(scheduledAt);
  if (!window) return false;
  return Date.now() > window.closesAt.getTime();
}

export type AttendanceState =
  | 'upcoming'
  | 'check_available'
  | 'waiting_client'
  | 'waiting_freelancer'
  | 'partially_verified'
  | 'verified'
  | 'disputed'
  | 'under_review'
  | 'resolved';

/**
 * Pure derivation (not a stored column), same spirit as getBookingEscrowState.
 * "No-Show Reported" collapses into 'disputed' — submitting a report moves
 * straight to Attendance Disputed per spec, so there's no separate
 * intermediate state to represent here.
 */
export function getAttendanceState(params: {
  scheduledAt: Date | null;
  clientConfirmation: AttendanceConfirmation | null | undefined;
  freelancerConfirmation: AttendanceConfirmation | null | undefined;
  report: AttendanceReport | null | undefined;
}): AttendanceState {
  const { scheduledAt, clientConfirmation, freelancerConfirmation, report } = params;

  if (report) {
    if (report.status === 'under_review') return 'under_review';
    if (report.status === 'resolved') return 'resolved';
    return 'disputed';
  }

  const bothConfirmed = Boolean(clientConfirmation) && Boolean(freelancerConfirmation);
  if (bothConfirmed) return 'verified';

  const window = getAttendanceWindow(scheduledAt);
  if (!window || Date.now() < window.opensAt.getTime()) return 'upcoming';

  const windowClosed = Date.now() > window.closesAt.getTime();
  if (windowClosed) {
    return clientConfirmation || freelancerConfirmation ? 'partially_verified' : 'partially_verified';
  }

  if (clientConfirmation && !freelancerConfirmation) return 'waiting_freelancer';
  if (!clientConfirmation && freelancerConfirmation) return 'waiting_client';
  return 'check_available';
}

export const ATTENDANCE_STATE_LABEL: Record<AttendanceState, string> = {
  upcoming: 'Upcoming',
  check_available: 'Attendance Check Available',
  waiting_client: "Waiting for Client Confirmation",
  waiting_freelancer: 'Waiting for Freelancer Confirmation',
  partially_verified: 'Partially Verified',
  verified: 'Attendance Verified',
  disputed: 'Attendance Disputed',
  under_review: 'Under Review',
  resolved: 'Resolved',
};
