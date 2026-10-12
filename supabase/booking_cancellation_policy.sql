-- Replaces DataService.cancelBooking's single client-side UPDATE (always a
-- flat 100% refund, no server verification, no real provider refund call -
-- see server/src/routes/payments.ts, server/src/lib/cancellationPolicy.ts)
-- with a tiered policy based on how close the event is:
--   >7 days out  -> 100% refund to client
--   3-7 days out -> 50% refund / 50% released to freelancer as compensation
--   <72 hours    -> 0% refund, full deposit released to freelancer
-- Freelancer-initiated cancellation is always the 100% tier, regardless of
-- date (never goes through quoteCancellation at all - the server forces it).
--
-- Calling the payment provider and updating the booking are two operations
-- that can each fail independently (network blip, crash, retry, two tabs
-- clicking Cancel at once) - so this is a claim -> provider call -> finalize
-- sequence, not a single update:
--   1. claim_booking_cancellation (this file) - the one lock point. Either
--      returns an already-cancelled booking as-is (idempotent), refuses if
--      not eligible, returns an EXISTING unfinished claim unchanged (first
--      claim's quote is binding - a slow retry can never land a different
--      tier than the attempt already in flight), or writes a fresh claim.
--      Validates the amounts/tier/role itself rather than trusting the
--      caller's arithmetic, even though only service_role can call it.
--   2. The server calls Omise/the demo refund (server/src/routes/payments.ts)
--      ONLY if the claim is fresh and has no cancellation_refund_id yet, and
--      writes cancellation_refund_id the instant that call succeeds - this
--      is the durable proof-of-refund write, independent of step 3, so a
--      crash between steps 2 and 3 is recoverable (retry sees refund_id
--      already set and skips straight to finalize, never re-refunding).
--   3. finalize_booking_cancellation (this file) - refuses to finalize a
--      refund-owed cancellation until cancellation_refund_id is set, so it
--      can never mark a refund "complete" that didn't actually happen.
--      Copies the claim into the confirmed cancellation_* columns (kept
--      separate from the claim_* columns on purpose - a claim is a
--      recorded decision, the confirmed columns are only ever written once
--      that decision's payment outcome is proven).
--
-- Run this once against your Supabase project's SQL editor, after
-- booking_escrow.sql, booking_cancellation.sql, booking_deposit_omise.sql,
-- and prevent_duplicate_active_booking_request.sql already exist. Safe to
-- re-run.

alter table public.bookings
  add column if not exists cancellation_claim_id uuid,
  add column if not exists cancellation_claimed_by uuid references auth.users(id),
  add column if not exists cancellation_claimed_at timestamptz,
  add column if not exists cancellation_claim_reason text,
  add column if not exists cancellation_claim_tier text,
  add column if not exists cancellation_claim_refund_amount numeric(10,2),
  add column if not exists cancellation_claim_compensation_amount numeric(10,2),
  add column if not exists cancellation_refund_id text,
  add column if not exists cancellation_tier text,
  add column if not exists cancellation_refund_amount numeric(10,2),
  add column if not exists cancellation_compensation_amount numeric(10,2);

create or replace function public.claim_booking_cancellation(
  p_booking_id uuid, p_actor_id uuid, p_actor_role text, p_reason text,
  p_tier text, p_refund_amount numeric, p_compensation_amount numeric
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  -- Already finished (by this or a concurrent request) - idempotent return,
  -- never re-claim or re-refund an already-cancelled booking.
  if v_booking.status = 'cancelled' then
    return v_booking;
  end if;

  if v_booking.status <> 'confirmed' or v_booking.payment_status <> 'deposit_paid' or v_booking.dispute_status <> 'none' then
    raise exception 'This booking can no longer be cancelled this way';
  end if;

  -- An unfinished claim already exists (this request is a retry, or lost a
  -- race to a concurrent one) - the first claim's quote is what's binding,
  -- so it's returned unchanged rather than overwritten with fresh numbers.
  if v_booking.cancellation_claim_id is not null then
    return v_booking;
  end if;

  if p_actor_role not in ('client', 'freelancer') then
    raise exception 'Invalid actor role';
  end if;
  if p_tier not in ('full_refund', 'partial_refund', 'no_refund') then
    raise exception 'Invalid cancellation tier';
  end if;
  if p_refund_amount < 0 or p_compensation_amount < 0 then
    raise exception 'Refund/compensation amounts cannot be negative';
  end if;
  if v_booking.deposit_amount is not null
     and round(p_refund_amount + p_compensation_amount, 2) <> round(v_booking.deposit_amount, 2) then
    raise exception 'Refund and compensation amounts do not add up to the deposit';
  end if;

  update public.bookings set
    cancellation_claim_id = gen_random_uuid(),
    cancellation_claimed_by = p_actor_id,
    cancellation_claimed_at = now(),
    cancellation_claim_reason = p_reason,
    cancellation_claim_tier = p_tier,
    cancellation_claim_refund_amount = p_refund_amount,
    cancellation_claim_compensation_amount = p_compensation_amount
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.claim_booking_cancellation(uuid, uuid, text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.claim_booking_cancellation(uuid, uuid, text, text, text, numeric, numeric) to service_role;

create or replace function public.finalize_booking_cancellation(p_booking_id uuid, p_claim_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_payment_status text;
  v_title text;
  v_client_message text;
  v_freelancer_message text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  -- Already finalized (this or a concurrent/retried call) - no duplicate
  -- booking_events row or notifications.
  if v_booking.status = 'cancelled' then
    return v_booking;
  end if;

  if v_booking.cancellation_claim_id is null or v_booking.cancellation_claim_id <> p_claim_id then
    raise exception 'This claim no longer matches the booking''s current cancellation attempt';
  end if;

  -- A refund is owed but the provider hasn't confirmed it yet - refuse to
  -- mark this cancelled. The server retries the provider call, then
  -- finalize, without ever creating a second claim.
  if v_booking.cancellation_claim_refund_amount > 0 and v_booking.cancellation_refund_id is null then
    raise exception 'The refund has not been confirmed yet';
  end if;

  v_payment_status := case v_booking.cancellation_claim_tier
    when 'full_refund' then 'refunded'
    when 'no_refund' then 'paid'
    else 'partially_refunded'
  end;

  update public.bookings set
    status = 'cancelled',
    cancelled_by = v_booking.cancellation_claimed_by,
    cancelled_at = now(),
    cancellation_reason = v_booking.cancellation_claim_reason,
    cancellation_tier = v_booking.cancellation_claim_tier,
    cancellation_refund_amount = v_booking.cancellation_claim_refund_amount,
    cancellation_compensation_amount = v_booking.cancellation_claim_compensation_amount,
    payment_status = v_payment_status
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, case when v_booking.cancelled_by = v_booking.client_id then 'client' else 'freelancer' end, 'cancelled', v_booking.cancellation_reason);

  v_title := 'Booking cancelled';
  if v_booking.cancellation_tier = 'full_refund' then
    v_client_message := format('Your %s deposit was fully refunded.', to_char(v_booking.cancellation_refund_amount, 'FM999,999,999')  || ' THB');
    v_freelancer_message := 'This booking was cancelled more than 7 days before the event — the full deposit was refunded to the client.';
  elsif v_booking.cancellation_tier = 'partial_refund' then
    v_client_message := format('This booking was cancelled 3–7 days before the event — %s THB was refunded to you and %s THB was released to the freelancer as cancellation compensation.', to_char(v_booking.cancellation_refund_amount, 'FM999,999,999'), to_char(v_booking.cancellation_compensation_amount, 'FM999,999,999'));
    v_freelancer_message := format('This booking was cancelled 3–7 days before the event — %s THB was released to you as cancellation compensation.', to_char(v_booking.cancellation_compensation_amount, 'FM999,999,999'));
  else
    v_client_message := format('This booking was cancelled within 72 hours of the event, so the %s THB deposit was not refunded.', to_char(v_booking.cancellation_compensation_amount, 'FM999,999,999'));
    v_freelancer_message := format('This booking was cancelled within 72 hours of the event — the full %s THB deposit was released to you as cancellation compensation.', to_char(v_booking.cancellation_compensation_amount, 'FM999,999,999'));
  end if;

  if v_booking.cancelled_by = v_booking.freelancer_id then
    v_freelancer_message := 'You cancelled this booking. The client''s deposit was fully refunded.';
    v_client_message := format('The freelancer cancelled this booking. Your %s THB deposit was fully refunded.', to_char(v_booking.cancellation_refund_amount, 'FM999,999,999'));
  end if;

  insert into public.notifications (user_id, actor_id, type, title, message, related_id) values
    (v_booking.client_id, v_booking.cancelled_by, 'booking_cancelled', v_title, v_client_message, p_booking_id),
    (v_booking.freelancer_id, v_booking.cancelled_by, 'booking_cancelled', v_title, v_freelancer_message, p_booking_id);

  return v_booking;
end;
$$;

revoke all on function public.finalize_booking_cancellation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_booking_cancellation(uuid, uuid) to service_role;

-- A convenience the server uses right after a provider refund succeeds -
-- the durable proof-of-refund write that step 2 above depends on. Scoped to
-- this specific claim so a stale/foreign write can never attach to a
-- different cancellation attempt.
create or replace function public.record_booking_cancellation_refund(p_booking_id uuid, p_claim_id uuid, p_refund_id text)
returns public.bookings
language sql
security definer
set search_path = public
as $$
  update public.bookings
    set cancellation_refund_id = p_refund_id
    where id = p_booking_id and cancellation_claim_id = p_claim_id and cancellation_refund_id is null
    returning *;
$$;

revoke all on function public.record_booking_cancellation_refund(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_booking_cancellation_refund(uuid, uuid, text) to service_role;

-- "Unfinished" (prevent_duplicate_active_booking_request.sql) now also
-- excludes a partially-refunded cancellation - it's just as finished as a
-- full refund or a full release, only the split differs.
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
    and b.payment_status not in ('paid', 'refunded', 'partially_refunded')
    and b.status <> 'annulled'
    and not (b.status = 'cancelled' and b.cancellation_reason = 'deposit_not_paid')
    and not (b.payment_status is distinct from 'deposit_paid' and b.deposit_deadline is not null and b.deposit_deadline < now())
  );
$$;

revoke all on function public.has_unfinished_booking_between(uuid, uuid) from public;
grant execute on function public.has_unfinished_booking_between(uuid, uuid) to authenticated, service_role;

-- Same reasoning for "can this booking still be rescheduled" (booking_reschedule_availability.sql).
create or replace function public.propose_booking_reschedule(
  p_booking_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_role text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_updated public.bookings%rowtype;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.client_id = v_uid then
    v_role := 'client';
  elsif v_booking.freelancer_id = v_uid then
    v_role := 'freelancer';
  else
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.status not in ('pending', 'confirmed')
     or v_booking.payment_status in ('paid', 'refunded', 'partially_refunded') then
    raise exception 'This booking can no longer be rescheduled.';
  end if;

  if v_booking.reschedule_proposed_start_at is not null then
    raise exception 'A new time is already waiting for a response. Withdraw it first to propose another.';
  end if;

  perform public.check_reschedule_window(p_booking_id, v_booking.freelancer_id, p_start_at, p_end_at);

  update public.bookings b set
    reschedule_proposed_start_at = p_start_at,
    reschedule_proposed_end_at = p_end_at,
    reschedule_proposed_by = v_uid,
    reschedule_proposed_reason = v_reason
  where b.id = p_booking_id
  returning b.* into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, v_role, 'reschedule_proposed', v_reason);

  return v_updated;
end;
$$;

revoke all on function public.propose_booking_reschedule(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.propose_booking_reschedule(uuid, timestamptz, timestamptz, text) to authenticated;
