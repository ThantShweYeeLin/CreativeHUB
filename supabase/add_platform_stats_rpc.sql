-- Public, aggregate-only platform stats for the Explore page hero
-- ("500+ Freelancers", "2K+ Bookings", "4.9 Rating").
--
-- bookings has RLS restricting rows to "your own bookings" (schema.sql line
-- ~224), so a plain client-side count query against it returns 0 for every
-- visitor - there's no way to get a real platform-wide booking count without
-- bypassing RLS for this one aggregate number. This function does exactly
-- that and nothing else: it returns three counts, never any individual
-- booking/user/review row, so it's safe to expose to anon/authenticated.

create or replace function public.get_platform_stats()
returns table (freelancer_count bigint, booking_count bigint, avg_rating numeric)
language sql security definer set search_path = public as $$
  select
    (select count(*) from public.users where role = 'freelancer' and account_status = 'active'),
    (select count(*) from public.bookings),
    (select coalesce(avg(rating), 0) from public.reviews);
$$;

grant execute on function public.get_platform_stats() to anon, authenticated;
