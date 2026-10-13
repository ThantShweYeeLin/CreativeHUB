-- Trust level (src/lib/trustLevel.ts) now deducts points for bookings a
-- freelancer cancelled themselves - but "Users can update own bookings"/
-- "Users see own bookings" RLS (schema.sql) restricts bookings rows to
-- their own client_id/freelancer_id, so a prospective client browsing a
-- freelancer's PUBLIC profile can't see that freelancer's booking rows at
-- all. Computing the count client-side from a direct bookings query
-- silently returns 0 for every viewer except the freelancer themselves (or
-- the specific client on that booking) - the one audience the trust badge
-- actually needs to warn never sees the deduction. Same shape of fix as
-- get_platform_stats() (add_platform_stats_rpc.sql): an aggregate-only
-- count, safe to expose to anyone, since it never returns a single
-- booking's own details.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create or replace function public.get_freelancer_cancellation_count(p_freelancer_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.bookings
  where freelancer_id = p_freelancer_id
    and status = 'cancelled'
    and cancelled_by = p_freelancer_id;
$$;

revoke all on function public.get_freelancer_cancellation_count(uuid) from public;
grant execute on function public.get_freelancer_cancellation_count(uuid) to anon, authenticated;
