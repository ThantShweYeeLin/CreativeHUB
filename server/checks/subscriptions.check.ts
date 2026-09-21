// Exercises the subscription routes with a fake Omise + fake activation, so
// no real charge or database is needed. Run: npm run test:subscriptions
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createSubscriptionsRouter, PLANS } from '../src/routes/subscriptions.js';
import { requireAuth } from '../src/lib/requireAuth.js';
import paymentsRouter from '../src/routes/payments.js';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.log(`  FAIL  ${name}`, detail ?? ''); }
};

function makeApp(opts: { charge?: any; retrieved?: any; freelancer?: boolean; activateError?: boolean }) {
  const calls = { activate: [] as any[], created: [] as any[], cancel: [] as string[] };
  const router = createSubscriptionsRouter({
    charges: {
      create: async (input) => { calls.created.push(input); return opts.charge; },
      retrieve: async () => opts.retrieved,
    },
    isFreelancer: async () => opts.freelancer !== false,
    activate: async (...args) => { calls.activate.push(args); return { error: opts.activateError ? { message: 'db down' } : null }; },
    cancel: async (token) => { calls.cancel.push(token); return { error: null }; },
  });
  const app = express();
  app.use(express.json());
  // Stand-in for requireAuth: the real middleware is exercised separately below.
  app.use((req, res, next) => { res.locals.userId = req.header('x-test-user'); next(); });
  app.use('/subscriptions', router);
  return { app, calls };
}

async function call(app: express.Express, path: string, body: unknown, headers: Record<string, string> = { 'x-test-user': 'user-1', Authorization: 'Bearer tok' }) {
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => ({})) as any };
  } finally { server.close(); }
}

const paidCharge = (over: Record<string, unknown> = {}) => ({
  id: 'chrg_1', paid: true, status: 'successful', amount: PLANS.monthly.amountSatang, currency: 'thb',
  metadata: { user_id: 'user-1', plan: 'monthly', kind: 'freelancer_premium' }, ...over,
});

