// Omise webhook: signature verification + event handling, with a fake Omise API
// and a fake activation that models the database's per-charge idempotency.
// Run: npm run test:webhook
import { createHmac, randomBytes } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createOmiseWebhookHandler, verifyOmiseSignature, SIGNATURE_TOLERANCE_SECONDS } from '../src/routes/omiseWebhook.js';
import { PLANS, verifyPremiumCharge, type PaymentEvent } from '../src/lib/premiumCharges.js';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.log(`  FAIL  ${name}`, detail ?? ''); }
};

const SECRET_BYTES = randomBytes(32);
const SECRET = SECRET_BYTES.toString('base64');
const sign = (body: string, ts: number, secret = SECRET_BYTES) => createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
const nowS = () => Math.floor(Date.now() / 1000);

const charge = (over: Record<string, unknown> = {}) => ({
  id: 'chrg_test_1', object: 'charge', paid: true, status: 'successful', amount: 9900, currency: 'thb',
  metadata: { user_id: 'user-1', plan: 'monthly', kind: 'freelancer_premium' }, ...over,
});
const event = (key: string, chargeId = 'chrg_test_1', id = 'evnt_1') => JSON.stringify({ object: 'event', id, key, data: { object: 'charge', id: chargeId } });

function harness(opts: { secret?: string | undefined; allowUnsigned?: boolean; charges?: Record<string, any>; failActivations?: number; retrieveThrows?: boolean } = {}) {
  const granted = new Map<string, number>();          // chargeId -> periods granted (must never exceed 1)
  const activateCalls: string[] = [];
  const events: PaymentEvent[] = [];
  let failures = opts.failActivations ?? 0;
  const handler = createOmiseWebhookHandler({
    secretBase64: 'secret' in opts ? opts.secret : SECRET,
    allowUnsigned: opts.allowUnsigned,
    retrieveCharge: async (id) => { if (opts.retrieveThrows) throw new Error('omise down'); return (opts.charges ?? { chrg_test_1: charge() })[id]; },
    activate: async (_u, _p, chargeId) => {
      activateCalls.push(chargeId);
      if (failures > 0) { failures--; return { error: { message: 'db down' } }; }
      if (!granted.has(chargeId)) granted.set(chargeId, 1);   // DB semantics: a charge grants once
      return { error: null };
    },
    recordEvent: async (e) => { events.push(e); },
  });
  const app = express();
  app.post('/hook', express.raw({ type: '*/*' }), handler);
  return { app, granted, activateCalls, events };
}

async function post(app: express.Express, body: string, headers: Record<string, string>) {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
    return { status: res.status, json: await res.json().catch(() => ({})) as any };
  } finally { server.close(); }
}
const signed = (body: string, ts = nowS()) => ({ 'Omise-Signature': sign(body, ts), 'Omise-Signature-Timestamp': String(ts) });

