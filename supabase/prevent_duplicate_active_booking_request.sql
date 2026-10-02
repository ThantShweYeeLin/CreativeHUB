-- "Can't send a new request to someone you already have an unfinished
-- booking with" was only ever enforced in DataService.createBookingRequests
-- (client-side JS) - which covers direct profile bookings, Event Assistant,
-- and the client-direct Group Request flow, since they all funnel through
-- that one function. It does NOT cover apply_to_group_opportunity (the
-- Open Group Request apply flow, freelancer_premium.sql) at all - a
-- freelancer could still apply to a client's open role even with an active
-- unfinished booking with that same client, since that function inserts
-- into public.requests directly and never went through the JS check. It
-- was also trivially bypassable from anywhere via a direct API call, since
-- nothing enforced it at the database layer.
--
-- A single BEFORE INSERT trigger on public.requests closes both gaps at
-- once: apply_to_group_opportunity inserts into requests too, so it's
-- automatically covered without needing its own separate check, and no
-- future request-creation path can skip this by missing a client-side call.
-- Deliberately NOT restricted to the authenticated/anon roles the way
-- prevent_role_self_escalation.sql is - unlike that trigger, this one is
-- meant to apply even to apply_to_group_opportunity's own security-definer
-- insert, not let it bypass the rule.
--
-- "Unfinished" mirrors src/lib/bookingEscrow.ts's getBookingEscrowState:
-- everything except released (payment_status 'paid'), refunded, or
-- annulled (either the explicit status, the legacy cancelled+reason
-- combination, or a lapsed unpaid deposit past its deadline) counts.
--
-- Run this once against your Supabase project's SQL editor, after
-- schema.sql and booking_escrow.sql already exist. Safe to re-run.

create or replace function public.has_unfinished_booking_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where (
      (b.client_id = p_user_a and b.freelancer_id = p_user_b)
      or (b.client_id = p_user_b and b.freelancer_id = p_user_a)
    )
    and b.payment_status not in ('paid', 'refunded')
    and b.status <> 'annulled'
    and not (b.status = 'cancelled' and b.cancellation_reason = 'deposit_not_paid')
    and not (b.payment_status is distinct from 'deposit_paid' and b.deposit_deadline is not null and b.deposit_deadline < now())
  );
$$;

revoke all on function public.has_unfinished_booking_between(uuid, uuid) from public;
grant execute on function public.has_unfinished_booking_between(uuid, uuid) to authenticated, service_role;

create or replace function public.prevent_duplicate_active_booking_request()
returns trigger
language plpgsql
as $$
begin
  if public.has_unfinished_booking_between(NEW.client_id, NEW.freelancer_id) then
    raise exception 'You already have an unfinished booking with this person. Finish or resolve it before sending a new request.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists prevent_duplicate_active_booking_request_trigger on public.requests;
create trigger prevent_duplicate_active_booking_request_trigger
  before insert on public.requests
  for each row
  execute function public.prevent_duplicate_active_booking_request();
