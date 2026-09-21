// End-to-end check of the DEMO checkout through the real UI: real Supabase
// (throwaway freelancer), the real Express server in demo mode, the real React
// app driven by Playwright. Run: pnpm run test:premium-demo
import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const RUN = Date.now().toString(36);
const EMAIL = `premium-demo-${RUN}@example.com`;
const PASSWORD = `Pd-${RUN}-Test-Pass-1!`;
const SHOTS = `docs/premium-demo-screenshots`;
const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d?: unknown) => { ok ? (passed++, console.log(`  PASS  ${n}`)) : (failed++, console.log(`  FAIL  ${n}`, d === undefined ? '' : JSON.stringify(d)?.slice(0, 300))); };

async function main() {
  const { data } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  const id = data.user!.id;
  try {
    await admin.from('users').upsert({ id, email: EMAIL, full_name: `premium-demo ${RUN}`, role: 'freelancer', onboarding_completed: true, account_status: 'active' } as any);
    const fp = await admin.from('freelancer_profiles').insert({ user_id: id, title: 'Makeup Artist', is_available: true, visibility: 'public' } as any);
    if (fp.error) throw new Error(fp.error.message);
    mkdirSync(SHOTS, { recursive: true });

    // Server in explicit demo mode (never touches Omise) + the dev frontend.
    const server = spawn('npx', ['tsx', 'src/index.ts'], { cwd: 'server', stdio: 'ignore', env: { ...process.env, PAYMENT_MODE: 'demo', PORT: '4000' } });
    const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 9000));
    try {
      let output = '';
      try {
        execFileSync('npx', ['playwright', 'test', 'tests/premium-demo-checkout.spec.ts', '--reporter=line'], { stdio: 'pipe', env: { ...process.env, PD_EMAIL: EMAIL, PD_PASSWORD: PASSWORD, PD_SHOTS: SHOTS } });
      } catch (e: any) { output = String(e.stdout || e.message).slice(-1600); }
      check('UI: validation, formatting, processing overlay, decline message, receipt, history', output === '', output);
    } finally {
      server.kill(); vite.kill();
      for (const p of ['tsx src/index.ts', 'vite --port 5173']) { try { execFileSync('pkill', ['-f', p]); } catch { /* gone */ } }
    }

    const sub = (await admin.from('freelancer_subscriptions').select('*').eq('user_id', id).maybeSingle()).data as any;
    const pays = ((await admin.from('subscription_payments').select('*').eq('user_id', id)).data || []) as any[];
    const days = sub ? (new Date(sub.current_period_end).getTime() - Date.now()) / 86400000 : 0;
    check('the declined attempt left nothing behind: exactly one payment (the yearly one)', pays.length === 1 && pays[0].plan === 'annual' && pays[0].amount_satang === 99900, pays);
    check('the payment reference is a demo charge id (never mistaken for a real Omise charge)', String(pays[0]?.omise_charge_id).startsWith('chrg_demo_'));
    check('the subscription is active for about a year', !!sub && days > 360 && days < 370, days);
    check('no card number is stored anywhere (only brand and last four, if the column exists)', !JSON.stringify(pays).includes('4242424242424242') && (pays[0]?.card_last4 === undefined || pays[0].card_last4 === '4242'), pays[0]);
  } finally {
    await admin.from('payment_events').delete().eq('user_id', id);
    await admin.from('subscription_payments').delete().eq('user_id', id);
    await admin.from('freelancer_subscriptions').delete().eq('user_id', id);
    await admin.from('freelancer_profiles').delete().eq('user_id', id);
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`\n${passed} passed, ${failed} failed\nScreenshots: ${SHOTS}/`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
