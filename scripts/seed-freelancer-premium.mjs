// Grants Freelancer Premium to a majority of REAL freelancers, per category,
// through the exact same server-only activation function real payments use
// (supabase/freelancer_premium.sql's activate_freelancer_subscription) - not
// a raw table write. One category is deliberately held back entirely so the
// Event Matcher fallback (supabase/event_matcher_premium_fallback.sql) has
// something to demonstrate: "no one here has Premium, so non-Premium
// freelancers fill in."
//
// Never double-grants: the charge id is deterministic per user, and anyone
// who already has an active subscription (from this script or a real
// payment) is skipped entirely, so a real subscriber is never touched.
//
// NOT idempotent in a stronger sense, though: it always grants to 75% of
// whichever freelancers are CURRENTLY not-yet-premium, so re-running it
// keeps adding more (converging toward 100% coverage per category) rather
// than reproducing the same split every time. This is meant as a one-time
// demo seed, not a repeated top-up job - if you add freelancers later and
// want the same ~75%-covered/25%-held-out shape, edit GRANT_FRACTION/HOLD_
// OUT_CATEGORY and reason about the category's new total before re-running.
//
// Usage: pnpm exec tsx --env-file=.env.local scripts/seed-freelancer-premium.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOLD_OUT_CATEGORY = 'Cake/Dessert Maker';
const GRANT_FRACTION = 0.75;

async function main() {
  const { data: profiles, error: pErr } = await admin.from('freelancer_profiles').select('user_id, title, is_available, visibility');
  if (pErr) throw pErr;

  const { data: users, error: uErr } = await admin.from('users').select('id, account_status').eq('role', 'freelancer');
  if (uErr) throw uErr;
  const activeUserIds = new Set(users.filter((u) => (u.account_status || 'active') === 'active').map((u) => u.id));

  const { data: existingSubs } = await admin.from('freelancer_subscriptions').select('user_id, current_period_end');
  const now = Date.now();
  const alreadyPremium = new Set((existingSubs || []).filter((s) => new Date(s.current_period_end).getTime() > now).map((s) => s.user_id));

  const eligible = profiles.filter(
    (p) => p.is_available && (p.visibility || 'public') !== 'limited' && activeUserIds.has(p.user_id) && !alreadyPremium.has(p.user_id)
  );

  const byCategory = new Map();
  for (const p of eligible) {
    if (!byCategory.has(p.title)) byCategory.set(p.title, []);
    byCategory.get(p.title).push(p.user_id);
  }

  let granted = 0, held = 0, failed = 0;
  for (const [category, userIds] of byCategory) {
    if (category === HOLD_OUT_CATEGORY) {
      console.log(`${category}: holding out all ${userIds.length} (deliberately no Premium — fallback demo category)`);
      held += userIds.length;
      continue;
    }
    const targetCount = Math.round(userIds.length * GRANT_FRACTION);
    const toGrant = userIds.slice(0, targetCount);
    console.log(`${category}: granting Premium to ${toGrant.length}/${userIds.length}`);
    for (const userId of toGrant) {
      const chargeId = `seed-bulk-premium-${userId}`;
      const { error } = await admin.rpc('activate_freelancer_subscription', {
        p_user: userId,
        p_plan: 'annual',
        p_charge_id: chargeId,
        p_amount_satang: 99900,
      });
      if (error) { failed++; console.log('  FAILED', userId, error.message); }
      else granted++;
    }
    held += userIds.length - toGrant.length;
  }

  console.log(`\nDone: granted ${granted}, left free ${held}, failed ${failed}`);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
