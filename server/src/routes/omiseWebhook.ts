import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { omiseClient } from '../lib/omiseClient.js';
import { createSupabaseAdminClient } from '../lib/supabase.js';
import { verifyAndActivate, type ActivationDeps, type PaymentEvent } from '../lib/premiumCharges.js';

// Omise webhook signature scheme (https://docs.omise.co/api-webhooks):
//   headers  Omise-Signature            hex HMAC-SHA256, or two comma-separated
//                                       signatures while a secret is being rotated
//            Omise-Signature-Timestamp  unix timestamp
//   signed   "<timestamp>.<raw request body>" with the base64-DECODED secret
// The docs suggest rejecting stale timestamps (e.g. > 5 minutes) against replay,
// and say Omise does NOT guarantee retries - hence the reconciliation path.
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export function verifyOmiseSignature(opts: {
  rawBody: Buffer | string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  secretBase64: string;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, signatureHeader, timestampHeader, secretBase64 } = opts;
  if (!signatureHeader || !timestampHeader) return { ok: false, reason: 'missing signature headers' };

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'bad timestamp' };
  const ageSeconds = Math.abs((opts.nowMs ?? Date.now()) / 1000 - timestamp);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp outside tolerance (possible replay)' };

  const key = Buffer.from(secretBase64, 'base64');
  const signedPayload = Buffer.concat([Buffer.from(`${timestampHeader}.`, 'utf8'), Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8')]);
  const expected = createHmac('sha256', key).update(signedPayload).digest();

  const candidates = signatureHeader.split(',').map((s) => s.trim()).filter(Boolean);
  const match = candidates.some((sig) => {
    if (!/^[0-9a-fA-F]+$/.test(sig) || sig.length !== expected.length * 2) return false;
    return timingSafeEqual(Buffer.from(sig, 'hex'), expected);
  });
  return match ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

export interface WebhookDeps extends ActivationDeps {
  secretBase64: string | undefined;
  allowUnsigned?: boolean;
  retrieveCharge: (id: string) => Promise<any>;
  now?: () => number;
}

export function defaultWebhookDeps(): WebhookDeps {
  return {
    secretBase64: process.env.OMISE_WEBHOOK_SECRET,
    allowUnsigned: process.env.OMISE_WEBHOOK_ALLOW_UNSIGNED === 'true',
    retrieveCharge: (id) => (omiseClient.charges as any).retrieve(id),
    activate: async (userId, plan, chargeId, amountSatang) => {
      const { error } = await createSupabaseAdminClient().rpc('activate_freelancer_subscription', {
        p_user: userId, p_plan: plan, p_charge_id: chargeId, p_amount_satang: amountSatang,
      });
      return { error };
    },
    recordEvent: async (event: PaymentEvent) => {
      const { error } = await createSupabaseAdminClient().from('payment_events').insert({
        omise_event_id: event.omiseEventId ?? null,
        event_key: event.eventKey ?? null,
        omise_charge_id: event.chargeId ?? null,
        user_id: event.userId ?? null,
        outcome: event.outcome,
        reason: event.reason ?? null,
      });
      if (error) console.error('Unable to record payment event:', error.message);
    },
  };
}

// Mounted on the raw body (see index.ts) - the signature covers the exact bytes.
export function createOmiseWebhookHandler(overrides: Partial<WebhookDeps> = {}) {
  const deps = { ...defaultWebhookDeps(), ...overrides } as WebhookDeps;

  return async (req: Request, res: Response) => {
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

    if (deps.secretBase64) {
      const verified = verifyOmiseSignature({
        rawBody,
        signatureHeader: req.header('omise-signature'),
        timestampHeader: req.header('omise-signature-timestamp'),
        secretBase64: deps.secretBase64,
        nowMs: deps.now?.(),
      });
      if (!verified.ok) {
        console.warn('Rejected Omise webhook:', verified.reason);
        return res.status(400).json({ message: 'Invalid signature.' });
      }
    } else if (!deps.allowUnsigned) {
      // Never process unauthenticated webhooks by accident.
      console.error('OMISE_WEBHOOK_SECRET is not set - refusing webhook deliveries.');
      return res.status(503).json({ message: 'Webhook is not configured.' });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ message: 'Malformed body.' });
    }
    if (event?.object !== 'event' || typeof event.key !== 'string') {
      return res.status(400).json({ message: 'Not an Omise event.' });
    }

    // Only a completed charge can grant anything. Every other event (charge.create,
    // refunds, transfers ...) is acknowledged and ignored.
    if (event.key !== 'charge.complete') return res.status(200).json({ received: true, handled: false });

    const chargeId = event.data?.id;
    if (typeof chargeId !== 'string' || !chargeId.startsWith('chrg_')) {
      await deps.recordEvent?.({ omiseEventId: event.id, eventKey: event.key, outcome: 'rejected', reason: 'event has no charge id' });
      return res.status(200).json({ received: true, handled: false });
    }

    // The payload is only a pointer. What actually decides is the charge as
    // Omise's API reports it NOW - so a replayed, reordered or forged body can
    // never change the outcome, and a stale "successful" can't outlive a refund.
    let charge: any;
    try {
      charge = await deps.retrieveCharge(chargeId);
    } catch (error) {
      await deps.recordEvent?.({ omiseEventId: event.id, eventKey: event.key, chargeId, outcome: 'error', reason: `could not fetch charge: ${(error as Error).message}` });
      return res.status(500).json({ message: 'Unable to verify the charge right now.' });
    }

    const result = await verifyAndActivate(deps, charge, { omiseEventId: event.id, eventKey: event.key });
    // 5xx makes Omise redeliver where it can; the row in payment_events is what
    // reconciliation works from when it doesn't.
    if (result.status === 'error') return res.status(500).json({ message: 'Activation failed; recorded for reconciliation.' });
    return res.status(200).json({ received: true, handled: result.status === 'activated' });
  };
}