async function main() {
  console.log('Signature verification (documented Omise scheme)');
  const body = event('charge.complete');
  const ts = nowS();
  const ver = (over: Partial<Parameters<typeof verifyOmiseSignature>[0]> = {}) =>
    verifyOmiseSignature({ rawBody: body, signatureHeader: sign(body, ts), timestampHeader: String(ts), secretBase64: SECRET, ...over });
  check('a correctly signed body verifies', ver().ok === true);
  check('a tampered body is rejected', ver({ rawBody: body.replace('chrg_test_1', 'chrg_evil_9') }).ok === false);
  check('a signature made with a different secret is rejected', ver({ signatureHeader: sign(body, ts, randomBytes(32)) }).ok === false);
  check('a signature for a different timestamp is rejected', ver({ signatureHeader: sign(body, ts - 1) }).ok === false);
  check('missing headers are rejected', ver({ signatureHeader: undefined }).ok === false && ver({ timestampHeader: undefined }).ok === false);
  check('a stale timestamp (replay) is rejected', ver({ timestampHeader: String(ts - SIGNATURE_TOLERANCE_SECONDS - 5), signatureHeader: sign(body, ts - SIGNATURE_TOLERANCE_SECONDS - 5) }).ok === false);
  check('a far-future timestamp is rejected', ver({ timestampHeader: String(ts + 3600), signatureHeader: sign(body, ts + 3600) }).ok === false);
  check('during secret rotation either of two comma-separated signatures is accepted',
    ver({ signatureHeader: `${sign(body, ts, randomBytes(32))},${sign(body, ts)}` }).ok === true
    && ver({ signatureHeader: `${sign(body, ts)},${sign(body, ts, randomBytes(32))}` }).ok === true);
  check('non-hex / wrong-length signatures are rejected without throwing', ver({ signatureHeader: 'zzzz' }).ok === false && ver({ signatureHeader: 'ab' }).ok === false);
  check('the secret is base64-decoded first (using the raw base64 text as the key would not verify)',
    verifyOmiseSignature({ rawBody: body, signatureHeader: createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex'), timestampHeader: String(ts), secretBase64: SECRET }).ok === false);

  console.log('Charge validation (shared by checkout, confirm, webhook)');
  check('a paid THB charge at the monthly price for a user is valid', verifyPremiumCharge(charge()).kind === 'valid');
  check('a paid yearly charge at 99900 is valid', verifyPremiumCharge(charge({ amount: 99900, metadata: { user_id: 'u', plan: 'annual', kind: 'freelancer_premium' } })).kind === 'valid');
  check('the wrong amount for the plan is rejected', verifyPremiumCharge(charge({ amount: 9899 })).kind === 'rejected');
  check('a monthly plan paid at the yearly price is rejected', verifyPremiumCharge(charge({ amount: 99900 })).kind === 'rejected');
  check('the wrong currency is rejected', verifyPremiumCharge(charge({ currency: 'usd' })).kind === 'rejected');
  check('an unknown plan is rejected', verifyPremiumCharge(charge({ metadata: { user_id: 'u', plan: 'lifetime', kind: 'freelancer_premium' } })).kind === 'rejected');
  check('a missing user is rejected', verifyPremiumCharge(charge({ metadata: { plan: 'monthly', kind: 'freelancer_premium' } })).kind === 'rejected');
  check('an unpaid / pending / failed charge is ignored, not activated', ['pending', 'failed', 'reversed', 'expired'].every((st) => verifyPremiumCharge(charge({ paid: false, status: st })).kind === 'ignored'));
  check('paid=true but status not successful is not activated', verifyPremiumCharge(charge({ paid: true, status: 'pending' })).kind === 'ignored');
  check('a non-Premium charge is ignored', verifyPremiumCharge(charge({ metadata: { kind: 'other' } })).kind === 'ignored');
  check('the plan prices are 99 THB and 999 THB in satang', PLANS.monthly.amountSatang === 9900 && PLANS.annual.amountSatang === 99900);

  console.log('Webhook endpoint');
  let h = harness({ secret: undefined });
  let r = await post(h.app, body, signed(body));
  check('no OMISE_WEBHOOK_SECRET configured -> 503, nothing processed', r.status === 503 && h.activateCalls.length === 0);
  h = harness({ secret: undefined, allowUnsigned: true });
  r = await post(h.app, body, {});
  check('unsigned deliveries only work behind the explicit dev flag', r.status === 200 && h.granted.size === 1);

  h = harness();
  r = await post(h.app, body, {});
  check('no signature headers -> 400 and nothing activated', r.status === 400 && h.activateCalls.length === 0);
  r = await post(h.app, body, { 'Omise-Signature': sign(body, nowS(), randomBytes(32)), 'Omise-Signature-Timestamp': String(nowS()) });
  check('a forged signature -> 400 and nothing activated', r.status === 400 && h.activateCalls.length === 0);
  const staleTs = nowS() - 3600;
  r = await post(h.app, body, { 'Omise-Signature': sign(body, staleTs), 'Omise-Signature-Timestamp': String(staleTs) });
  check('a replayed (stale) delivery -> 400', r.status === 400 && h.activateCalls.length === 0);

  h = harness();
  r = await post(h.app, body, signed(body));
  check('a signed charge.complete for a paid Premium charge activates it', r.status === 200 && h.granted.get('chrg_test_1') === 1 && h.events.at(-1)?.outcome === 'activated', h.events);
  await post(h.app, body, signed(body));
  await post(h.app, body, signed(body));
  check('repeated delivery of the same event never grants a second period', h.granted.get('chrg_test_1') === 1 && [...h.granted.values()].every((n) => n === 1));
  check('each delivery is acknowledged (200) so Omise stops retrying', (await post(h.app, body, signed(body))).status === 200);

  h = harness();
  const create = event('charge.create');
  r = await post(h.app, create, signed(create));
  check('a charge.create event (out-of-order/early) is acknowledged but grants nothing', r.status === 200 && h.activateCalls.length === 0);
  const refund = event('refund.create');
  r = await post(h.app, refund, signed(refund));
  check('unrelated event types are ignored', r.status === 200 && h.activateCalls.length === 0);

  h = harness({ charges: { chrg_test_1: charge({ paid: false, status: 'pending' }) } });
  r = await post(h.app, body, signed(body));
  check('a charge.complete whose charge is not (yet) paid according to Omise\'s API is not activated', r.status === 200 && h.activateCalls.length === 0 && h.events.at(-1)?.outcome === 'ignored', h.events);

  h = harness({ charges: { chrg_test_1: charge({ paid: false, status: 'failed' }) } });
  r = await post(h.app, body, signed(body));
  check('a declined/failed charge is never activated', r.status === 200 && h.activateCalls.length === 0);

  h = harness({ charges: { chrg_test_1: charge({ amount: 100 }) } });
  r = await post(h.app, body, signed(body));
  check('an underpaid charge is rejected and recorded for reconciliation, not activated', r.status === 200 && h.activateCalls.length === 0 && h.events.at(-1)?.outcome === 'rejected', h.events);

  h = harness({ charges: { chrg_test_1: charge({ metadata: { kind: 'somebody_elses_product' } }) } });
  r = await post(h.app, body, signed(body));
  check('a charge for something else (same Omise account) is ignored', r.status === 200 && h.activateCalls.length === 0);

  h = harness({ charges: {} });
  const evilBody = event('charge.complete', 'chrg_does_not_exist');
  r = await post(h.app, evilBody, signed(evilBody));
  check('a correctly signed event naming an unknown charge activates nothing', r.status === 200 && h.activateCalls.length === 0);

  h = harness({ charges: { chrg_test_1: charge({ paid: false, status: 'pending' }) } });
  const claimsPaid = JSON.stringify({ object: 'event', id: 'evnt_9', key: 'charge.complete', data: { object: 'charge', id: 'chrg_test_1', paid: true, status: 'successful', amount: 9900, metadata: { user_id: 'attacker', plan: 'annual', kind: 'freelancer_premium' } } });
  r = await post(h.app, claimsPaid, signed(claimsPaid));
  check('payment status / plan / user claimed inside the webhook body are never trusted (only the fetched charge counts)', h.activateCalls.length === 0);

  h = harness({ charges: { chrg_test_1: charge() } });
  r = await post(h.app, 'not json', signed('not json'));
  check('a signed but malformed body -> 400', r.status === 400);
  const notEvent = JSON.stringify({ hello: 'world' });
  r = await post(h.app, notEvent, signed(notEvent));
  check('a signed body that is not an Omise event -> 400', r.status === 400);

  console.log('Failure recovery');
  h = harness({ failActivations: 1 });
  r = await post(h.app, body, signed(body));
  check('activation failure -> 500 (so Omise can redeliver) and an "error" row is recorded', r.status === 500 && h.granted.size === 0 && h.events.at(-1)?.outcome === 'error', h.events);
  r = await post(h.app, body, signed(body));
  check('the redelivery then activates exactly once (nothing lost, nothing doubled)', r.status === 200 && h.granted.get('chrg_test_1') === 1);

  h = harness({ retrieveThrows: true });
  r = await post(h.app, body, signed(body));
  check('if Omise\'s API is unreachable the webhook fails closed (500) and records it', r.status === 500 && h.activateCalls.length === 0 && h.events.at(-1)?.outcome === 'error');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();
