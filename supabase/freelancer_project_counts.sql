-- Public aggregate counts for freelancer profile cards.
-- Booking rows remain protected by RLS; this exposes only the two totals.

create or replace function public.get_freelancer_project_counts(p_freelancer_id uuid)
returns table(active_projects bigint, completed_projects bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where status in ('pending', 'confirmed', 'in_progress')),
    count(*) filter (where status = 'completed')
  from public.bookings
  where freelancer_id = p_freelancer_id;
$$;

revoke all on function public.get_freelancer_project_counts(uuid) from public;
grant execute on function public.get_freelancer_project_counts(uuid) to anon, authenticated;
