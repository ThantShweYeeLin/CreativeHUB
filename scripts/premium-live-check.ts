// LIVE verification of Freelancer Premium against the real Supabase project in
// .env.local, using real authenticated sessions for isolated, throwaway
// accounts (premium-live-<runid>-*@example.com) that are deleted at the end.
//
//   pnpm run test:premium-live
//
// What is real:    Supabase Auth sessions, RLS, grants, the RPCs, the requests/
//                  bookings tables, the deployed React UI (Playwright).
// What is NOT real: Omise. No Omise keys are configured, so the server router
//                  is exercised against a FAKE charge object (its real
//                  requireAuth + real service-role activation still run).
//                  Subscriptions in the journey are created through the same
//                  server-only activation function the server calls.
//
// It refuses to run if a subscription exists for a non-test account, so it
// can never notify a real Premium freelancer. It only writes rows belonging to
// its own test accounts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
// @ts-ignore - express lives in server/node_modules
import express from '../server/node_modules/express/index.js';
import { createSubscriptionsRouter, PLANS } from '../server/src/routes/subscriptions.js';
import { requireAuth } from '../server/src/lib/requireAuth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RUN = Date.now().toString(36);
const PREFIX = `premium-live-${RUN}`;
const PASSWORD = `Pj-${RUN}-Test-Pass-1!`;
const SHOTS = `docs/premium-live-screenshots/${RUN}`;
const EVENT_DATE = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const OPP_TITLE = `Journey check ${RUN}`;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });

let passed = 0, failed = 0;
const skipped: string[] = [];
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; failures.push(name); console.log(`  FAIL  ${name}`, detail === undefined ? '' : JSON.stringify(detail)?.slice(0, 300)); }
}
function skip(name: string, why: string) { skipped.push(`${name} — ${why}`); console.log(`  SKIP  ${name} (${why})`); }
const msg = (r: { error?: { message?: string } | null }) => r.error?.message || '';
const denied = (r: { error?: { message?: string } | null }) => /permission denied|not found in the schema cache|Could not find the function/i.test(msg(r));

interface Actor { id: string; email: string; db: SupabaseClient; }
const created: string[] = [];

