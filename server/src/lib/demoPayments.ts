// DEMO payment processor. No card network, no bank, no money moves.
//
// It exists so Freelancer Premium can be shown end to end (card form ->
// "processing" -> receipt -> active subscription) without a payment provider.
// It plugs into the same verify-and-activate path as real Omise charges, so
// switching to real payments later is only configuration (PAYMENT_MODE=omise).
//
// The browser never sends a card number: it sends a demo token that carries
// only the brand, last four digits, expiry and a simulated outcome (see
// src/lib/demoCard.ts). Because the outcome is client-chosen, DEMO MODE MUST
// NOT BE USED where Premium has real value - anyone can "pay". That is the
// point of a demo, and why the mode is explicit and reported to the client.
import { randomBytes } from 'node:crypto';

export type PaymentMode = 'demo' | 'omise';

export function paymentMode(env: NodeJS.ProcessEnv = process.env): PaymentMode {
  const explicit = (env.PAYMENT_MODE || '').toLowerCase();
  if (explicit === 'demo' || explicit === 'omise') return explicit;
  return (env.OMISE_SECRET_KEY || '').startsWith('skey_') ? 'omise' : 'demo';
}

export interface DemoToken {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  outcome: 'success' | 'declined' | 'insufficient_funds' | 'expired_card' | 'processing_error';
}

const OUTCOMES = new Set(['success', 'declined', 'insufficient_funds', 'expired_card', 'processing_error']);

export function decodeDemoToken(token: string): DemoToken | null {
  if (!token.startsWith('demo_tok_')) return null;
  try {
    const parsed = JSON.parse(Buffer.from(token.slice('demo_tok_'.length), 'base64url').toString('utf8'));
    if (!/^\d{4}$/.test(String(parsed.last4)) || !OUTCOMES.has(parsed.outcome)) return null;
    return {
      brand: String(parsed.brand || 'card').slice(0, 20),
      last4: String(parsed.last4),
      expMonth: Number(parsed.expMonth),
      expYear: Number(parsed.expYear),
      outcome: parsed.outcome,
    };
  } catch {
    return null;
  }
}

const FAILURES: Record<Exclude<DemoToken['outcome'], 'success'>, { code: string; message: string }> = {
  declined: { code: 'payment_rejected', message: 'Your card was declined by the issuing bank.' },
  insufficient_funds: { code: 'insufficient_fund', message: 'Your card has insufficient funds.' },
  expired_card: { code: 'expired_card', message: 'Your card has expired.' },
  processing_error: { code: 'failed_processing', message: 'The payment could not be processed. Please try again.' },
};

/** Returns an object shaped like the Omise charge fields the rest of the server reads. */
export function createDemoCharge(input: { amount: number; currency: string; card: string; metadata: Record<string, unknown>; description?: string }, now = new Date()) {
  const id = `chrg_demo_${randomBytes(9).toString('hex')}`;
  const token = decodeDemoToken(input.card);
  const base = { id, object: 'charge', livemode: false, amount: input.amount, currency: input.currency, metadata: input.metadata, description: input.description, created_at: now.toISOString() };

  if (!token) {
    return { ...base, paid: false, status: 'failed', failure_code: 'invalid_card', failure_message: 'That card could not be verified.' };
  }
  const expired = token.expYear < now.getUTCFullYear() || (token.expYear === now.getUTCFullYear() && token.expMonth < now.getUTCMonth() + 1);
  const outcome = expired ? 'expired_card' : token.outcome;
  const card = { brand: token.brand, last_digits: token.last4 };

  if (outcome !== 'success') {
    const failure = FAILURES[outcome];
    return { ...base, card, paid: false, status: 'failed', failure_code: failure.code, failure_message: failure.message };
  }
  return { ...base, card, paid: true, status: 'successful', failure_code: null, failure_message: null };
}
