import { Router } from 'express';
import { z } from 'zod';
import { omiseClient } from '../lib/omiseClient.js';
import { createDemoCharge, paymentMode } from '../lib/demoPayments.js';
import { createSupabaseAdminClient } from '../lib/supabase.js';
import { verifyAndActivateDeposit, type DepositActivationDeps } from '../lib/bookingDepositCharges.js';
import { defaultWebhookDeps } from './omiseWebhook.js';

const router = Router();

// Plumbing only - this proves the server<->Omise round-trip works (real
// Omise charge, real test-mode money movement). It's behind requireAuth
// (routes/index.ts) like every other route, but not yet tied to a real
// user or booking; whatever builds on it (e.g. a deposit commission)
// should add its own check that the caller is the booking's own client.
const chargeSchema = z.object({
  token: z.string().min(1),
  // Omise amounts are in the smallest currency unit — satang for THB
  // (100 satang = 1 THB) — never a decimal baht figure.
  amountSatang: z.number().int().positive(),
  description: z.string().optional(),
});

// Review finding: this route creates a REAL Omise charge for any amount and
// any card token on behalf of any signed-in user. Nothing in the app calls it,
// and left on it lets any account use the merchant's Omise account as a
// card-testing oracle. It grants no in-app value (it writes nothing), but it is
// off unless explicitly enabled for pipe-testing.
router.post('/charge', async (req, res) => {
  if (process.env.ENABLE_TEST_CHARGE_ENDPOINT !== 'true') {
    return res.status(404).json({ message: 'Not found.' });
  }

  const parsed = chargeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request.', issues: parsed.error.issues });
  }

  const { token, amountSatang, description } = parsed.data;

  try {
    const charge = await omiseClient.charges.create({
      amount: amountSatang,
      currency: 'thb',
      card: token,
      description: description || 'CreativeHUB test charge',
      capture: true,
    });

    if (!charge.paid) {
      return res.status(402).json({
        message: charge.failure_message || 'The charge was not successful.',
        code: charge.failure_code,
        status: charge.status,
      });
    }

    return res.json({
      id: charge.id,
      status: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      paid: charge.paid,
    });
  } catch (error) {
    console.error('Omise charge failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to process the charge.';
    return res.status(500).json({ message });
  }
});

// BOOKING DEPOSITS
// Replaces DataService.payBookingDeposit's old client-side payment_status
// flip: the server now creates a real (demo or Omise) charge, verifies it
// against the booking it claims to pay for, and only then calls the one
// idempotent RPC that actually grants anything (confirm_booking_deposit_paid,
// supabase/booking_deposit_omise.sql) - same shape as Premium checkout below.
const depositCheckoutSchema = z.object({ bookingId: z.string().uuid(), token: z.string().min(1) });
const depositConfirmSchema = z.object({ chargeId: z.string().min(1) });

function depositReturnUri(bookingId: string): string | undefined {
  return process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/booking/${bookingId}#deposit-section` : undefined;
}

function depositDeps(): DepositActivationDeps {
  return {
    getDepositContext: async (bookingId) => {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from('bookings')
        .select('client_id, deposit_amount, budget, deposit_charge_id')
        .eq('id', bookingId)
        .maybeSingle();
      if (!data) return null;
      // Same fallback as src/lib/bookingEscrow.ts's LEGACY_DEPOSIT_PERCENTAGE,
      // for bookings written before deposit_amount was persisted.
      const depositThb = (data as any).deposit_amount != null ? Number((data as any).deposit_amount) : Math.round(Number((data as any).budget || 0) * 0.3);
      return {
        clientId: (data as any).client_id,
        amountSatang: Math.round(depositThb * 100),
        alreadyChargeId: (data as any).deposit_charge_id ?? null,
      };
    },
    activateDeposit: async (bookingId, chargeId, amountSatang, cardLabel) => {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.rpc('confirm_booking_deposit_paid', {
        p_booking_id: bookingId,
        p_charge_id: chargeId,
        p_amount_satang: amountSatang,
        p_card_label: cardLabel,
      });
      return { error, booking: data };
    },
    recordEvent: defaultWebhookDeps().recordEvent,
  };
}

