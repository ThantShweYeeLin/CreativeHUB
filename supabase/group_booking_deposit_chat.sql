-- Group requests: the auto-created team chat now waits for every member's
-- DEPOSIT to be paid, not just for every freelancer to accept (a completed
-- acceptance still leaves each booking unfunded and cancellable within its
-- 24h deposit window, so "the group is really happening" is better judged
-- by paid deposits). bookings has no group_id of its own — it's stamped
-- here at booking-creation time (see src/lib/acceptRequest.ts) from the
-- originating group request's group_id, then read back via the
-- security-definer function below (bookings RLS otherwise only lets a
-- caller see their own bookings, and a group's bookings can each belong to
-- a different freelancer).

alter table public.bookings
  add column if not exists group_id text;

create index if not exists idx_bookings_group_id on public.bookings(group_id) where group_id is not null;

create or replace function public.get_group_booking_members(p_group_id text)
returns table(booking_id uuid, freelancer_id uuid, payment_status text, status text)
language sql
security definer
set search_path = public
stable
as $$
  select id, freelancer_id, payment_status, status
  from public.bookings
  where group_id = p_group_id;
$$;

revoke all on function public.get_group_booking_members(text) from public;
grant execute on function public.get_group_booking_members(text) to authenticated;
