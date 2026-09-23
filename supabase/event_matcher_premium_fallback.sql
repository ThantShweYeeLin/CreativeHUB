-- Event Matcher: if a category has NO Premium freelancer at all, fill in
-- with everyone else who otherwise qualifies for it, so a client is never
-- shown an empty category purely because nobody there has bought Premium
-- yet. When at least one Premium freelancer exists for the category, the
-- result is unchanged (Premium-only, exactly as freelancer_premium.sql
-- shipped it) — this only ever ADDS a fallback tier, never removes the
-- Premium-first behavior or any other matching criteria (availability,
-- location, budget, style — all still applied afterward in
-- src/lib/eventMatcher.ts exactly as before).
--
-- Run this once against your Supabase project's SQL editor, after
-- freelancer_premium.sql. Safe to re-run.

create or replace function public.get_event_matcher_candidates(p_category text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', fp.id, 'user_id', fp.user_id, 'title', fp.title, 'styles', fp.styles,
      'experience_years', fp.experience_years, 'hourly_rate', fp.hourly_rate,
      'locations', fp.locations, 'studio_locations', fp.studio_locations,
      'users', jsonb_build_object(
        'id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url, 'gender', u.gender,
        'rating', u.rating, 'total_reviews', u.total_reviews,
        'account_status', u.account_status, 'preferred_currency', u.preferred_currency
      )
    ) as c
    from public.freelancer_profiles fp
    join public.users u on u.id = fp.user_id
    where fp.title = p_category
      and fp.is_available = true
      and coalesce(fp.visibility, 'public') <> 'limited'
      and coalesce(u.account_status, 'active') = 'active'
      and public.internal_has_active_premium(fp.user_id)
  ) premium;

  if jsonb_array_length(v_result) = 0 then
    select coalesce(jsonb_agg(c), '[]'::jsonb) into v_result
    from (
      select jsonb_build_object(
        'id', fp.id, 'user_id', fp.user_id, 'title', fp.title, 'styles', fp.styles,
        'experience_years', fp.experience_years, 'hourly_rate', fp.hourly_rate,
        'locations', fp.locations, 'studio_locations', fp.studio_locations,
        'users', jsonb_build_object(
          'id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url, 'gender', u.gender,
          'rating', u.rating, 'total_reviews', u.total_reviews,
          'account_status', u.account_status, 'preferred_currency', u.preferred_currency
        )
      ) as c
      from public.freelancer_profiles fp
      join public.users u on u.id = fp.user_id
      where fp.title = p_category
        and fp.is_available = true
        and coalesce(fp.visibility, 'public') <> 'limited'
        and coalesce(u.account_status, 'active') = 'active'
    ) fallback;
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_event_matcher_candidates(text) from public, anon;
grant execute on function public.get_event_matcher_candidates(text) to authenticated;
