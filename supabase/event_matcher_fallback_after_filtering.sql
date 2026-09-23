-- Supersedes supabase/event_matcher_premium_fallback.sql's approach.
--
-- Problem: that migration made get_event_matcher_candidates() fall back to
-- non-Premium freelancers only when a category has ZERO Premium freelancers
-- in the whole database. But "No providers available for this service yet."
-- in the Event Matcher plan (src/app/pages/EventMatcherPage.tsx) is decided
-- AFTER further filtering by date availability, location coverage, and
-- having a set price - so a category could have one Premium freelancer who
-- is simply busy that day, and clients would still see "no providers",
-- even though a free freelancer nearby is actually available.
--
-- Fix: get_event_matcher_candidates() goes back to strict Premium-only (no
-- database-side fallback). A new get_event_matcher_candidates_any() returns
-- the SAME shape for the same category with NO Premium check at all - the
-- frontend calls it only as a second attempt, after the Premium-only result
-- comes back empty post-filtering (see DataService.getEventMatcherCandidates/
-- getEventMatcherCandidatesAny and EventMatcherPage.tsx). Neither function
-- ever returns a subscription-status field - which call was made, and
-- whether it returned anything, is the only signal, so Premium is still
-- never exposed as a per-freelancer flag or quality score.
--
-- Run this once against your Supabase project's SQL editor, after
-- freelancer_premium.sql and event_matcher_premium_fallback.sql. Safe to
-- re-run.

create or replace function public.get_event_matcher_candidates(p_category text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', fp.id, 'user_id', fp.user_id, 'title', fp.title, 'styles', fp.styles,
    'experience_years', fp.experience_years, 'hourly_rate', fp.hourly_rate,
    'locations', fp.locations, 'studio_locations', fp.studio_locations,
    'users', jsonb_build_object(
      'id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url, 'gender', u.gender,
      'rating', u.rating, 'total_reviews', u.total_reviews,
      'account_status', u.account_status, 'preferred_currency', u.preferred_currency
    )
  )), '[]'::jsonb)
  from public.freelancer_profiles fp
  join public.users u on u.id = fp.user_id
  where auth.uid() is not null
    and fp.title = p_category
    and fp.is_available = true
    and coalesce(fp.visibility, 'public') <> 'limited'
    and coalesce(u.account_status, 'active') = 'active'
    and public.internal_has_active_premium(fp.user_id);
$$;
revoke all on function public.get_event_matcher_candidates(text) from public, anon;
grant execute on function public.get_event_matcher_candidates(text) to authenticated;

-- Identical query, minus the Premium check. Only ever called by the
-- frontend as a fallback after a Premium-only result was empty post-filtering.
create or replace function public.get_event_matcher_candidates_any(p_category text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', fp.id, 'user_id', fp.user_id, 'title', fp.title, 'styles', fp.styles,
    'experience_years', fp.experience_years, 'hourly_rate', fp.hourly_rate,
    'locations', fp.locations, 'studio_locations', fp.studio_locations,
    'users', jsonb_build_object(
      'id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url, 'gender', u.gender,
      'rating', u.rating, 'total_reviews', u.total_reviews,
      'account_status', u.account_status, 'preferred_currency', u.preferred_currency
    )
  )), '[]'::jsonb)
  from public.freelancer_profiles fp
  join public.users u on u.id = fp.user_id
  where auth.uid() is not null
    and fp.title = p_category
    and fp.is_available = true
    and coalesce(fp.visibility, 'public') <> 'limited'
    and coalesce(u.account_status, 'active') = 'active';
$$;
revoke all on function public.get_event_matcher_candidates_any(text) from public, anon;
grant execute on function public.get_event_matcher_candidates_any(text) to authenticated;