async function main() {
  console.log('Plans');
  check('monthly is 99 THB (9900 satang)', PLANS.monthly.amountSatang === 9900);
  check('annual is 999 THB (99900 satang)', PLANS.annual.amountSatang === 99900);

  console.log('POST /subscriptions/checkout');
  let t = makeApp({ charge: paidCharge() });
  let r = await call(t.app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1', amountSatang: 1, amount: 1 });
  check('a paid charge activates the subscription', r.status === 200 && r.json.status === 'active' && t.calls.activate.length === 1, r);
  check('the charged amount comes from the server plan table, never the request body', t.calls.created[0].amount === 9900, t.calls.created[0]);
  check('the activation uses the server-side plan price', t.calls.activate[0][3] === 9900);
  check('the charge is tagged with the caller and plan', t.calls.created[0].metadata.user_id === 'user-1' && t.calls.created[0].metadata.plan === 'monthly');

  t = makeApp({ charge: paidCharge({ amount: 99900, metadata: { user_id: 'user-1', plan: 'annual', kind: 'freelancer_premium' } }) });
  r = await call(t.app, '/subscriptions/checkout', { plan: 'annual', token: 'tokn_1' });
  check('annual plan charges 99900 satang', t.calls.created[0].amount === 99900 && r.status === 200);

  t = makeApp({ charge: paidCharge() });
  r = await call(t.app, '/subscriptions/checkout', { plan: 'lifetime', token: 'tokn_1' });
  check('an unknown plan is rejected before any charge', r.status === 400 && t.calls.created.length === 0);
  r = await call(t.app, '/subscriptions/checkout', { plan: 'monthly' });
  check('a missing card token is rejected', r.status === 400 && t.calls.created.length === 0);

  t = makeApp({ charge: paidCharge(), freelancer: false });
  r = await call(t.app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1' });
  check('a non-freelancer cannot buy Premium', r.status === 403 && t.calls.created.length === 0);

  t = makeApp({ charge: { id: 'chrg_2', paid: false, status: 'failed', failure_message: 'insufficient funds' } });
  r = await call(t.app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1' });
  check('a declined card does NOT activate anything', r.status === 402 && t.calls.activate.length === 0, r);

  t = makeApp({ charge: { id: 'chrg_3', paid: false, status: 'pending', authorize_uri: 'https://pay.omise.co/authorize/x' } });
  r = await call(t.app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1' });
  check('a 3-D Secure charge returns the authorize link and does NOT activate yet', r.status === 200 && r.json.status === 'pending' && t.calls.activate.length === 0, r);

  t = makeApp({ charge: paidCharge(), activateError: true });
  r = await call(t.app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1' });
  check('a paid charge whose activation fails reports the reference instead of silently succeeding', r.status === 500 && r.json.message.includes('chrg_1'), r);

  console.log('POST /subscriptions/confirm');
  t = makeApp({ retrieved: paidCharge() });
  r = await call(t.app, '/subscriptions/confirm', { chargeId: 'chrg_1' });
  check('a paid charge belonging to the caller activates', r.status === 200 && t.calls.activate.length === 1, r);
  r = await call(t.app, '/subscriptions/confirm', { chargeId: 'chrg_1', paid: true, plan: 'annual' });
  check('client-supplied "paid"/plan fields are ignored (activation uses the retrieved charge)', t.calls.activate[1][1] === 'monthly');

  t = makeApp({ retrieved: paidCharge({ metadata: { user_id: 'someone-else', plan: 'monthly', kind: 'freelancer_premium' } }) });
  r = await call(t.app, '/subscriptions/confirm', { chargeId: 'chrg_1' });
  check("someone else's paid charge cannot be claimed", r.status === 403 && t.calls.activate.length === 0);

  t = makeApp({ retrieved: paidCharge({ amount: 100 }) });
  r = await call(t.app, '/subscriptions/confirm', { chargeId: 'chrg_1' });
  check('a charge for the wrong amount is rejected', r.status === 400 && t.calls.activate.length === 0);

  t = makeApp({ retrieved: paidCharge({ paid: false, status: 'pending' }) });
  r = await call(t.app, '/subscriptions/confirm', { chargeId: 'chrg_1' });
  check('an unpaid/pending charge does not activate', r.status === 402 && t.calls.activate.length === 0);

  t = makeApp({ retrieved: paidCharge({ metadata: { user_id: 'user-1', plan: 'monthly', kind: 'something_else' } }) });
  r = await call(t.app, '/subscriptions/confirm', { chargeId: 'chrg_1' });
  check('a charge that was not a Premium purchase is rejected', r.status === 403 && t.calls.activate.length === 0);

  console.log('POST /subscriptions/cancel');
  t = makeApp({});
  r = await call(t.app, '/subscriptions/cancel', {});
  check('cancel runs as the caller (their own token)', r.status === 200 && t.calls.cancel[0] === 'tok');
  r = await call(t.app, '/subscriptions/cancel', {}, { 'x-test-user': 'user-1' });
  check('cancel without a token is rejected', r.status === 401);

  console.log('requireAuth in front of the router');
  const app = express();
  app.use(express.json());
  app.use(requireAuth);
  app.use('/subscriptions', createSubscriptionsRouter({ charges: { create: async () => paidCharge(), retrieve: async () => paidCharge() } }));
  r = await call(app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1' }, {});
  check('no token -> 401 (never reaches Omise)', r.status === 401);
  r = await call(app, '/subscriptions/checkout', { plan: 'monthly', token: 'tokn_1' }, { Authorization: 'Bearer forged' });
  check('forged token -> 401', r.status === 401);

  console.log('POST /payments/charge (legacy test endpoint)');
  const payApp = express();
  payApp.use(express.json());
  payApp.use((req, res, next) => { res.locals.userId = 'user-1'; next(); });
  payApp.use('/payments', paymentsRouter);
  r = await call(payApp, '/payments/charge', { token: 'tokn_x', amountSatang: 100000 });
  check('a signed-in user can no longer create arbitrary real charges (disabled by default)', r.status === 404, r);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();
