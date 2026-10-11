import type { PaymentEvent } from './premiumCharges.js';

// Everything that decides "is this Omise charge a valid, paid booking
// deposit, and for which booking?" lives here so checkout, /confirm, and
// the webhook all apply the same rules and end in the same idempotent
// database function (confirm_booking_deposit_paid). Mirrors
// premiumCharges.ts's shape deliberately - same trust model, same callers.

export type DepositChargeVerdict =
  | { kind: 'valid'; bookingId: string; amountSatang: number; chargeId: string }
  | { kind: 'ignored'; reason: string }   // not ours / not paid (yet): nothing to do, nothing wrong
  | { kind: 'rejected'; reason: string }; // claims to be ours but doesn't add up: never activate

/** Pure check of a charge object as fetched from Omise's API (never from a client or a webhook body). */
export function verifyBookingDepositCharge(charge: any): DepositChargeVerdict {
  if (!charge || typeof charge !== 'object') return { kind: 'ignored', reason: 'charge not found' };
  if (charge.metadata?.kind !== 'booking_deposit') return { kind: 'ignored', reason: 'not a booking deposit charge' };

  const bookingId = charge.metadata?.booking_id;
  if (typeof bookingId !== 'string' || !bookingId) return { kind: 'rejected', reason: 'charge has no booking_id' };
  if (typeof charge.amount !== 'number' || charge.amount <= 0) return { kind: 'rejected', reason: 'charge has no valid amount' };
  if (String(charge.currency || '').toLowerCase() !== 'thb') return { kind: 'rejected', reason: `currency ${charge.currency} is not THB` };

  if (!(charge.paid === true && charge.status === 'successful')) {
    return { kind: 'ignored', reason: `charge is ${charge.status || 'unknown'}, not paid` };
  }
  return { kind: 'valid', bookingId, amountSatang: charge.amount, chargeId: charge.id };
}

export interface DepositContext {
  clientId: string;
  amountSatang: number;
  alreadyChargeId: string | null;
}

export interface DepositActivationDeps {
  // Fetched fresh on every call (checkout, confirm, webhook) rather than
  // trusted from an earlier step, so the amount it's checked against is
  // always the booking's current deposit_amount, not a stale snapshot.
  getDepositContext: (bookingId: string) => Promise<DepositContext | null>;
  activateDeposit: (
    bookingId: string,
    chargeId: string,
    amountSatang: number,
    cardLabel: string
  ) => Promise<{ error: { message: string } | null; booking?: any }>;
  recordEvent?: (event: PaymentEvent) => Promise<void>;
}

function cardLabelFromCharge(charge: any): string {
  const brand = charge?.card?.brand;
  const last4 = charge?.card?.last_digits;
  return brand && last4 ? `${brand} •••• ${last4}` : 'card on file';
}

/**
 * Verifies a fetched charge against the booking it claims to pay for and,
 * only if valid, activates it. Safe to call any number of times,
 * concurrently, from any entry point: the database function grants a
 * deposit at most once per charge id.
 */
export async function verifyAndActivateDeposit(
  deps: DepositActivationDeps,
  charge: any,
  ctx: { omiseEventId?: string | null; eventKey?: string | null; expectedUserId?: string; cardLabel?: string } = {}
): Promise<{
  status: 'activated' | 'already_active' | 'ignored' | 'rejected' | 'error';
  reason?: string;
  bookingId?: string;
  booking?: any;
}> {
  const verdict = verifyBookingDepositCharge(charge);
  const base = { omiseEventId: ctx.omiseEventId, eventKey: ctx.eventKey, chargeId: charge?.id ?? null };
  // Recording is for reconciliation only - a logging failure must never change
  // whether a valid payment is honoured (or a bad one refused).
  const record = async (event: PaymentEvent) => {
    try {
      await deps.recordEvent?.(event);
    } catch (error) {
      console.error('Unable to record payment event:', (error as Error).message);
    }
  };

  if (verdict.kind !== 'valid') {
    await record({ ...base, outcome: verdict.kind, reason: verdict.reason });
    return { status: verdict.kind, reason: verdict.reason };
  }

  const context = await deps.getDepositContext(verdict.bookingId);
  if (!context) {
    const reason = 'booking not found';
    await record({ ...base, outcome: 'rejected', reason });
    return { status: 'rejected', reason, bookingId: verdict.bookingId };
  }
  if (ctx.expectedUserId && context.clientId !== ctx.expectedUserId) {
    const reason = 'charge belongs to a different user';
    await record({ ...base, userId: context.clientId, outcome: 'rejected', reason });
    return { status: 'rejected', reason, bookingId: verdict.bookingId };
  }
  if (context.alreadyChargeId === verdict.chargeId) {
    await record({ ...base, userId: context.clientId, outcome: 'already_active' });
    return { status: 'already_active', bookingId: verdict.bookingId };
  }
  if (context.alreadyChargeId) {
    const reason = 'deposit already paid by a different charge';
    await record({ ...base, userId: context.clientId, outcome: 'rejected', reason });
    return { status: 'rejected', reason, bookingId: verdict.bookingId };
  }
  if (verdict.amountSatang !== context.amountSatang) {
    const reason = `amount ${verdict.amountSatang} does not match this booking's deposit ${context.amountSatang}`;
    await record({ ...base, userId: context.clientId, outcome: 'rejected', reason });
    return { status: 'rejected', reason, bookingId: verdict.bookingId };
  }

  const cardLabel = ctx.cardLabel || cardLabelFromCharge(charge);
  const { error, booking } = await deps.activateDeposit(verdict.bookingId, verdict.chargeId, verdict.amountSatang, cardLabel);
  if (error) {
    await record({ ...base, userId: context.clientId, outcome: 'error', reason: `activation failed: ${error.message}` });
    return { status: 'error', reason: error.message, bookingId: verdict.bookingId };
  }
  await record({ ...base, userId: context.clientId, outcome: 'activated' });
  return { status: 'activated', bookingId: verdict.bookingId, booking };
}
