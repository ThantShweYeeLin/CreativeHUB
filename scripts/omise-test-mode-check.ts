// Omise TEST-MODE verification of Freelancer Premium payments.
//
//   pnpm run test:omise
//
// Needs (in .env.local / server/.env): a TEST secret key (skey_test_...) as
// OMISE_SECRET_KEY, the matching test public key as VITE_OMISE_PUBLIC_KEY, and
// optionally OMISE_WEBHOOK_SECRET. Refuses to run with a live key. Uses real
// Omise test charges + real Supabase auth/DB for isolated throwaway accounts
// (deleted at the end). Webhook deliveries are SELF-SIGNED and posted to the
// in-process handler (it still re-fetches every charge from Omise's real API);
// proving that Omise itself delivers to your public URL is a manual step -
// see docs/omise-webhook-setup.md.
//
// If no test keys are present it prints SKIPPED and exits 0 without touching anything.
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
// @ts-ignore - express lives in server/node_modules
import express from '../server/node_modules/express/index.js';
import { createSubscriptionsRouter } from '../server/src/routes/subscriptions.js';
import { createOmiseWebhookHandler, defaultWebhookDeps } from '../server/src/routes/omiseWebhook.js';
import { requireAuth } from '../server/src/lib/requireAuth.js';
import { omiseClient } from '../server/src/lib/omiseClient.js';

const SECRET_KEY = process.env.OMISE_SECRET_KEY || '';
const PUBLIC_KEY = process.env.VITE_OMISE_PUBLIC_KEY || '';
if (!SECRET_KEY.startsWith('skey_test_') || !PUBLIC_KEY.startsWith('pkey_test_')) {
  console.log('SKIPPED: Omise TEST keys are not configured.');
  console.log('  Need OMISE_SECRET_KEY=skey_test_… and VITE_OMISE_PUBLIC_KEY=pkey_test_… (dashboard.omise.co, test mode).');
  console.log('  Nothing was run, nothing was created. NO real-provider verification has happened.');
  process.exit(0);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const RUN = Date.now().toString(36);
const PASSWORD = `Om-${RUN}-Test-Pass-1!`;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const WEBHOOK_SECRET = process.env.OMISE_WEBHOOK_SECRET || Buffer.from(`local-${RUN}-secret`).toString('base64');

let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d?: unknown) => { ok ? (passed++, console.log(`  PASS  ${n}`)) : (failed++, console.log(`  FAIL  ${n}`, d === undefined ? '' : JSON.stringify(d)?.slice(0, 300))); };
const created: string[] = [];

async function makeFreelancer(tag: string) {
  const email = `omise-test-${RUN}-${tag}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const id = data.user!.id; created.push(id);
  await admin.from('users').upsert({ id, email, full_name: `omise-test ${tag}`, role: 'freelancer', onboarding_completed: true, account_status: 'active' } as any);
  await admin.from('freelancer_profiles').insert({ user_id: id, title: 'Makeup Artist', is_available: true, visibility: 'public' } as any);
  const db = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await db.auth.signInWithPassword({ email, password: PASSWORD });
  return { id, db };
}

// Card -> one-time token, exactly what Omise.js does in the browser (public key only).
async function tokenize(number: string) {
  const res = await fetch('https://vault.omise.co/tokens', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${PUBLIC_KEY}:`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'card[name]': 'Test Buyer', 'card[number]': number, 'card[expiration_month]': '12', 'card[expiration_year]': String(new Date().getFullYear() + 3), 'card[security_code]': '123' }),
  });
  const json: any = await res.json();
  if (!json.id) throw new Error(`tokenize failed: ${json.message}`);
  return json.id as string;
}

const CARDS = { success: '4242424242424242', insufficientFunds: '4111111111140011', stolenCard: '4111111111130012', paymentRejected: '4111111111110014' };
const sub = async (id: string) => (await admin.from('subscription_payments').select('*').eq('user_id', id)).data || [];
const days = async (id: string) => { const s = (await admin.from('freelancer_subscriptions').select('current_period_end').eq('user_id', id).maybeSingle()).data as any; return s ? (new Date(s.current_period_end).getTime() - Date.now()) / 86400000 : null; };

