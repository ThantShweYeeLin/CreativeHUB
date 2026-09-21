import { Router } from 'express';
import { z } from 'zod';
import { omiseClient } from '../lib/omiseClient.js';
import { createSupabaseAdminClient, createSupabaseForRequest, getBearerToken } from '../lib/supabase.js';

// The server is the only place a subscription is ever granted: the plan's
// price comes from this table (never from the request body), the charge is
// created and verified with Omise here, and only then does the service-role
// call to activate_freelancer_subscription() (supabase/freelancer_premium.sql)
// extend the period. The browser only ever sends a one-time card token.
import { defaultWebhookDeps } from './omiseWebhook.js';
import { PLANS, verifyAndActivate, type ActivationDeps, type PaymentEvent, type PlanId } from '../lib/premiumCharges.js';
export { PLANS };
export type { PlanId };

const checkoutSchema = z.object({ plan: z.enum(['monthly', 'annual']), token: z.string().min(1) });
const confirmSchema = z.object({ chargeId: z.string().min(1) });

export interface SubscriptionDeps {
  charges: {
    create: (input: Record<string, unknown>) => Promise<any>;
    retrieve: (id: string) => Promise<any>;
  };
  // Resolves a signed-in user's id to whether they're a freelancer.
  isFreelancer: (userId: string) => Promise<boolean>;
  activate: (userId: string, plan: PlanId, chargeId: string, amountSatang: number) => Promise<{ error: { message: string } | null }>;
  cancel: (accessToken: string) => Promise<{ error: { message: string } | null }>;
  returnUri?: string;
  recordEvent?: (event: PaymentEvent) => Promise<void>;
}

function defaultDeps(): SubscriptionDeps {
  return {
    charges: {
      create: (input) => (omiseClient.charges as any).create(input),
      retrieve: (id) => (omiseClient.charges as any).retrieve(id),
    },
    isFreelancer: async (userId) => {
      const admin = createSupabaseAdminClient();
      const [{ data: user }, { data: profile }] = await Promise.all([
        admin.from('users').select('role').eq('id', userId).maybeSingle(),
        admin.from('freelancer_profiles').select('id').eq('user_id', userId).maybeSingle(),
      ]);
      return user?.role === 'freelancer' && !!profile;
    },
    activate: async (userId, plan, chargeId, amountSatang) => {
      const { error } = await createSupabaseAdminClient().rpc('activate_freelancer_subscription', {
        p_user: userId,
        p_plan: plan,
        p_charge_id: chargeId,
        p_amount_satang: amountSatang,
      });
      return { error };
    },
    cancel: async (accessToken) => {
      const { error } = await createSupabaseForRequest(accessToken).rpc('cancel_my_subscription');
      return { error };
    },
    recordEvent: defaultWebhookDeps().recordEvent,
  };
}

export function createSubscriptionsRouter(overrides: Partial<SubscriptionDeps> = {}) {
  const router = Router();
  const deps = { ...defaultDeps(), ...overrides } as SubscriptionDeps;
  // Read per request: this module is imported before dotenv.config() runs.
  const returnUri = () => deps.returnUri ?? (process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/freelancer-dashboard/premium` : undefined);

  // requireAuth (routes/index.ts) has already verified the token and set
  // res.locals.userId before any handler here runs.
  router.get('/plans', (_req, res) => {
    res.json({ plans: PLANS, currency: 'thb' });
  });

  router.post('/checkout', async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Choose a plan and enter your card details.' });

    const userId = String(res.locals.userId);
    const { plan, token } = parsed.data;
    const amountSatang = PLANS[plan].amountSatang;

    try {
      if (!(await deps.isFreelancer(userId))) {
        return res.status(403).json({ message: 'Premium is for freelancer accounts.' });
      }

      const charge = await deps.charges.create({
        amount: amountSatang,
        currency: 'thb',
        card: token,
        capture: true,
        description: `CreativeHUB Freelancer Premium (${plan})`,
        metadata: { user_id: userId, plan, kind: 'freelancer_premium' },
        ...(returnUri() ? { return_uri: returnUri() } : {}),
      });

      // 3-D Secure: the buyer must authenticate with their bank first. Nothing
      // is granted here - the webhook (or /confirm when they return) does that
      // once Omise reports the charge as paid.
      if (charge.authorize_uri && charge.status === 'pending') {
        return res.json({ status: 'pending', chargeId: charge.id, authorizeUri: charge.authorize_uri });
      }

      const result = await verifyAndActivate(deps, charge, { eventKey: 'checkout', expectedUserId: userId });
      if (result.status === 'activated') return res.json({ status: 'active', chargeId: charge.id });
      if (result.status === 'error') {
        console.error('Subscription activation failed after a paid charge:', charge.id, result.reason);
        return res.status(500).json({ message: 'Payment received but activation failed. It will be retried automatically; contact support with reference ' + charge.id });
      }
      return res.status(402).json({ message: charge.failure_message || 'Your card was declined.' });
    } catch (error) {
      console.error('Subscription checkout failed:', error);
      return res.status(500).json({ message: 'Unable to process the payment right now.' });
    }
  });

  // Called after the card issuer's 3-D Secure step (or to retry activation).
  // Trusts nothing from the caller except the charge id: the charge is
  // re-fetched from Omise and must be paid, ours, for a known plan, at exactly
  // that plan's price - the same rules the webhook applies.
  router.post('/confirm', async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Missing charge reference.' });
    const userId = String(res.locals.userId);

    try {
      const charge = await deps.charges.retrieve(parsed.data.chargeId);
      const result = await verifyAndActivate(deps, charge, { eventKey: 'confirm', expectedUserId: userId });

      if (result.status === 'activated') return res.json({ status: 'active', chargeId: charge.id });
      if (result.status === 'error') {
        console.error('Subscription activation failed on confirm:', charge?.id, result.reason);
        return res.status(500).json({ message: 'Unable to activate Premium. Contact support with reference ' + charge?.id });
      }
      if (result.status === 'rejected') {
        return res.status(result.reason?.includes('different user') ? 403 : 400).json({ message: result.reason?.includes('different user') ? 'That payment does not belong to this account.' : 'That payment does not match a Premium plan.' });
      }
      if (!charge || charge.metadata?.kind !== 'freelancer_premium') return res.status(403).json({ message: 'That payment does not belong to this account.' });
      return res.status(402).json({ message: charge.status === 'pending' ? 'The payment is still being processed.' : 'The payment was not completed.' });
    } catch (error) {
      console.error('Subscription confirm failed:', error);
      return res.status(500).json({ message: 'Unable to confirm the payment right now.' });
    }
  });

  router.post('/cancel', async (req, res) => {
    const accessToken = getBearerToken(req.headers.authorization);
    if (!accessToken) return res.status(401).json({ message: 'Authentication required.' });
    const { error } = await deps.cancel(accessToken);
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ status: 'cancelled' });
  });

  return router;
}

export default createSubscriptionsRouter();
