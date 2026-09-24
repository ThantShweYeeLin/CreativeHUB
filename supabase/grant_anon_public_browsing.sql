-- Re-opens READ access to the `anon` role for exactly the data the now
-- guest-browsable pages (Explore, Map, For You, freelancer profiles, public
-- posts - see src/app/App.tsx) need, after supabase/lock_down_anonymous_access.sql
-- correctly revoked ALL anon table access (it had found 15 tables,
-- including every column of public.users, readable by anyone with just the
-- public anon key). This migration is deliberately narrow: every table
-- below gets either an explicit safe-column allow-list, or an explicit
-- sensitive-column deny-list, never a blanket `select *` grant on anything
-- that also holds private data. Nothing else anon could reach before this
-- (messages, bookings, payments, admin data, ...) is touched - those stay
-- exactly as locked down as lock_down_anonymous_access.sql left them.
--
-- The matching frontend change (src/lib/dataService.ts) already stopped
-- asking for email/phone/precise-location in every query these pages use,
-- so the columns granted here line up with what the app actually requests.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

-- Aggregate-only platform stats (Explore hero numbers) - re-grants what
-- lock_down_anonymous_access.sql intentionally stripped from anon; the
-- function itself was always safe (security definer, counts only, never a
-- row - see supabase/add_platform_stats_rpc.sql).
grant execute on function public.get_platform_stats() to anon;

-- USERS: allow-list only. Never email, phone, or the client-only
-- onboarding/behavioural fields (client_type, client_interests, ...) -
-- those stay unreachable for anon regardless of which row is visible.
-- Deliberately NOT including location_latitude/longitude/place_id: this
-- table has no role-scoped column grants (RLS is row-only), and this same
-- grant would then also hand out a CLIENT's precise coordinates (a
-- freelancer's business location is meant to be discoverable; a client's
-- isn't). src/lib/dataService.ts's getAllFreelancers() already retries
-- without those 3 columns on a permission error (originally built for an
-- older schema without them), so Explore/the freelancer list still work
-- for anon - only the Map page's exact pin placement is unavailable to a
-- logged-out visitor, which is the acceptable trade-off here.
DO $$ BEGIN
  CREATE POLICY "Public can view active users" ON public.users FOR SELECT TO anon
    USING (coalesce(account_status, 'active') = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

grant select (
  id, full_name, avatar_url, gender, pronouns, rating, total_reviews, location,
  role, account_status, created_at, preferred_currency
) on public.users to anon;

-- FREELANCER_PROFILES: explicit allow-list, matching
-- DataService.getPublicFreelancerProfile/getPublicFreelancerById exactly -
-- NEVER the three payout/bank columns from freelancer_billing_info.sql, or
-- the ML embedding columns from ai_style_matching.sql (no display purpose).
--
-- IMPORTANT: `grant select on <table> to anon` followed by
-- `revoke select (sensitive_col) on <table> from anon` does NOT work in
-- Postgres - a table-level SELECT grant covers every column independently
-- of any column-level revoke, so the revoke is a silent no-op and the
-- "excluded" columns stay fully readable. An earlier version of this
-- migration had exactly that bug and leaked real freelancers' bank details
-- to anon; the sole allow-list grant below is the only form that actually
-- restricts columns. If you ran that earlier version, re-running this
-- corrected file fixes it (Postgres grants aren't additive across replays -
-- the old accidental table-level grant needs to be removed too):
revoke select on public.freelancer_profiles from anon;

DO $$ BEGIN
  CREATE POLICY "Public can view listed freelancer profiles" ON public.freelancer_profiles FOR SELECT TO anon
    USING (coalesce(visibility, 'public') <> 'limited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

grant select (
  id, user_id, title, description, hourly_rate, skills, styles, locations,
  experience_years, experience_level, portfolio_count, is_available, visibility,
  working_hours_start, working_hours_end, working_days, studio_name, studio_locations,
  contact_preference, pricing_type, min_price, max_price, service_area_type,
  service_radius_km, requirements, limitation_days, limitation_note,
  minor_category, minor_categories, minor_category_experience_levels, performer_type,
  phone_verified, identity_status, created_at, updated_at
) on public.freelancer_profiles to anon;

-- PORTFOLIOS / SOCIAL_LINKS: a freelancer's own public showcase content,
-- no PII of any kind.
DO $$ BEGIN
  CREATE POLICY "Public can view portfolios" ON public.portfolios FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public can view social links" ON public.social_links FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select on public.portfolios to anon;
grant select on public.social_links to anon;

-- REVIEWS: rating/comment tied to ids only - reviewer identity is resolved
-- through the users grant above (name/avatar only, never email).
DO $$ BEGIN
  CREATE POLICY "Public can view reviews" ON public.reviews FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select on public.reviews to anon;

-- SKILLS / FREELANCER_SKILLS: a normalized taxonomy + which freelancer
-- picked which skill. No PII.
DO $$ BEGIN
  CREATE POLICY "Public can view skills" ON public.skills FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public can view freelancer skills" ON public.freelancer_skills FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select on public.skills to anon;
grant select on public.freelancer_skills to anon;

-- CLIENT_POSTS (the For You feed + public post links): published only.
-- Author identity again resolves through the users grant above.
DO $$ BEGIN
  CREATE POLICY "Public can view published posts" ON public.client_posts FOR SELECT TO anon
    USING (is_published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select on public.client_posts to anon;

-- Engagement counts (likes/comments/saves/shares) on those published posts -
-- just linking ids, so a guest sees real counts instead of every post
-- reading zero engagement.
DO $$ BEGIN
  CREATE POLICY "Public can view post likes" ON public.client_post_likes FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public can view post comments" ON public.client_post_comments FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public can view post saves" ON public.client_post_saves FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public can view post shares" ON public.client_post_shares FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select (post_id, user_id) on public.client_post_likes to anon;
grant select (post_id) on public.client_post_comments to anon;
grant select (post_id, user_id) on public.client_post_saves to anon;
grant select (post_id) on public.client_post_shares to anon;

-- FOLLOWERS: only used for a follower/following COUNT on a public profile.
DO $$ BEGIN
  CREATE POLICY "Public can view follow edges" ON public.followers FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select on public.followers to anon;

-- FREELANCER_BLOCKED_DATES: which dates a freelancer isn't available, for
-- their public profile's calendar. DataService.getFreelancerBlockedDates
-- is select('*') and shared with the freelancer's own dashboard (which
-- shows `reason` to themself), so it's granted here too rather than
-- forking that query into a guest-only variant for one optional field.
DO $$ BEGIN
  CREATE POLICY "Public can view blocked dates" ON public.freelancer_blocked_dates FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
grant select on public.freelancer_blocked_dates to anon;
