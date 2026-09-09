// Standalone security check for the booking check-in feature — exercises
// the RLS/RPC boundary in supabase/booking_checkin.sql against a real
// Supabase project using two throwaway auth users, not through the UI.
//
// Usage:
//   pnpm exec tsx --env-file=.env.local scripts/checkin-security-check.ts
//
// Requires (from .env.local): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. The service-role client is used ONLY to seed
// and tear down test fixtures — every actual check-in call goes through a
// normal per-user session, exactly like the app does.

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
  const email = `checkin-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'Checkin-Test-Pass-1!';

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`Failed to create test user: ${createError?.message}`);

  const client: SupabaseClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`Failed to sign in test user: ${signInError?.message}`);

  const { error: profileError } = await client.from('users').upsert({
    id: created.user.id,
    email,
    full_name: `Check-in Test ${label}`,
    role,
  } as any);
  if (profileError) throw new Error(`Failed to create profile row: ${profileError.message}`);

  return { id: created.user.id, client };
}

async function createBooking(clientId: string, freelancerId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from('bookings')
    .insert({
      client_id: clientId,
      freelancer_id: freelancerId,
      project_name: 'Check-in security test booking',
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
  console.log('Booking check-in security check\n');

  const client = await createTestUser('client', 'client');
  const freelancer = await createTestUser('freelancer', 'freelancer');
  const outsider = await createTestUser('client', 'outsider');

  const bookingLat = 13.7563;
  const bookingLng = 100.5018; // Bangkok

  // start_date/start_time are naive wall-clock values with no stored
  // timezone; checkin_to_booking() interprets them as Asia/Bangkok (this
  // app's default locale — see the RPC's comment), so build "now" in that
  // same civil-time frame rather than the test runner's own local time.
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

  try {
    // --- Fixture: an active, in-window booking with a real location. ---
    const bangkokNow = bangkokParts(new Date());
    const booking = await createBooking(client.id, freelancer.id, {
      start_date: bangkokNow.date,
      start_time: bangkokNow.time,
      location_lat: bookingLat,
      location_lng: bookingLng,
      location_address: 'Test Studio, Bangkok',
    });

    console.log('1. Non-participant is rejected');
    {
      const { error } = await outsider.client.rpc('checkin_to_booking', {
        p_booking_id: booking.id,
        p_lat: bookingLat,
        p_lng: bookingLng,
      });
      check('outsider check-in call fails', Boolean(error), error?.message);
    }

    console.log('2. Forged "I am here" coordinates far from the venue resolve outside_area, not verified');
    {
      const { data, error } = await client.client.rpc('checkin_to_booking', {
        p_booking_id: booking.id,
        p_lat: bookingLat + 1, // ~111km away
        p_lng: bookingLng,
      });
      const row = Array.isArray(data) ? data[0] : data;
      check('no error', !error, error?.message);
      check('check_in_status is outside_area', row?.check_in_status === 'outside_area', row);
      check('location_verified is false', row?.location_verified === false, row);
      check('response has no lat/lng fields', row && !('latitude' in row) && !('longitude' in row), row);
    }

    console.log('3. Direct INSERT into booking_check_ins is rejected by RLS');
    {
      const { error } = await freelancer.client.from('booking_check_ins').insert({
        booking_id: booking.id,
        user_id: freelancer.id,
        role: 'freelancer',
        check_in_status: 'verified',
        location_verified: true,
      } as any);
      check('direct insert fails', Boolean(error), error?.message);
    }

    console.log('4. Legitimate check-in near the venue verifies, and a repeat call returns the same row');
    let firstCheckInId: string | undefined;
    {
      const { data, error } = await freelancer.client.rpc('checkin_to_booking', {
        p_booking_id: booking.id,
        p_lat: bookingLat + 0.0002, // ~20m away
        p_lng: bookingLng,
      });
      const row = Array.isArray(data) ? data[0] : data;
      check('no error', !error, error?.message);
      check('check_in_status is verified', row?.check_in_status === 'verified', row);
      check('location_verified is true', row?.location_verified === true, row);
      check('already_checked_in is false on first call', row?.already_checked_in === false, row);
      firstCheckInId = row?.id;
    }
    {
      const { data, error } = await freelancer.client.rpc('checkin_to_booking', {
        p_booking_id: booking.id,
        p_lat: bookingLat,
        p_lng: bookingLng,
      });
      const row = Array.isArray(data) ? data[0] : data;
      check('no error on duplicate call', !error, error?.message);
      check('already_checked_in is true on repeat call', row?.already_checked_in === true, row);
      check('same row id returned', row?.id === firstCheckInId, row);
    }

    console.log('5. Too-early check-in is rejected');
    {
      const future = bangkokParts(new Date(Date.now() + 6 * 60 * 60 * 1000)); // 6h from now
      const earlyBooking = await createBooking(client.id, freelancer.id, {
        start_date: future.date,
        start_time: future.time,
        location_lat: bookingLat,
        location_lng: bookingLng,
      });
      const { error } = await client.client.rpc('checkin_to_booking', {
        p_booking_id: earlyBooking.id,
        p_lat: bookingLat,
        p_lng: bookingLng,
      });
      check('early check-in fails', Boolean(error), error?.message);
      check('error message explains the open time', Boolean(error?.message?.includes('Check-in opens at')), error?.message);
      await admin.from('bookings').delete().eq('id', earlyBooking.id);
    }

    console.log('6. Check-in on a cancelled booking is rejected');
    {
      const cancelledBooking = await createBooking(client.id, freelancer.id, { status: 'cancelled' });
      const { error } = await client.client.rpc('checkin_to_booking', {
        p_booking_id: cancelledBooking.id,
        p_lat: bookingLat,
        p_lng: bookingLng,
      });
      check('cancelled-booking check-in fails', Boolean(error), error?.message);
      await admin.from('bookings').delete().eq('id', cancelledBooking.id);
    }

    console.log('7. The other participant can read check-in rows, but never any coordinate field');
    {
      const { data, error } = await client.client.from('booking_check_ins').select('*').eq('booking_id', booking.id);
      check('client can read the freelancer check-in row', !error && (data?.length || 0) > 0, error?.message);
      const hasCoordFields = (data || []).some((row: any) => 'latitude' in row || 'longitude' in row || 'lat' in row || 'lng' in row);
      check('no row exposes a coordinate field', !hasCoordFields, data);
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
