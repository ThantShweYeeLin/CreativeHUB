// One-time follow-up to scripts/seed-freelancer-premium.mjs: grants
// Freelancer Premium to most of the remaining non-Premium, available
// freelancers, through the same real activation RPC real payments use
// (activate_freelancer_subscription) - not a raw table write.
//
// Unlike the first seed, this one does NOT hold out any category. The
// original 100%-free "Cake/Dessert Maker" hold-out was there to demo the
// Premium-fallback behavior, but that fallback is now location/date-aware
// (supabase/event_matcher_fallback_after_filtering.sql +
// event_matcher_category_alias_tolerance.sql), so an entire zero-Premium
// category is no longer needed to show it off - and it was actively
// hurting the demo by making every Cake/Dessert Maker match a free
// freelancer with no Premium alternative to pick from.
//
// A small number of freelancers per category (roughly 1-2, or ~25% for
// Cake/Dessert Maker) are deliberately left non-Premium so the
// Premium-then-free-fallback path stays demonstrable everywhere, not just
// removed entirely.
//
// Same non-idempotency caveat as the first seed: this always grants to
// whichever freelancers are CURRENTLY not-yet-premium, so re-running it
// keeps converging more of them toward Premium rather than reproducing the
// same split. Meant as a one-time top-up, not a repeated job.
//
// Usage: pnpm exec tsx --env-file=.env.local scripts/grant-more-premium.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// How many of each category's currently-non-Premium, available freelancers
// to LEAVE FREE (not grant), so the fallback stays demonstrable.
const DEFAULT_HOLD_OUT = 1;
const HOLD_OUT_OVERRIDES = { 'Cake/Dessert Maker': 2 };

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
    const holdOut = Math.min(userIds.length, HOLD_OUT_OVERRIDES[category] ?? DEFAULT_HOLD_OUT);
    const toGrant = userIds.slice(0, userIds.length - holdOut);
    console.log(`${category}: granting Premium to ${toGrant.length}/${userIds.length} (holding out ${holdOut})`);
    for (const userId of toGrant) {
      const chargeId = `grant-more-premium-${userId}`;
      const { error } = await admin.rpc('activate_freelancer_subscription', {
        p_user: userId,
        p_plan: 'annual',
        p_charge_id: chargeId,
        p_amount_satang: 99900,
      });
      if (error) { failed++; console.log('  FAILED', userId, error.message); }
      else granted++;
    }
    held += holdOut;
  }

  console.log(`\nDone: granted ${granted}, left free ${held}, failed ${failed}`);
}

main().catch((error) => {
  console.error('Grant failed:', error);
  process.exit(1);
});
