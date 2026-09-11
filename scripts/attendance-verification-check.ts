// Standalone security check for mutual attendance verification — exercises
// the RLS/RPC boundary in supabase/attendance_verification.sql against a
// real Supabase project using real throwaway auth users, not through the UI.
//
// Usage:
//   pnpm exec tsx --env-file=.env.local scripts/attendance-verification-check.ts
//
// Requires (from .env.local): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. The service-role client is used ONLY to seed
// and tear down test fixtures — every actual confirm/report call goes
// through a normal per-user session, exactly like the app does.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let passCount = 0;
let failCount = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passCount += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failCount += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log('        ', detail);
  }
}

async function createTestUser(role: 'client' | 'freelancer', label: string) {
  const email = `attendance-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'Attendance-Test-Pass-1!';

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw new Error(`Failed to create test user: ${createError?.message}`);

  const client: SupabaseClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`Failed to sign in test user: ${signInError?.message}`);

  const { error: profileError } = await client.from('users').upsert({
    id: created.user.id,
    email,
    full_name: `Attendance Test ${label}`,
    role,
  } as any);
  if (profileError) throw new Error(`Failed to create profile row: ${profileError.message}`);

  return { id: created.user.id, client };
}

function bangkokParts(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
}

async function createBooking(clientId: string, freelancerId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from('bookings')
    .insert({
      client_id: clientId,
      freelancer_id: freelancerId,
      project_name: 'Attendance verification test booking',
      budget: 100,
      status: 'confirmed',
      payment_status: 'deposit_paid',
      ...overrides,
    } as any)
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create test booking: ${error?.message}`);
  return data as any;
}

async function cleanupUser(userId: string) {
  await admin.from('users').delete().eq('id', userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

async function main() {
  console.log('Attendance verification security check\n');

  const client = await createTestUser('client', 'client');
  const freelancer = await createTestUser('freelancer', 'freelancer');
  const outsider = await createTestUser('client', 'outsider');

  try {
    const bangkokNow = bangkokParts(new Date());
    const booking = await createBooking(client.id, freelancer.id, {
      start_date: bangkokNow.date,
      start_time: bangkokNow.time,
    });

    console.log('1. Non-participant cannot confirm attendance');
    {
      const { error } = await outsider.client.rpc('confirm_attendance', { p_booking_id: booking.id });
      check('outsider confirm call fails', Boolean(error), error?.message);
    }

    console.log('2. Direct INSERT into either table is rejected by RLS');
    {
      const { error: confError } = await freelancer.client.from('booking_attendance_confirmations').insert({
        booking_id: booking.id,
        confirmer_id: freelancer.id,
        confirmer_role: 'freelancer',
      } as any);
      check('direct confirmation insert fails', Boolean(confError), confError?.message);

      const { error: reportError } = await client.client.from('attendance_reports').insert({
        booking_id: booking.id,
        reporter_id: client.id,
        reporter_role: 'client',
        reported_user_id: freelancer.id,
        reason: 'freelancer_no_show',
      } as any);
      check('direct report insert fails', Boolean(reportError), reportError?.message);
    }

    console.log('3. Client confirms freelancer presence; duplicate call is idempotent');
    let firstConfirmationId: string | undefined;
    {
      const { data, error } = await client.client.rpc('confirm_attendance', { p_booking_id: booking.id });
      const row = Array.isArray(data) ? data[0] : data;
      check('no error', !error, error?.message);
      check('confirmer_role is client', row?.confirmer_role === 'client', row);
      check('already_confirmed is false on first call', row?.already_confirmed === false, row);
      firstConfirmationId = row?.id;
    }
    {
      const { data, error } = await client.client.rpc('confirm_attendance', { p_booking_id: booking.id });
      const row = Array.isArray(data) ? data[0] : data;
      check('no error on duplicate call', !error, error?.message);
      check('already_confirmed is true on repeat call', row?.already_confirmed === true, row);
      check('same row id returned', row?.id === firstConfirmationId, row);
    }

    console.log('4. Both parties confirming reaches full mutual verification');
    {
      const { error } = await freelancer.client.rpc('confirm_attendance', { p_booking_id: booking.id });
      check('freelancer confirm succeeds', !error, error?.message);

      const { data } = await client.client.from('booking_attendance_confirmations').select('*').eq('booking_id', booking.id);
      const roles = (data || []).map((r: any) => r.confirmer_role).sort();
      check('both client and freelancer confirmations exist', JSON.stringify(roles) === JSON.stringify(['client', 'freelancer']), roles);
    }

    console.log('5. A client cannot submit a freelancer-only reason (schema CHECK)');
    {
      const { error } = await client.client.rpc('submit_attendance_report', {
        p_booking_id: booking.id,
        p_reason: 'client_no_show', // valid only for a freelancer reporter
        p_explanation: 'testing',
      });
      check('mismatched reason is rejected', Boolean(error), error?.message);
    }

    console.log('6. A valid report round-trips its evidence paths');
    {
      const reportBooking = await createBooking(client.id, freelancer.id, {
        start_date: bangkokNow.date,
        start_time: bangkokNow.time,
      });
      const { data, error } = await freelancer.client.rpc('submit_attendance_report', {
        p_booking_id: reportBooking.id,
        p_reason: 'client_no_show',
        p_explanation: 'Client never arrived.',
        p_evidence_paths: ['fake/path/one.jpg', 'fake/path/two.jpg'],
      });
      check('no error', !error, error?.message);
      check('evidence paths round-trip', JSON.stringify(data?.evidence_paths) === JSON.stringify(['fake/path/one.jpg', 'fake/path/two.jpg']), data);
      check('reported_user_id is the client', data?.reported_user_id === client.id, data);

      console.log('7. A non-admin cannot resolve or request evidence on the report');
      {
        const { error: resolveError } = await client.client.rpc('admin_resolve_attendance_report', {
          p_report_id: data.id,
          p_decision: 'reject_report',
        });
        check('non-admin resolve fails', Boolean(resolveError), resolveError?.message);

        const { error: evidenceError } = await client.client.rpc('admin_request_attendance_evidence', { p_report_id: data.id });
        check('non-admin evidence request fails', Boolean(evidenceError), evidenceError?.message);
      }

      await admin.from('bookings').delete().eq('id', reportBooking.id);
    }

    await admin.from('bookings').delete().eq('id', booking.id);
  } finally {
    await cleanupUser(client.id);
    await cleanupUser(freelancer.id);
    await cleanupUser(outsider.id);
  }

  console.log(`\n${passCount} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