async function main() {
  console.log(`Omise TEST mode (${SECRET_KEY.slice(0, 14)}…) + live Supabase ${new URL(SUPABASE_URL).host}, run ${RUN}\n`);
  const buyer = await makeFreelancer('buyer'), other = await makeFreelancer('other');

  const app = express();
  app.use(express.json());
  app.use('/hook', express.raw({ type: '*/*' }), createOmiseWebhookHandler({ secretBase64: WEBHOOK_SECRET }));
  const api = express.Router();
  api.use(requireAuth);
  api.use('/subscriptions', createSubscriptionsRouter());
  app.use('/api', api);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (path: string, who: typeof buyer | null, body: unknown) => {
    const tok = who ? (await who.db.auth.getSession()).data.session!.access_token : '';
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
  };
  const deliver = (chargeId: string, key = 'charge.complete') => {
    const body = JSON.stringify({ object: 'event', id: `evnt_${RUN}_${Math.random().toString(36).slice(2)}`, key, data: { object: 'charge', id: chargeId } });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', Buffer.from(WEBHOOK_SECRET, 'base64')).update(`${ts}.${body}`).digest('hex');
    return fetch(`${base}/hook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Omise-Signature': sig, 'Omise-Signature-Timestamp': String(ts) }, body });
  };

  try {
    console.log('Checkout');
    let r = await call('/api/subscriptions/checkout', buyer, { plan: 'monthly', token: await tokenize(CARDS.success) });
    check('monthly checkout with the success card activates Premium', r.status === 200 && r.json.status === 'active', r);
    let d = await days(buyer.id);
    check('the period is about one month', d !== null && d > 27 && d < 32, d);
    const firstCharge = r.json.chargeId as string;
    const real = await (omiseClient.charges as any).retrieve(firstCharge);
    check('Omise\'s own record: paid, successful, 9900 satang THB', real.paid && real.status === 'successful' && real.amount === 9900 && real.currency === 'thb', real);

    r = await call('/api/subscriptions/checkout', buyer, { plan: 'annual', token: await tokenize(CARDS.success) });
    d = await days(buyer.id);
    check('yearly checkout succeeds and extends from the end of the month (~13 months)', r.status === 200 && d !== null && d > 390 && d < 400, { status: r.status, d });
    check('two payments are on record', (await sub(buyer.id)).length === 2);

    for (const [label, number] of Object.entries({ 'insufficient funds': CARDS.insufficientFunds, 'stolen/lost card': CARDS.stolenCard, 'payment rejected': CARDS.paymentRejected })) {
      const before = (await sub(other.id)).length;
      r = await call('/api/subscriptions/checkout', other, { plan: 'monthly', token: await tokenize(number) });
      check(`declined card (${label}) -> 402 and nothing activated`, r.status === 402 && (await sub(other.id)).length === before && (await days(other.id)) === null, r);
    }

    console.log('Confirm / cross-user');
    r = await call('/api/subscriptions/confirm', buyer, { chargeId: firstCharge });
    check('confirming an already-activated charge grants nothing more', r.status === 200 && (await sub(buyer.id)).length === 2);
    r = await call('/api/subscriptions/confirm', other, { chargeId: firstCharge });
    check("another user cannot claim the buyer's charge (403)", r.status === 403 && (await sub(other.id)).length === 0, r);

    console.log('Webhook when the browser never returns (charge made directly, no /checkout or /confirm call)');
    const orphan = await (omiseClient.charges as any).create({
      amount: 9900, currency: 'thb', card: await tokenize(CARDS.success), capture: true,
      metadata: { user_id: other.id, plan: 'monthly', kind: 'freelancer_premium' },
    });
    check('precondition: a paid charge exists at Omise but the user has no Premium', orphan.paid && (await days(other.id)) === null);
    let hr = await deliver(orphan.id);
    check('the signed webhook activates it', hr.status === 200 && (await sub(other.id)).length === 1);
    await deliver(orphan.id); await deliver(orphan.id);
    check('three repeated deliveries still leave exactly one payment and one month', (await sub(other.id)).length === 1 && ((await days(other.id)) ?? 99) < 32);
    check('a charge.create delivery for the same charge is ignored', (await deliver(orphan.id, 'charge.create')).status === 200 && (await sub(other.id)).length === 1);

    console.log('Recovery from activation failure');
    const third = await makeFreelancer('recover');
    const orphan2 = await (omiseClient.charges as any).create({
      amount: 99900, currency: 'thb', card: await tokenize(CARDS.success), capture: true,
      metadata: { user_id: third.id, plan: 'annual', kind: 'freelancer_premium' },
    });
    const realDeps = defaultWebhookDeps();
    let failOnce = true;
    const flaky = express();
    flaky.post('/hook', express.raw({ type: '*/*' }), createOmiseWebhookHandler({
      secretBase64: WEBHOOK_SECRET,
      activate: async (...a) => (failOnce ? ((failOnce = false), { error: { message: 'simulated outage' } }) : realDeps.activate(...a)),
    }));
    const flakyServer = flaky.listen(0);
    const flakyBase = `http://127.0.0.1:${(flakyServer.address() as AddressInfo).port}`;
    const send = () => {
      const body = JSON.stringify({ object: 'event', id: `evnt_${RUN}_r`, key: 'charge.complete', data: { object: 'charge', id: orphan2.id } });
      const ts = Math.floor(Date.now() / 1000);
      const sig = createHmac('sha256', Buffer.from(WEBHOOK_SECRET, 'base64')).update(`${ts}.${body}`).digest('hex');
      return fetch(`${flakyBase}/hook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Omise-Signature': sig, 'Omise-Signature-Timestamp': String(ts) }, body });
    };
    hr = await send();
    check('activation failure -> 500, no Premium granted', hr.status === 500 && (await sub(third.id)).length === 0);
    const errRow = (await admin.from('payment_events').select('outcome, omise_charge_id').eq('omise_charge_id', orphan2.id).eq('outcome', 'error')).data || [];
    check('the failure is recorded in payment_events for reconciliation', errRow.length === 1, errRow);
    hr = await send();
    check('redelivery recovers: activated exactly once, ~12 months', hr.status === 200 && (await sub(third.id)).length === 1 && ((await days(third.id)) ?? 0) > 360);
    flakyServer.close();

    console.log('3-D Secure / abandoned checkout');
    const threeDs = await (omiseClient.charges as any).create({
      amount: 9900, currency: 'thb', card: await tokenize(CARDS.success), return_uri: `${base}/return`,
      metadata: { user_id: other.id, plan: 'monthly', kind: 'freelancer_premium' },
    }).catch((e: Error) => ({ error: e.message }));
    if (threeDs.authorize_uri && threeDs.status === 'pending') {
      check('a 3DS charge is pending with an authorize link (nothing granted yet)', true);
      const before = (await sub(other.id)).length;
      r = await call('/api/subscriptions/confirm', other, { chargeId: threeDs.id });
      check('abandoned 3DS: confirm reports "still processing" (402) and grants nothing', r.status === 402 && (await sub(other.id)).length === before, r);
      hr = await deliver(threeDs.id);
      check('abandoned 3DS: even a webhook cannot activate an unpaid charge', hr.status === 200 && (await sub(other.id)).length === before);
      console.log(`  MANUAL  open ${threeDs.authorize_uri} , authorize the test payment, then re-run with OMISE_3DS_CHARGE_ID=${threeDs.id} to verify the return path`);
    } else {
      console.log('  SKIP  3-D Secure: this test account did not return an authorize_uri (3DS is not enabled for it — email support@omise.co to enable).');
    }
    if (process.env.OMISE_3DS_CHARGE_ID) {
      r = await call('/api/subscriptions/confirm', other, { chargeId: process.env.OMISE_3DS_CHARGE_ID });
      check('after completing 3DS manually, confirm activates the subscription', r.status === 200);
    }
  } finally {
    server.close();
    for (const id of created) {
      await admin.from('payment_events').delete().eq('user_id', id);
      await admin.from('subscription_payments').delete().eq('user_id', id);
      await admin.from('freelancer_subscriptions').delete().eq('user_id', id);
      await admin.from('freelancer_profiles').delete().eq('user_id', id);
      await admin.auth.admin.deleteUser(id);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
