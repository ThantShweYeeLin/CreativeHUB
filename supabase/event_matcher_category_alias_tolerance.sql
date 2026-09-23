-- Something outside this repo (a scheduled reseed / branch sync on the
-- Supabase project, not any script here) keeps resetting
-- freelancer_profiles.title and skills.name for these two categories back
-- to their old labels ('Decorator', 'Musician') even after
-- rename_decorator_category.sql / rename_musician_category.sql are re-run
-- live - confirmed by re-applying the rename and watching it revert within
-- minutes with no app code or migration involved.
--
-- Rather than keep re-patching data that won't stay renamed, make
-- get_event_matcher_candidates() / get_event_matcher_candidates_any() match
-- either label, so the Event Matcher works no matter which one is live at
-- any given moment. Supersedes event_matcher_fallback_after_filtering.sql's
-- function bodies (same shape, only the WHERE clause changes).
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

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
    and (
      fp.title = p_category
      or (p_category = 'Decorators' and fp.title = 'Decorator')
      or (p_category = 'Musicians' and fp.title = 'Musician')
    )
    and fp.is_available = true
    and coalesce(fp.visibility, 'public') <> 'limited'
    and coalesce(u.account_status, 'active') = 'active'
    and public.internal_has_active_premium(fp.user_id);
$$;
revoke all on function public.get_event_matcher_candidates(text) from public, anon;
grant execute on function public.get_event_matcher_candidates(text) to authenticated;

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
    and (
      fp.title = p_category
      or (p_category = 'Decorators' and fp.title = 'Decorator')
      or (p_category = 'Musicians' and fp.title = 'Musician')
    )
    and fp.is_available = true
    and coalesce(fp.visibility, 'public') <> 'limited'
    and coalesce(u.account_status, 'active') = 'active';
$$;
revoke all on function public.get_event_matcher_candidates_any(text) from public, anon;
grant execute on function public.get_event_matcher_candidates_any(text) to authenticated;