router.post('/deposit/checkout', async (req, res) => {
  const parsed = depositCheckoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Missing booking or card details.' });

  const userId = String(res.locals.userId);
  const { bookingId, token } = parsed.data;
  const deps = depositDeps();

  try {
    const context = await deps.getDepositContext(bookingId);
    if (!context) return res.status(404).json({ message: 'Booking not found.' });
    if (context.clientId !== userId) return res.status(403).json({ message: 'This booking does not belong to this account.' });
    if (context.alreadyChargeId) return res.status(409).json({ message: 'This deposit has already been paid.' });

    const metadata = { kind: 'booking_deposit', booking_id: bookingId, user_id: userId };
    const charge =
      paymentMode() === 'demo'
        ? createDemoCharge({ amount: context.amountSatang, currency: 'thb', card: token, metadata, description: `CreativeHUB booking deposit (${bookingId})` })
        : await (omiseClient.charges as any).create({
            amount: context.amountSatang,
            currency: 'thb',
            card: token,
            capture: true,
            description: `CreativeHUB booking deposit (${bookingId})`,
            metadata,
            ...(depositReturnUri(bookingId) ? { return_uri: depositReturnUri(bookingId) } : {}),
          });

    // 3-D Secure: the buyer must authenticate with their bank first. Nothing
    // is granted here - the webhook (or /confirm when they return) does that
    // once Omise reports the charge as paid.
    if (charge.authorize_uri && charge.status === 'pending') {
      return res.json({ status: 'pending', chargeId: charge.id, authorizeUri: charge.authorize_uri });
    }

    const result = await verifyAndActivateDeposit(deps, charge, { eventKey: 'checkout', expectedUserId: userId });
    if (result.status === 'activated' || result.status === 'already_active') {
      return res.json({ status: 'paid', chargeId: charge.id, booking: result.booking ?? null });
    }
    if (result.status === 'error') {
      console.error('Deposit activation failed after a paid charge:', charge.id, result.reason);
      return res.status(500).json({ message: 'Payment received but could not be recorded. Contact support with reference ' + charge.id });
    }
    return res.status(402).json({ message: charge.failure_message || 'Your card was declined.' });
  } catch (error) {
    console.error('Deposit checkout failed:', error);
    return res.status(500).json({ message: 'Unable to process the payment right now.' });
  }
});

// Called after the card issuer's 3-D Secure step (or to retry activation).
// Trusts nothing from the caller except the charge id: the charge is
// re-fetched from Omise and must be paid, ours, and for this caller's own
// booking at exactly that booking's deposit amount - the same rules the
// webhook applies.
router.post('/deposit/confirm', async (req, res) => {
  const parsed = depositConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Missing charge reference.' });

  const userId = String(res.locals.userId);
  const deps = depositDeps();

  try {
    const charge = paymentMode() === 'demo' ? undefined : await (omiseClient.charges as any).retrieve(parsed.data.chargeId);
    const result = await verifyAndActivateDeposit(deps, charge, { eventKey: 'confirm', expectedUserId: userId });

    if (result.status === 'activated' || result.status === 'already_active') {
      return res.json({ status: 'paid', chargeId: parsed.data.chargeId, booking: result.booking ?? null });
    }
    if (result.status === 'error') {
      console.error('Deposit activation failed on confirm:', parsed.data.chargeId, result.reason);
      return res.status(500).json({ message: 'Unable to confirm the deposit. Contact support with reference ' + parsed.data.chargeId });
    }
    if (result.status === 'rejected') {
      const belongsToOther = result.reason?.includes('different user');
      return res.status(belongsToOther ? 403 : 400).json({ message: belongsToOther ? 'That payment does not belong to this account.' : 'That payment does not match this booking.' });
    }
    return res.status(402).json({ message: charge?.status === 'pending' ? 'The payment is still being processed.' : 'The payment was not completed.' });
  } catch (error) {
    console.error('Deposit confirm failed:', error);
    return res.status(500).json({ message: 'Unable to confirm the payment right now.' });
  }
});

export default router;