async function makeUser(tag: string, role: 'client' | 'freelancer', profile?: { title: string; lat: number; lng: number; city: string }): Promise<Actor> {
  const email = `${PREFIX}-${tag}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  const id = data.user.id;
  created.push(id);
  const up = await admin.from('users').upsert({ id, email, full_name: `${PREFIX} ${tag}`, role, onboarding_completed: true, account_status: 'active' } as any);
  if (up.error) throw new Error(`users upsert ${tag}: ${up.error.message}`);
  if (profile) {
    const fp = await admin.from('freelancer_profiles').insert({
      user_id: id, title: profile.title, is_available: true, visibility: 'public', experience_years: 3, hourly_rate: 1000,
      locations: [{ city: profile.city, latitude: profile.lat, longitude: profile.lng, formattedAddress: `${profile.city}, Thailand` }],
    } as any);
    if (fp.error) throw new Error(`freelancer_profiles insert ${tag}: ${fp.error.message}`);
  }
  const db = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const si = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (si.error) throw new Error(`signIn ${tag}: ${si.error.message}`);
  return { id, email, db };
}

const activate = (userId: string, plan: 'monthly' | 'annual', charge: string) =>
  admin.rpc('activate_freelancer_subscription', { p_user: userId, p_plan: plan, p_charge_id: `${charge}-${RUN}`, p_amount_satang: PLANS[plan].amountSatang });

async function main() {
  console.log(`\nEnvironment : LIVE Supabase project ${new URL(SUPABASE_URL).host} (the only project this repo has — no separate staging)`);
  console.log(`Test run    : ${RUN}   accounts: ${PREFIX}-*@example.com (deleted at the end)   event date: ${EVENT_DATE}\n`);

  // Safety: never run while a real freelancer holds a subscription.
  const { data: existing } = await admin.from('freelancer_subscriptions').select('user_id');
  if ((existing || []).length > 0) {
    const ids = (existing || []).map((r: any) => r.user_id);
    const { data: owners } = await admin.from('users').select('email').in('id', ids);
    if ((owners || []).some((u: any) => !String(u.email).startsWith('premium-live-'))) {
      throw new Error('A real (non-test) account has a Premium subscription — refusing to run so no real user is notified.');
    }
  }

  const BKK = { lat: 13.75, lng: 100.49, city: 'Bangkok' };
  const C1 = await makeUser('client1', 'client');
  const C2 = await makeUser('client2', 'client');
  const F1 = await makeUser('f1-active', 'freelancer', { title: 'Makeup Artist', ...BKK });
  const F2 = await makeUser('f2-free', 'freelancer', { title: 'Makeup Artist', ...BKK });
  const F3 = await makeUser('f3-expired', 'freelancer', { title: 'Makeup Artist', ...BKK });
  const F4 = await makeUser('f4-cancelled', 'freelancer', { title: 'Makeup Artist', ...BKK });
  const F5 = await makeUser('f5-photographer', 'freelancer', { title: 'Photographer', ...BKK });
  const F6 = await makeUser('f6-phuket', 'freelancer', { title: 'Makeup Artist', lat: 7.93, lng: 98.35, city: 'Phuket' });
  const F7 = await makeUser('f7-server-buyer', 'freelancer', { title: 'Makeup Artist', ...BKK });

  // ============ PHASE 1 — live database ============
  console.log('Phase 1a — schema present on the live database');
  for (const t of ['freelancer_subscriptions', 'subscription_payments', 'notification_preferences', 'group_opportunities', 'group_opportunity_roles', 'group_opportunity_applications']) {
    const r = await admin.from(t).select('*', { count: 'exact', head: true });
    check(`table ${t} exists`, !r.error, msg(r));
  }

  console.log('Phase 1b — only the trusted server can activate Premium');
  let r: any = await F1.db.rpc('activate_freelancer_subscription', { p_user: F1.id, p_plan: 'annual', p_charge_id: 'forged', p_amount_satang: 1 });
  check('a signed-in user cannot call activate_freelancer_subscription', denied(r), msg(r));
  r = await anon.rpc('activate_freelancer_subscription', { p_user: F1.id, p_plan: 'annual', p_charge_id: 'forged', p_amount_satang: 1 });
  check('an anonymous caller cannot call activate_freelancer_subscription', denied(r), msg(r));
  r = await F1.db.from('freelancer_subscriptions').insert({ user_id: F1.id, plan: 'annual', current_period_end: '2099-01-01' });
  check('a user cannot insert their own subscription row', !!r.error, msg(r));
  r = await F1.db.rpc('internal_has_active_premium', { p_user: F1.id });
  check('a user cannot call the internal entitlement check', denied(r), msg(r));
  r = await F1.db.from('group_opportunity_applications').insert({ opportunity_id: crypto.randomUUID(), role_id: crypto.randomUUID(), freelancer_id: F1.id, proposed_price: 1 });
  check('a user cannot insert an application directly', !!r.error, msg(r));
  r = await F1.db.from('group_opportunities').insert({ client_id: F1.id, title: 'sneaky', event_date: EVENT_DATE });
  check('a user cannot insert an opportunity directly (must use the RPC)', !!r.error, msg(r));

  console.log('Phase 1c — anonymous access to the new surface');
  for (const t of ['freelancer_subscriptions', 'subscription_payments', 'notification_preferences', 'group_opportunities', 'group_opportunity_roles', 'group_opportunity_applications']) {
    r = await anon.from(t).select('*').limit(1);
    check(`anon cannot read ${t}`, !!r.error || (r.data || []).length === 0, msg(r));
  }
  for (const fn of ['get_group_opportunities', 'get_my_group_applications', 'get_event_matcher_candidates', 'create_group_opportunity']) {
    r = await anon.rpc(fn, fn === 'get_event_matcher_candidates' ? { p_category: 'Makeup Artist' } : fn === 'create_group_opportunity' ? { p_payload: {} } : {});
    check(`anon cannot call ${fn}`, denied(r), msg(r));
  }

  console.log('Phase 1d — free / active / expired / cancelled subscriptions (real sessions)');
  // Test setup only: seed subscriptions through the server-only activation function.
  for (const [u, plan] of [[F1, 'monthly'], [F3, 'monthly'], [F4, 'monthly'], [F5, 'monthly'], [F6, 'monthly']] as const) {
    const a = await activate(u.id, plan, `seed-${u.email}`);
    if (a.error) throw new Error(`activation seed failed: ${a.error.message}`);
  }
  await admin.from('freelancer_subscriptions').update({ current_period_end: new Date(Date.now() - 86400000).toISOString() }).eq('user_id', F3.id);
  r = await F4.db.rpc('cancel_my_subscription');
  check('a subscriber can cancel their own subscription', !r.error, msg(r));
  const f4sub = (await admin.from('freelancer_subscriptions').select('*').eq('user_id', F4.id).single()).data as any;
  check('cancelled = status cancelled, period end still in the future', f4sub.status === 'cancelled' && new Date(f4sub.current_period_end) > new Date());
  r = await F2.db.rpc('cancel_my_subscription');
  check('cancelling with no subscription is rejected', /No active subscription/.test(msg(r)), msg(r));

  const mySub = async (a: Actor) => (await a.db.from('freelancer_subscriptions').select('*')).data || [];
  check('each user reads only their own subscription row', (await mySub(F1)).length === 1 && (await mySub(F2)).length === 0 && (await mySub(C1)).length === 0);
  check('a user cannot read anyone else\'s payment records', ((await F1.db.from('subscription_payments').select('*')).data || []).every((p: any) => p.user_id === F1.id));

  const listErr = async (a: Actor) => msg(await a.db.rpc('get_group_opportunities'));
  check('free user is refused discovery (PREMIUM_REQUIRED)', /PREMIUM_REQUIRED/.test(await listErr(F2)));
  check('expired subscriber is refused discovery', /PREMIUM_REQUIRED/.test(await listErr(F3)));
  check('active subscriber is allowed discovery', (await listErr(F1)) === '');
  check('cancelled-but-unexpired subscriber is still allowed', (await listErr(F4)) === '');

  // ============ PHASE 3 — journey, steps 1-2 ============
  console.log('Phase 3 (1) — client creates an open Group Request');
  const created1 = await C1.db.rpc('create_group_opportunity', { p_payload: {
    title: OPP_TITLE, description: 'Live verification request', event_date: EVENT_DATE, start_time: '10:00', end_time: '16:00',
    location_city: 'Bangkok', location_text: 'Secret Address 12, Bangkok', location_lat: BKK.lat, location_lng: BKK.lng,
    roles: [{ category: 'Makeup Artist', budget: 5000, currency: 'THB', slots: 1 }, { category: 'Photographer', budget: 9000, currency: 'THB', slots: 2 }],
  } });
  check('client can post an open request with two roles', !created1.error && !!created1.data, msg(created1));
  const oppId = created1.data as string;
  const roles = ((await C1.db.from('group_opportunity_roles').select('*').eq('opportunity_id', oppId)).data || []) as any[];
  const makeupRole = roles.find((x) => x.category === 'Makeup Artist');
  const photoRole = roles.find((x) => x.category === 'Photographer');
  check('the owner can read their own opportunity and roles', roles.length === 2 && !!makeupRole && !!photoRole);

  console.log('Phase 3 (2) — eligible Premium freelancers were notified');
  const oppNotifs = ((await admin.from('notifications').select('user_id, actor_id, message').eq('type', 'opportunity_new').eq('related_id', oppId)).data || []) as any[];
  const notified = new Set(oppNotifs.map((n) => n.user_id));
  check('active (F1), cancelled-unexpired (F4) Makeup Artists and the Photographer (F5) were notified', [F1, F4, F5].every((f) => notified.has(f.id)), [...notified]);
  check('free (F2), expired (F3), out-of-area (F6), both clients and the buyer-to-be (F7) were not', [F2, F3, F6, F7, C1, C2].every((f) => !notified.has(f.id)));
  check('each freelancer got exactly one notification', oppNotifs.length === new Set(oppNotifs.map((n) => n.user_id)).size);
  check('notification carries no client identity (no actor, no name)', oppNotifs.every((n) => n.actor_id === null && !String(n.message).includes(PREFIX)));
  const f1Inbox = ((await F1.db.from('notifications').select('type')).data || []) as any[];
  check('the freelancer can read that notification with their own session', f1Inbox.some((n) => n.type === 'opportunity_new'));

  console.log('Phase 1e — privacy: who can see what');
  check("another client cannot read the opportunity, its roles, or any applications", ((await C2.db.from('group_opportunities').select('id')).data || []).length === 0
    && ((await C2.db.from('group_opportunity_roles').select('id')).data || []).length === 0
    && ((await C2.db.from('group_opportunity_applications').select('id')).data || []).length === 0);
  check('a freelancer cannot read the raw opportunity table (client_id / address stay hidden)', ((await F1.db.from('group_opportunities').select('id')).data || []).length === 0);
  const listF1 = await F1.db.rpc('get_group_opportunities');
  const mine = ((listF1.data || []) as any[]).find((o) => o.id === oppId);
  check('the discovery list shows the opportunity to the eligible freelancer', !!mine, msg(listF1));
  check('list never exposes client_id, exact address, coordinates or subscription info',
    !/(client_id|Secret Address|location_lat|location_lng|location_text|subscription|premium)/i.test(JSON.stringify(listF1.data)));
  check('detail view is equally sanitized', !/(client_id|Secret Address|location_lat|location_lng|subscription|premium)/i.test(JSON.stringify((await F1.db.rpc('get_group_opportunity', { p_opportunity_id: oppId })).data)));
  const prefsRead = await F2.db.from('notification_preferences').select('*');
  check("a user cannot read other users' notification preferences", (prefsRead.data || []).length === 0);

  console.log('Phase 1f — eligibility of the request itself');
  check('free user cannot open the detail', /PREMIUM_REQUIRED/.test(msg(await F2.db.rpc('get_group_opportunity', { p_opportunity_id: oppId }))));
  check('free user cannot apply', /PREMIUM_REQUIRED/.test(msg(await F2.db.rpc('apply_to_group_opportunity', { p_role_id: makeupRole.id, p_price: 4000, p_message: 'x' }))));
  check('expired subscriber cannot apply', /PREMIUM_REQUIRED/.test(msg(await F3.db.rpc('apply_to_group_opportunity', { p_role_id: makeupRole.id, p_price: 4000, p_message: 'x' }))));
  check('a Premium freelancer outside the area sees nothing and cannot apply', ((await F6.db.rpc('get_group_opportunities')).data || []).length === 0
    && /NOT_ELIGIBLE/.test(msg(await F6.db.rpc('apply_to_group_opportunity', { p_role_id: makeupRole.id, p_price: 4000, p_message: 'x' }))));
  check('a Premium photographer cannot apply to the makeup role', /NOT_ELIGIBLE/.test(msg(await F5.db.rpc('apply_to_group_opportunity', { p_role_id: makeupRole.id, p_price: 4000, p_message: 'x' }))));
  check('the client cannot apply to their own request', /own request/.test(msg(await C1.db.rpc('apply_to_group_opportunity', { p_role_id: makeupRole.id, p_price: 4000, p_message: 'x' }))));
  const photoDetail = ((await F5.db.rpc('get_group_opportunity', { p_opportunity_id: oppId })).data as any);
  check('the photographer sees only the photographer role as eligible', photoDetail?.roles?.filter((x: any) => x.eligible).map((x: any) => x.category).join() === 'Photographer');

  console.log('Phase 1g — application uniqueness (two simultaneous applications from the same freelancer)');
  const opp3 = await C1.db.rpc('create_group_opportunity', { p_payload: { title: `${OPP_TITLE} (race)`, event_date: EVENT_DATE, location_city: 'Bangkok', location_lat: BKK.lat, location_lng: BKK.lng, roles: [{ category: 'Makeup Artist', budget: 2000, slots: 5 }] } });
  const raceRole = ((await C1.db.from('group_opportunity_roles').select('id').eq('opportunity_id', opp3.data as string)).data || [])[0] as any;
  const [a1, a2] = await Promise.all([
    F4.db.rpc('apply_to_group_opportunity', { p_role_id: raceRole.id, p_price: 1900, p_message: 'race 1' }),
    F4.db.rpc('apply_to_group_opportunity', { p_role_id: raceRole.id, p_price: 1900, p_message: 'race 2' }),
  ]);
  check('exactly one of two concurrent applications succeeds', [a1, a2].filter((x) => !x.error).length === 1, [msg(a1), msg(a2)]);
  check('the loser is told ALREADY_APPLIED', [a1, a2].some((x) => /ALREADY_APPLIED/.test(msg(x))), [msg(a1), msg(a2)]);
  const f4apps = ((await admin.from('group_opportunity_applications').select('id, request_id').eq('freelancer_id', F4.id)).data || []) as any[];
  const f4reqs = ((await admin.from('requests').select('id').eq('freelancer_id', F4.id)).data || []) as any[];
  check('one application row and no orphan request exists', f4apps.length === 1 && f4reqs.length === 1, { apps: f4apps.length, reqs: f4reqs.length });

  // ============ PHASE 3 — steps 3-5 through the real UI ============
  console.log('Phase 3 (3-5) — freelancer applies and client accepts through the real UI');
  mkdirSync(SHOTS, { recursive: true });
  const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 7000));
  const pw = (part: string) => {
    try {
      execFileSync('npx', ['playwright', 'test', 'tests/premium-journey.spec.ts', '--reporter=line'], {
        stdio: 'pipe',
        env: { ...process.env, PJ_PART: part, PJ_PASSWORD: PASSWORD, PJ_FREELANCER_EMAIL: F1.email, PJ_CLIENT_EMAIL: C1.email, PJ_OPP_TITLE: OPP_TITLE, PJ_FREELANCER_NAME: `${PREFIX} f1-active`, PJ_SHOTS: SHOTS },
      });
      return null;
    } catch (e: any) { return String(e.stdout || e.message).slice(-1800); }
  };
  try {
    const partA = pw('A');
    check('UI: freelancer sees Premium active, finds the request and applies', partA === null, partA);

    const f1Apps = ((await admin.from('group_opportunity_applications').select('id, request_id, proposed_price').eq('freelancer_id', F1.id)).data || []) as any[];
    check('exactly one application for F1 with the price they entered', f1Apps.length === 1 && Number(f1Apps[0].proposed_price) === 4800, f1Apps);
    const req = ((await admin.from('requests').select('*').eq('id', f1Apps[0]?.request_id)).data || [])[0] as any;
    check('the application is a freelancer counter-offer for the client to review', req?.status === 'countered' && req?.counter_by === 'freelancer' && Number(req?.counter_price) === 4800 && req?.client_id === C1.id, req);
    check('the request carries the event date and only the city, never the exact address', String(req?.description).includes(`SCHEDULE_META:${EVENT_DATE}:10:00:16:00`) && !String(req?.description).includes('Secret Address'));
    const clientNotifs1 = ((await admin.from('notifications').select('type').eq('user_id', C1.id)).data || []) as any[];
    check('the client was notified of the application', clientNotifs1.some((n) => n.type === 'group_application_request'));
    check('the client sees the application in their own requests', (((await C1.db.from('requests').select('id').eq('id', req?.id)).data) || []).length === 1);

    const partB = pw('B');
    check('UI: client reviews the offer in My Requests and accepts it', partB === null, partB);

    console.log('Phase 3 (5-6) — the existing request/booking workflow and notifications');
    const req2 = ((await admin.from('requests').select('status, budget').eq('id', req.id)).data || [])[0] as any;
    check('the request is now accepted at the agreed price', req2?.status === 'accepted' && Number(req2?.budget) === 4800, req2);
    const bookings = ((await admin.from('bookings').select('*').eq('client_id', C1.id).eq('freelancer_id', F1.id)).data || []) as any[];
    check('a booking was created through the existing accept flow', bookings.length === 1, bookings.length);
    const bk = bookings[0] || {};
    check('the booking has the agreed price, event date and a locked agreement, awaiting the deposit',
      Number(bk.budget) === 4800 && String(bk.start_date) === EVENT_DATE && bk.status === 'pending' && bk.payment_status === 'unpaid' && Number(bk.confirmed_agreement?.price) === 4800, bk);
    const f1Notifs = ((await admin.from('notifications').select('type, metadata, actor_id').eq('user_id', F1.id)).data || []) as any[];
    const upd = f1Notifs.filter((n) => n.type === 'application_update');
    check('the freelancer got exactly one "accepted" application update, with no client identity', upd.length === 1 && upd[0].metadata?.event === 'accepted' && upd[0].actor_id === null, upd);
    const clientNotifs2 = ((await admin.from('notifications').select('type').eq('user_id', C1.id)).data || []) as any[];
    check('the client was told to pay the deposit (existing flow)', clientNotifs2.some((n) => n.type === 'deposit_payment_required'));
    check('the filled role now reports its spot as taken', (((await F5.db.rpc('get_group_opportunity', { p_opportunity_id: oppId })).data as any)?.roles || []).find((x: any) => x.category === 'Makeup Artist')?.slots_filled === 1);
    check('a second Makeup Artist can no longer apply to the filled role (ROLE_FILLED)', /ROLE_FILLED/.test(msg(await F4.db.rpc('apply_to_group_opportunity', { p_role_id: makeupRole.id, p_price: 4000, p_message: 'late' }))));

    // ============ Expiry ============
    console.log('Phase 3 (7) — expiry does not break accepted commitments');
    await admin.from('freelancer_subscriptions').update({ current_period_end: new Date(Date.now() - 3600000).toISOString() }).eq('user_id', F1.id);
    const apps = ((await F1.db.rpc('get_my_group_applications')).data || []) as any[];
    check('after expiry the accepted application is still listed as accepted', apps.length === 1 && apps[0].request_status === 'accepted', apps);
    check('after expiry the applied opportunity can still be opened', !(await F1.db.rpc('get_group_opportunity', { p_opportunity_id: oppId })).error);
    check('after expiry discovery is closed', /PREMIUM_REQUIRED/.test(await listErr(F1)));
    const created2 = await C1.db.rpc('create_group_opportunity', { p_payload: { title: `${OPP_TITLE} #2`, event_date: EVENT_DATE, location_city: 'Bangkok', location_lat: BKK.lat, location_lng: BKK.lng, roles: [{ category: 'Makeup Artist', budget: 3000 }] } });
    const role2 = ((await C1.db.from('group_opportunity_roles').select('id').eq('opportunity_id', created2.data as string)).data || [])[0] as any;
    check('after expiry a NEW application is refused', /PREMIUM_REQUIRED/.test(msg(await F1.db.rpc('apply_to_group_opportunity', { p_role_id: role2?.id, p_price: 3000, p_message: 'x' }))));
    const nowNotified = ((await admin.from('notifications').select('user_id').eq('type', 'opportunity_new').eq('related_id', created2.data as string)).data || []) as any[];
    check('after expiry the freelancer is no longer sent new-opportunity alerts', !nowNotified.some((n) => n.user_id === F1.id));
    check('the accepted request and the booking are untouched by expiry',
      ((await admin.from('requests').select('status').eq('id', req.id)).data as any[])?.[0]?.status === 'accepted'
      && ((await admin.from('bookings').select('id').eq('id', bk.id)).data || []).length === 1);
    check('the freelancer can still read their booking', (((await F1.db.from('bookings').select('id').eq('id', bk.id)).data) || []).length === 1);

    const partC = pw('C');
    check('UI: after expiry the freelancer sees "expired" but keeps the accepted application', partC === null, partC);
  } finally {
    vite.kill();
    try { execFileSync('pkill', ['-f', 'vite --port 5173']); } catch { /* already gone */ }
  }

  console.log('Phase 1h — Event Matching eligibility (live RPC, real client session)');
  const cand = ((await C1.db.rpc('get_event_matcher_candidates', { p_category: 'Makeup Artist' })).data || []) as any[];
  const candIds = new Set(cand.map((c) => c.user_id));
  const testIds = new Set([F1, F2, F3, F4, F6, F7].map((f) => f.id));
  const ours = cand.filter((c) => testIds.has(c.user_id)).map((c) => c.user_id);
  check('active/cancelled-unexpired (F4) and out-of-area-but-active (F6, filtered later by location) are returned', candIds.has(F4.id) && candIds.has(F6.id), ours);
  check('free (F2), expired (F3, F1 after expiry) and never-subscribed (F7) are NOT returned', [F1, F2, F3, F7].every((f) => !candIds.has(f.id)));
  check('no real (non-test) freelancer without a subscription is returned', cand.every((c) => String(c.users?.full_name || '').startsWith(PREFIX)), cand.filter((c) => !String(c.users?.full_name || '').startsWith(PREFIX)).length);
  check('the candidate shape has no subscription field', !cand.some((c) => Object.keys(c).concat(Object.keys(c.users || {})).some((k) => /premium|subscription|period/i.test(k))));

  // ============ PHASE 2 (server side, Omise faked) ============
  console.log('Phase 2 — server subscription routes: real auth + real live activation, FAKE Omise');
  const fakeCharges: Record<string, any> = {};
  let seq = 0;
  const app = express();
  app.use(express.json());
  app.use(requireAuth);
  app.use('/subscriptions', createSubscriptionsRouter({
    charges: {
      create: async (input: any) => {
        const c = { id: `chrg_fake_${RUN}_${++seq}`, paid: true, status: 'successful', amount: input.amount, currency: input.currency, metadata: input.metadata };
        fakeCharges[c.id] = c; return c;
      },
      retrieve: async (id: string) => fakeCharges[id],
    },
  }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/subscriptions`;
  const token = async (a: Actor) => (await a.db.auth.getSession()).data.session!.access_token;
  const post = async (path: string, a: Actor | null, body: unknown) => {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(a ? { Authorization: `Bearer ${await token(a)}` } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  try {
    let s = await post('/checkout', null, { plan: 'monthly', token: 'tokn_test_x' });
    check('checkout without a session -> 401', s.status === 401);
    s = await post('/checkout', C2, { plan: 'monthly', token: 'tokn_test_x' });
    check('a client account cannot buy Premium -> 403', s.status === 403);
    s = await post('/checkout', F7, { plan: 'monthly', token: 'tokn_test_x', amountSatang: 1 });
    check('monthly checkout (real session, fake Omise charge) activates via the live database', s.status === 200 && s.json.status === 'active', s);
    let sub = (await admin.from('freelancer_subscriptions').select('*').eq('user_id', F7.id).single()).data as any;
    const days = (new Date(sub.current_period_end).getTime() - Date.now()) / 86400000;
    check('the live subscription runs about one month', days > 27 && days < 32, days);
    check('the client-supplied amount was ignored: the charge used the server price', fakeCharges[Object.keys(fakeCharges)[0]].amount === 9900);
    const chargeId = s.json.chargeId as string;
    s = await post('/confirm', F7, { chargeId });
    check('confirming the same charge again does not extend the period', s.status === 200 && ((await admin.from('subscription_payments').select('id').eq('omise_charge_id', chargeId)).data || []).length === 1);
    s = await post('/confirm', C2, { chargeId });
    check("another user cannot claim someone else's charge -> 403", s.status === 403);
    s = await post('/checkout', F7, { plan: 'annual', token: 'tokn_test_x' });
    sub = (await admin.from('freelancer_subscriptions').select('*').eq('user_id', F7.id).single()).data as any;
    const days2 = (new Date(sub.current_period_end).getTime() - Date.now()) / 86400000;
    check('a yearly purchase extends from the end of the running month (~13 months)', s.status === 200 && days2 > 390 && days2 < 400, days2);
    check('newly-activated freelancer can discover open requests', !(await F7.db.rpc('get_group_opportunities')).error);
    s = await post('/cancel', F7, {});
    check('cancel via the server keeps access until the period end', s.status === 200 && (await listErr(F7)) === '');
    check('cancel without a session -> 401', (await post('/cancel', null, {})).status === 401);
  } finally { server.close(); }

  skip('Omise test-mode checkout: monthly & yearly', 'OMISE_SECRET_KEY / VITE_OMISE_PUBLIC_KEY are empty — no Omise test keys configured');
  skip('Omise: declined card, abandoned checkout, 3-D Secure redirect + return', 'needs Omise test keys and test cards');
  skip('Omise: server re-fetch of a real charge', 'needs Omise test keys (the router logic is covered with a fake charge)');
}

async function cleanup() {
  console.log('\nCleaning up test data…');
  try {
    const { data: reqs } = await admin.from('requests').select('id').in('client_id', created);
    const reqIds = (reqs || []).map((x: any) => x.id);
    if (reqIds.length) await admin.from('request_offers').delete().in('request_id', reqIds);
    await admin.from('notifications').delete().in('user_id', created);
    await admin.from('bookings').delete().in('client_id', created);
    await admin.from('group_opportunities').delete().in('client_id', created);
    await admin.from('requests').delete().in('client_id', created);
    await admin.from('subscription_payments').delete().in('user_id', created);
    await admin.from('freelancer_subscriptions').delete().in('user_id', created);
    await admin.from('notification_preferences').delete().in('user_id', created);
    await admin.from('freelancer_profiles').delete().in('user_id', created);
    for (const id of created) await admin.auth.admin.deleteUser(id);
    const { data: left } = await admin.from('users').select('id').like('email', `${PREFIX}%`);
    console.log(left && left.length ? `  WARNING: ${left.length} leftover test users` : '  all test accounts and rows removed');
  } catch (e) { console.log('  cleanup error:', (e as Error).message); }
}

main()
  .catch((e) => { failed++; failures.push(`fatal: ${e.message}`); console.error('\nFATAL:', e); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} passed, ${failed} failed, ${skipped.length} skipped`);
    if (failures.length) console.log('Failed:\n - ' + failures.join('\n - '));
    if (skipped.length) console.log('Skipped:\n - ' + skipped.join('\n - '));
    console.log(`Screenshots: ${SHOTS}/`);
    process.exit(failed ? 1 : 0);
  });
