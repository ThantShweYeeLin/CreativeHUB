// Kept in sync with supabase/booking_checkin.sql's checkin_to_booking() —
// the RPC is the actual enforcement; these are only used client-side so the
// UI doesn't show a "Check In" button that the server will reject.
export const CHECK_IN_OPEN_MINUTES = 30;
export const CHECK_IN_CLOSE_MINUTES = 30;
export const CHECK_IN_RADIUS_METERS = 100;

export type CheckInStatus = 'verified' | 'outside_area' | 'location_unavailable' | 'permission_denied';

export interface BookingCheckIn {
  id: string;
  booking_id: string;
  user_id: string;
  role: 'client' | 'freelancer';
  checked_in_at: string;
  check_in_status: CheckInStatus;
  location_verified: boolean;
  distance_bucket: 'within_50m' | 'within_100m' | 'beyond_100m' | null;
  is_late: boolean;
}

export function getCheckInOpensAt(scheduledAt: Date | null): Date | null {
  if (!scheduledAt) return null;
  return new Date(scheduledAt.getTime() - CHECK_IN_OPEN_MINUTES * 60 * 1000);
}

export function isCheckInWindowOpen(scheduledAt: Date | null): boolean {
  const opensAt = getCheckInOpensAt(scheduledAt);
  if (!opensAt) return true; // No known schedule — don't block, matches this codebase's graceful fallback elsewhere.
  return Date.now() >= opensAt.getTime();
}

export function formatCheckInOpensLabel(scheduledAt: Date | null): string | null {
  const opensAt = getCheckInOpensAt(scheduledAt);
  if (!opensAt) return null;
  return opensAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const CHECK_IN_STATUS_COPY: Record<CheckInStatus, { title: string; body: string }> = {
  verified: {
    title: 'Checked in successfully.',
    body: 'CreativeHUB has recorded your attendance for this booking.',
  },
  outside_area: {
    title: "We couldn't verify that you are near the booking location.",
    body: 'Your attendance was still recorded — this does not automatically affect your booking.',
  },
  location_unavailable: {
    title: 'Your device could not provide a location.',
    body: 'Your attendance was still recorded — this does not automatically affect your booking.',
  },
  permission_denied: {
    title: 'Location permission was not provided.',
    body: 'Your attendance was still recorded — this does not automatically affect your booking.',
  },
};
