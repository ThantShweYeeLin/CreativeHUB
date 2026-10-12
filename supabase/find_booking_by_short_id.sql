-- Every booking tracking page displays its id as "#" + the first 8 hex
-- characters of the real UUID (useBookingTracking.ts) — that's the only
-- "booking ID" a client can actually copy, so MyTicketsPage.tsx's ticket
-- form needs to resolve it to the real booking (DataService.getBookingByReference).
--
-- PostgREST can't do this with a plain .ilike() filter: `id` is a uuid
-- column, and Postgres has no ILIKE operator for uuid without an explicit
-- cast (`operator does not exist: uuid ~~* unknown`) — confirmed directly
-- against the live database. This RPC does that cast server-side instead.
--
-- security definer only to make the cast possible, not to widen who can
-- see what: scoped to the caller being a participant on the matched row,
-- the exact same boundary RLS already applies to looking a booking up by
-- its full id.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create or replace function public.find_booking_by_short_id(p_prefix text)
returns public.bookings
language sql
stable
security definer
set search_path = public
as $$
  select * from public.bookings
  where id::text ilike p_prefix || '%'
    and (client_id = auth.uid() or freelancer_id = auth.uid())
  limit 1;
$$;

revoke all on function public.find_booking_by_short_id(text) from public;
grant execute on function public.find_booking_by_short_id(text) to authenticated;
