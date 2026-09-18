// Seeds throwaway accounts + fixtures for tests/ticket-safety-and-lifecycle.spec.ts
// and prints the exact env var assignments to export before running it.
// Safe to re-run — deletes and recreates its own fixtures each time (matched
// by email prefix / a fixed marker in descriptions), never touches anything
// else.
//
// Usage:
//   pnpm exec tsx --env-file=.env.local scripts/seed-ticket-test-accounts.mjs
//
// Requires (from .env.local): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PASSWORD = 'TicketE2E-Test-Pass-1!';
const MARKER = 'seed-ticket-e2e';

async function upsertAuthUser(emailSuffix) {
  const email = `${MARKER}-${emailSuffix}@example.com`;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    return existing.id;
  }
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !created.user) throw new Error(`Failed to create ${email}: ${error?.message}`);
  return created.user.id;
}

async function upsertProfile(id, fields) {
  const { error } = await admin.from('users').upsert({ id, onboarding_completed: true, ...fields }, { onConflict: 'id' });
  if (error) throw new Error(`Failed to upsert profile ${id}: ${error.message}`);
}

// Matches scripts/attendance-verification-check.ts's own helper — the
// attendance window is computed from start_date/start_time in the
// booking's local (Bangkok) civil time, not UTC.
function bangkokParts(instant) {
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
  const get = (type) => parts.find((p) => p.type === type).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
}

async function main() {
  const userId = await upsertAuthUser('user');
  const otherUserId = await upsertAuthUser('other-user');
  const freelancerId = await upsertAuthUser('freelancer');
  const adminId = await upsertAuthUser('admin');

  await upsertProfile(userId, { email: `${MARKER}-user@example.com`, full_name: 'Ticket E2E User', role: 'client' });
  await upsertProfile(otherUserId, { email: `${MARKER}-other-user@example.com`, full_name: 'Ticket E2E Other User', role: 'client' });
  await upsertProfile(freelancerId, { email: `${MARKER}-freelancer@example.com`, full_name: 'Ticket E2E Freelancer', role: 'freelancer' });
  await upsertProfile(adminId, { email: `${MARKER}-admin@example.com`, full_name: 'Ticket E2E Admin', role: 'admin' });

  // Clear out any tickets/bookings from a previous run so ids stay fresh
  // and statuses aren't left over from the last pass.
  await admin.from('support_tickets').delete().eq('user_id', userId);
  await admin.from('support_tickets').delete().eq('user_id', otherUserId);
  await admin.from('bookings').delete().eq('client_id', userId).eq('freelancer_id', freelancerId);

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      client_id: userId,
      freelancer_id: freelancerId,
      project_name: 'Ticket E2E test booking',
      budget: 100,
      status: 'confirmed',
      payment_status: 'deposit_paid',
    })
    .select()
    .single();
  if (bookingError || !booking) throw new Error(`Failed to create booking: ${bookingError?.message}`);

  // A second booking, scheduled "now" so its attendance window is open —
  // for tests/attendance-verification.spec.ts, which needs the Attendance
  // Check card's Confirm/Report controls actually visible, not just a
  // deposit-secured booking sitting outside its window.
  await admin.from('bookings').delete().eq('client_id', userId).eq('freelancer_id', freelancerId).eq('project_name', 'Attendance E2E test booking');
  const bangkokNow = bangkokParts(new Date());
  const { data: attendanceBooking, error: attendanceBookingError } = await admin
    .from('bookings')
    .insert({
      client_id: userId,
      freelancer_id: freelancerId,
      project_name: 'Attendance E2E test booking',
      budget: 100,
      status: 'confirmed',
      payment_status: 'deposit_paid',
      start_date: bangkokNow.date,
      start_time: bangkokNow.time,
    })
    .select()
    .single();
  if (attendanceBookingError || !attendanceBooking) throw new Error(`Failed to create attendance booking: ${attendanceBookingError?.message}`);

  async function createTicket(uid, status) {
    const { data, error } = await admin
      .from('support_tickets')
      .insert({ user_id: uid, category: 'technical', description: `Ticket E2E fixture ticket (${status})` })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to create ticket: ${error?.message}`);
    return data;
  }

  const openTicket = await createTicket(userId, 'open');
  const closedTicketRow = await createTicket(userId, 'closed');
  const resolvedTicketRow = await createTicket(userId, 'resolved');
  const otherUserTicket = await createTicket(otherUserId, 'open');

  // Drive the lifecycle through the same RPCs the app uses (not a raw
  // update), signed in as the seeded admin, so this is a faithful fixture.
  const adminClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { error: signInError } = await adminClient.auth.signInWithPassword({ email: `${MARKER}-admin@example.com`, password: PASSWORD });
  if (signInError) throw new Error(`Failed to sign in seeded admin: ${signInError.message}`);
  await adminClient.rpc('admin_update_ticket_status', { p_ticket_id: closedTicketRow.id, p_status: 'closed' });
  await adminClient.rpc('admin_update_ticket_status', { p_ticket_id: resolvedTicketRow.id, p_status: 'resolved' });

  console.log('\nSeed complete. Export these before running the Playwright ticket spec:\n');
  console.log(`export TICKET_TEST_EMAIL="${MARKER}-user@example.com"`);
  console.log(`export TICKET_TEST_PASSWORD="${PASSWORD}"`);
  console.log(`export TICKET_TEST_OPEN_ID="${openTicket.id}"`);
  console.log(`export TICKET_TEST_CLOSED_ID="${closedTicketRow.id}"`);
  console.log(`export TICKET_TEST_RESOLVED_ID="${resolvedTicketRow.id}"`);
  console.log(`export TICKET_ADMIN_EMAIL="${MARKER}-admin@example.com"`);
  console.log(`export TICKET_ADMIN_PASSWORD="${PASSWORD}"`);
  console.log(`export TICKET_TEST_BOOKING_ID="${booking.id}"`);
  console.log(`export TICKET_TEST_OTHER_USER_TICKET_ID="${otherUserTicket.id}"`);

  console.log('\nFor tests/attendance-verification.spec.ts (run separately - it also needs BASE_URL if not http://localhost:5173):\n');
  console.log(`export ATTENDANCE_CHECK_URL="http://localhost:5173/booking/${attendanceBooking.id}"`);
  console.log(`export ATTENDANCE_CHECK_EMAIL="${MARKER}-user@example.com"`);
  console.log(`export ATTENDANCE_CHECK_PASSWORD="${PASSWORD}"`);
  console.log(`export ATTENDANCE_CHECK_ROLE="client"`);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
