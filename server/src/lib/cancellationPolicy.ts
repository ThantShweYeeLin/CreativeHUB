// Single source of truth for "what does cancelling this booking right now
// pay out" - deliberately never duplicated client-side (see
// supabase/booking_cancellation_policy.sql's header for why: this session
// already fixed a bug caused by two independent copies of "is this booking
// still open" drifting apart). The client only ever displays what this
// function (via the /cancellation-quote route) already decided.

export type CancellationTier = 'full_refund' | 'partial_refund' | 'no_refund';

export type CancellationQuote =
  | { ok: true; tier: CancellationTier; refundAmount: number; compensationAmount: number; hoursUntilEvent: number }
  | { ok: false; reason: string };

const FULL_REFUND_HOURS = 7 * 24;
const PARTIAL_REFUND_HOURS = 72;

/**
 * Rejects rather than guesses on a missing/invalid event time - a booking
 * eligible for this flow (deposit_secured) should always have start_at set
 * (acceptRequest.ts sets it at acceptance, before a deposit can even be
 * paid), so hitting this is a data problem to surface, not paper over.
 */
export function quoteCancellation(startAt: string | null | undefined, depositThb: number, now = new Date()): CancellationQuote {
  if (!startAt) {
    return { ok: false, reason: 'This booking has no scheduled event time on record.' };
  }
  const startMs = new Date(startAt).getTime();
  if (!Number.isFinite(startMs)) {
    return { ok: false, reason: "This booking's event time is invalid." };
  }

  const hoursUntilEvent = (startMs - now.getTime()) / (60 * 60 * 1000);
  const tier: CancellationTier =
    hoursUntilEvent >= FULL_REFUND_HOURS ? 'full_refund' : hoursUntilEvent >= PARTIAL_REFUND_HOURS ? 'partial_refund' : 'no_refund';
  const refundAmount = tier === 'full_refund' ? depositThb : tier === 'partial_refund' ? Math.round(depositThb * 0.5) : 0;

  return { ok: true, tier, refundAmount, compensationAmount: depositThb - refundAmount, hoursUntilEvent };
}

/** Freelancer-initiated cancellation never goes through quoteCancellation - always the full-refund tier, regardless of date. */
export function forcedFreelancerCancellationQuote(depositThb: number): Extract<CancellationQuote, { ok: true }> {
  return { ok: true, tier: 'full_refund', refundAmount: depositThb, compensationAmount: 0, hoursUntilEvent: Infinity };
}
