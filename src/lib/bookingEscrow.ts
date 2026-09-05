export const DEPOSIT_DEADLINE_HOURS = 24;
export const CLIENT_RESPONSE_DAYS = 7;
export const DISPUTE_RESPONSE_HOURS = 72;

export type EscrowState =
  | 'awaiting_deposit'
  | 'deposit_secured'
  | 'awaiting_client_confirmation'
  | 'disputed'
  | 'under_admin_review'
  | 'released'
  | 'refunded'
  | 'annulled';

export function getBookingEscrowState(booking: any): EscrowState {
  if (booking?.status === 'cancelled' && booking?.cancellation_reason === 'deposit_not_paid') return 'annulled';
  if (booking?.payment_status === 'refunded') return 'refunded';
  if (booking?.payment_status === 'paid') return 'released';
  if (booking?.dispute_status === 'under_admin_review') return 'under_admin_review';
  if (booking?.dispute_status === 'open') return 'disputed';
  if (booking?.payment_status === 'deposit_paid' && booking?.completed_at) return 'awaiting_client_confirmation';
  if (booking?.payment_status === 'deposit_paid') return 'deposit_secured';
  // The DB only flips status to 'cancelled' once someone opens the booking's tracking
  // page (reconcileBookingEscrow runs there) - treat a lapsed, still-unpaid deposit as
  // annulled client-side too so it doesn't linger as "pending" elsewhere in the UI.
  if (booking?.deposit_deadline && new Date(booking.deposit_deadline).getTime() < Date.now()) {
    return 'annulled';
  }
  return 'awaiting_deposit';
}

export function formatCountdown(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
