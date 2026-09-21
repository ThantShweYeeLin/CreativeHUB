// Everything that decides "is this Omise charge a valid, paid Freelancer
// Premium purchase, and for whom?" lives here so checkout, the user-facing
// confirm endpoint, the webhook and the reconciliation script all apply the
// same rules and end in the same idempotent database function
// (activate_freelancer_subscription).
export const PLANS = {
  monthly: { amountSatang: 9900 },
  annual: { amountSatang: 99900 },
} as const;
export type PlanId = keyof typeof PLANS;

export type ChargeVerdict =
  | { kind: 'valid'; userId: string; plan: PlanId; amountSatang: number }
  | { kind: 'ignored'; reason: string }   // not ours / not paid (yet): nothing to do, nothing wrong
  | { kind: 'rejected'; reason: string }; // claims to be ours but doesn't add up: never activate

/** Pure check of a charge object as fetched from Omise's API (never from a client or a webhook body). */
export function verifyPremiumCharge(charge: any): ChargeVerdict {
  if (!charge || typeof charge !== 'object') return { kind: 'ignored', reason: 'charge not found' };
  if (charge.metadata?.kind !== 'freelancer_premium') return { kind: 'ignored', reason: 'not a Premium charge' };

  const plan = charge.metadata?.plan as PlanId | undefined;
  const userId = charge.metadata?.user_id;
  if (!plan || !(plan in PLANS)) return { kind: 'rejected', reason: `unknown plan "${String(plan)}"` };
  if (typeof userId !== 'string' || !userId) return { kind: 'rejected', reason: 'charge has no user_id' };
  if (charge.amount !== PLANS[plan].amountSatang) return { kind: 'rejected', reason: `amount ${charge.amount} does not match the ${plan} price ${PLANS[plan].amountSatang}` };
  if (String(charge.currency || '').toLowerCase() !== 'thb') return { kind: 'rejected', reason: `currency ${charge.currency} is not THB` };

  if (!(charge.paid === true && charge.status === 'successful')) {
    return { kind: 'ignored', reason: `charge is ${charge.status || 'unknown'}, not paid` };
  }
  return { kind: 'valid', userId, plan, amountSatang: charge.amount };
}

export interface PaymentEvent {
  omiseEventId?: string | null;
  eventKey?: string | null;
  chargeId?: string | null;
  userId?: string | null;
  outcome: 'activated' | 'already_active' | 'ignored' | 'rejected' | 'error';
  reason?: string | null;
}

export interface ActivationDeps {
  activate: (userId: string, plan: PlanId, chargeId: string, amountSatang: number) => Promise<{ error: { message: string } | null; alreadyActive?: boolean; periodEnd?: string | null }>;
  recordEvent?: (event: PaymentEvent) => Promise<void>;
}

/**
 * Verifies a fetched charge and, only if valid, activates it. Safe to call any
 * number of times, concurrently, from any entry point: the database function
 * grants a period at most once per charge id.
 */
export async function verifyAndActivate(
  deps: ActivationDeps,
  charge: any,
  ctx: { omiseEventId?: string | null; eventKey?: string | null; expectedUserId?: string } = {}
): Promise<{ status: 'activated' | 'ignored' | 'rejected' | 'error'; reason?: string; userId?: string; periodEnd?: string | null }> {
  const verdict = verifyPremiumCharge(charge);
  const base = { omiseEventId: ctx.omiseEventId, eventKey: ctx.eventKey, chargeId: charge?.id ?? null };
  // Recording is for reconciliation only - a logging failure must never change
  // whether a valid payment is honoured (or a bad one refused).
  const record = async (event: PaymentEvent) => {
    try { await deps.recordEvent?.(event); } catch (error) { console.error('Unable to record payment event:', (error as Error).message); }
  };

  if (verdict.kind !== 'valid') {
    await record({ ...base, outcome: verdict.kind, reason: verdict.reason });
    return { status: verdict.kind, reason: verdict.reason };
  }
  if (ctx.expectedUserId && verdict.userId !== ctx.expectedUserId) {
    const reason = 'charge belongs to a different user';
    await record({ ...base, userId: verdict.userId, outcome: 'rejected', reason });
    return { status: 'rejected', reason, userId: verdict.userId };
  }

  const { error, periodEnd } = await deps.activate(verdict.userId, verdict.plan, charge.id, verdict.amountSatang);
  if (error) {
    await record({ ...base, userId: verdict.userId, outcome: 'error', reason: `activation failed: ${error.message}` });
    return { status: 'error', reason: error.message, userId: verdict.userId };
  }
  await record({ ...base, userId: verdict.userId, outcome: 'activated' });
  return { status: 'activated', userId: verdict.userId, periodEnd };
}
