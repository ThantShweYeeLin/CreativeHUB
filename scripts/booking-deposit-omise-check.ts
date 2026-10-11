// End-to-end check of a booking deposit through the REAL UI, in REAL Omise
// test mode (not PAYMENT_MODE=demo): real Supabase (throwaway client +
// freelancer + booking), the real Express server reading the project's own
// OMISE_SECRET_KEY from server/.env, the real React app driven by Playwright,
// a real Omise test-mode charge. Run: pnpm run test:booking-deposit-omise
import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const RUN = Date.now().toString(36);
const CLIENT_EMAIL = `bd-client-${RUN}@example.com`;
const CLIENT_PASSWORD = `Bd-${RUN}-Test-Pass-1!`;
const FREELANCER_EMAIL = `bd-freelancer-${RUN}@example.com`;
const DEPOSIT_THB = 500;
const SHOTS = `docs/booking-deposit-omise-screenshots`;
const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d?: unknown) => { ok ? (passed++, console.log(`  PASS  ${n}`)) : (failed++, console.log(`  FAIL  ${n}`, d === undefined ? '' : JSON.stringify(d)?.slice(0, 300))); };

async function main() {
  const clientUser = await admin.auth.admin.createUser({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, email_confirm: true });
  const freelancerUser = await admin.auth.admin.createUser({ email: FREELANCER_EMAIL, password: 'unused-not-logged-in', email_confirm: true });
  const clientId = clientUser.data.user!.id;
  const freelancerId = freelancerUser.data.user!.id;
  let bookingId: string | null = null;

  try {
    await admin.from('users').upsert({ id: clientId, email: CLIENT_EMAIL, full_name: `bd-client ${RUN}`, role: 'client', onboarding_completed: true, account_status: 'active' } as any);
    await admin.from('users').upsert({ id: freelancerId, email: FREELANCER_EMAIL, full_name: `bd-freelancer ${RUN}`, role: 'freelancer', onboarding_completed: true, account_status: 'active' } as any);

    const booking = await admin.from('bookings').insert({
      client_id: clientId,
      freelancer_id: freelancerId,
      project_name: 'Omise live-check shoot',
      budget: DEPOSIT_THB / 0.3,
      deposit_amount: DEPOSIT_THB,
      status: 'pending',
      payment_status: 'unpaid',
    } as any).select().single();
    if (booking.error) throw new Error(`booking insert failed: ${booking.error.message}`);
    bookingId = booking.data.id;
    mkdirSync(SHOTS, { recursive: true });

    // Deliberately NOT setting PAYMENT_MODE=demo - this is the whole point
    // of this check: confirm the real OMISE_SECRET_KEY in server/.env
    // actually drives a real (test-mode) charge through checkout.
    const server = spawn('npx', ['tsx', 'src/index.ts'], { cwd: 'server', stdio: 'inherit', env: { ...process.env, PORT: '4000' } });
    const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 9000));
    try {
      let output = '';
      try {
        execFileSync('npx', ['playwright', 'test', 'tests/booking-deposit-omise-live.spec.ts', '--reporter=line'], {
          stdio: 'pipe',
          env: { ...process.env, BD_EMAIL: CLIENT_EMAIL, BD_PASSWORD: CLIENT_PASSWORD, BD_BOOKING_ID: bookingId!, BD_SHOTS: SHOTS },
        });
      } catch (e: any) { output = String(e.stdout || e.message).slice(-2400); }
      check('UI: decline is surfaced and leaves the booking alone, then a real charge succeeds', output === '', output);
    } finally {
      server.kill(); vite.kill();
      for (const p of ['tsx src/index.ts', 'vite --port 5173']) { try { execFileSync('pkill', ['-f', p]); } catch { /* gone */ } }
    }

    const row = (await admin.from('bookings').select('*').eq('id', bookingId).single()).data as any;
    check('payment_status flipped to deposit_paid', row?.payment_status === 'deposit_paid', row?.payment_status);
    check('status flipped to confirmed', row?.status === 'confirmed', row?.status);
    check('deposit_charge_id is a REAL Omise charge id, not a demo one', typeof row?.deposit_charge_id === 'string' && row.deposit_charge_id.startsWith('chrg_') && !row.deposit_charge_id.startsWith('chrg_demo_'), row?.deposit_charge_id);
    check('deposit_paid_via records brand + last 4', typeof row?.deposit_paid_via === 'string' && row.deposit_paid_via.includes('4242'), row?.deposit_paid_via);

    const events = ((await admin.from('booking_events').select('*').eq('booking_id', bookingId)).data || []) as any[];
    check('exactly one deposit_paid booking_event, actor=client', events.filter((e) => e.action === 'deposit_paid' && e.actor === 'client').length === 1, events);

    const notifs = ((await admin.from('notifications').select('*').eq('user_id', freelancerId).eq('type', 'booking_deposit_paid')).data || []) as any[];
    check('freelancer got exactly one deposit-received notification', notifs.length === 1, notifs);

    const paymentEvents = ((await admin.from('payment_events').select('*').eq('omise_charge_id', row?.deposit_charge_id)).data || []) as any[];
    check('reconciliation row recorded as activated', paymentEvents.some((e) => e.outcome === 'activated'), paymentEvents);

    // A plain card decline is 'ignored' (not yet paid), not 'rejected'
    // (reserved for a charge that claims to be paid but fails verification
    // against the booking it names) - see bookingDepositCharges.ts. No
    // user_id on this row (the decline is caught before the booking is even
    // looked up), so match on the reason text instead.
    const ignoredEvents = ((await admin.from('payment_events').select('*').eq('outcome', 'ignored').ilike('reason', '%not paid%')).data || []) as any[];
    check('the earlier declined attempt was recorded too (ignored, not silently dropped)', ignoredEvents.length >= 1, ignoredEvents);
  } finally {
    if (bookingId) {
      await admin.from('payment_events').delete().eq('omise_charge_id', (await admin.from('bookings').select('deposit_charge_id').eq('id', bookingId).maybeSingle()).data?.deposit_charge_id || '__none__');
      await admin.from('booking_events').delete().eq('booking_id', bookingId);
      await admin.from('notifications').delete().eq('related_id', bookingId);
      await admin.from('bookings').delete().eq('id', bookingId);
    }
    await admin.from('users').delete().eq('id', clientId);
    await admin.from('users').delete().eq('id', freelancerId);
    await admin.auth.admin.deleteUser(clientId);
    await admin.auth.admin.deleteUser(freelancerId);
  }
  console.log(`\n${passed} passed, ${failed} failed\nScreenshots: ${SHOTS}/`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
