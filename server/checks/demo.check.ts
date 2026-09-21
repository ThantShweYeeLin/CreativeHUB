// Demo payment mode: processor + the real subscription router with a fake
// activation. Run: npm run test:demo
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createDemoCharge, decodeDemoToken, paymentMode } from '../src/lib/demoPayments.js';
import { createSubscriptionsRouter } from '../src/routes/subscriptions.js';
import { verifyPremiumCharge } from '../src/lib/premiumCharges.js';

let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d?: unknown) => { ok ? (passed++, console.log(`  PASS  ${n}`)) : (failed++, console.log(`  FAIL  ${n}`, d ?? '')); };
const tok = (o: Partial<{ brand: string; last4: string; expMonth: number; expYear: number; outcome: string }> = {}) =>
  'demo_tok_' + Buffer.from(JSON.stringify({ brand: 'Visa', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 2, outcome: 'success', ...o })).toString('base64url');

async function main() {
  console.log('Mode selection');
  check('explicit PAYMENT_MODE wins', paymentMode({ PAYMENT_MODE: 'demo', OMISE_SECRET_KEY: 'skey_test_x' } as any) === 'demo' && paymentMode({ PAYMENT_MODE: 'omise' } as any) === 'omise');
  check('no Omise key -> demo', paymentMode({} as any) === 'demo');
  check('an Omise secret key -> omise', paymentMode({ OMISE_SECRET_KEY: 'skey_test_abc' } as any) === 'omise');

  console.log('Token + processor');
  check('a valid demo token decodes', decodeDemoToken(tok())?.last4 === '4242');
  check('a real-looking token or garbage does not decode', decodeDemoToken('tokn_test_1') === null && decodeDemoToken('demo_tok_!!!') === null && decodeDemoToken(tok({ last4: '42' })) === null && decodeDemoToken(tok({ outcome: 'free_premium' })) === null);
  const meta = { user_id: 'u1', plan: 'monthly', kind: 'freelancer_premium' };
  const ok = createDemoCharge({ amount: 9900, currency: 'thb', card: tok(), metadata: meta });
  check('success: paid + successful, demo id, card summary, no card number anywhere', ok.paid && ok.status === 'successful' && ok.id.startsWith('chrg_demo_') && (ok as any).card.last_digits === '4242' && !JSON.stringify(ok).includes('4242424242424242'));
  check('a demo charge passes the same verification as a real one', verifyPremiumCharge(ok).kind === 'valid');
  for (const [outcome, code] of [['declined', 'payment_rejected'], ['insufficient_funds', 'insufficient_fund'], ['processing_error', 'failed_processing']] as const) {
    const c = createDemoCharge({ amount: 9900, currency: 'thb', card: tok({ outcome }), metadata: meta });
    check(`${outcome}: not paid, failure code ${code}, never valid`, !c.paid && c.status === 'failed' && (c as any).failure_code === code && verifyPremiumCharge(c).kind === 'ignored');
  }
  const expired = createDemoCharge({ amount: 9900, currency: 'thb', card: tok({ expYear: new Date().getFullYear() - 1 }), metadata: meta });
  check('an expired card is declined server-side even if the client said success', !expired.paid && (expired as any).failure_code === 'expired_card');
  check('an invalid token is declined', !createDemoCharge({ amount: 9900, currency: 'thb', card: 'nope', metadata: meta }).paid);
  check('two charges never share an id', createDemoCharge({ amount: 1, currency: 'thb', card: tok(), metadata: meta }).id !== ok.id);

  console.log('Router in demo mode');
  const activations: any[] = [];
  const router = createSubscriptionsRouter({
    isFreelancer: async () => true,
    activate: async (...a) => { activations.push(a); return { error: null, periodEnd: '2099-01-01T00:00:00.000Z' }; },
    charges: { create: async (i: any) => createDemoCharge(i), retrieve: async () => undefined },
    saveCardSummary: async () => {},
    recordEvent: async () => {},
  });
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { res.locals.userId = 'user-1'; next(); });
  app.use('/s', router);
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/s`;
  const post = async (p: string, b: unknown) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json() as any }; };
  try {
    let r = await post('/checkout', { plan: 'annual', token: tok() });
    check('checkout with the success card activates and returns a receipt', r.status === 200 && r.json.status === 'active' && r.json.receipt.amountSatang === 99900 && r.json.receipt.card.last4 === '4242' && r.json.receipt.demo === true && r.json.receipt.validUntil, r);
    check('activation used the server price and the demo charge id', activations[0][3] === 99900 && String(activations[0][2]).startsWith('chrg_demo_'));
    r = await post('/checkout', { plan: 'monthly', token: tok({ outcome: 'declined' }) });
    check('a declined demo card -> 402 with the bank message, nothing activated', r.status === 402 && /declined/i.test(r.json.message) && activations.length === 1, r);
    r = await post('/checkout', { plan: 'monthly', token: tok({ outcome: 'insufficient_funds' }) });
    check('insufficient funds -> 402 with its own message', r.status === 402 && /insufficient/i.test(r.json.message));
    r = await post('/checkout', { plan: 'monthly', token: tok({ outcome: 'free_premium' }) });
    check('a tampered outcome value is not accepted as success', r.status === 402 && activations.length === 1);
    r = await post('/confirm', { chargeId: 'chrg_demo_abc' });
    check('demo charges cannot be "confirmed" later (nothing to fetch)', r.status !== 200 && activations.length === 1);
  } finally { server.close(); }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();
