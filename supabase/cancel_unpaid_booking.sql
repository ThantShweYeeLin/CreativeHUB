-- Lets either party cancel a booking that's still awaiting its deposit
-- (status='pending', payment_status='unpaid') instead of only ever being
-- able to wait out the 24h deadline for reconcile_booking_escrow to
-- auto-annul it (supabase/booking_annulled_reconcile.sql). No money has
-- moved yet at this stage - there's no refund/compensation policy to
-- apply (contrast with supabase/booking_cancellation_policy.sql, which is
-- specifically for a booking whose deposit IS already paid) - this is
-- just an earlier, intentional version of the exact same system-driven
-- annulment, so it reuses that same 'annulled' terminal status rather
-- than introducing a new one. bookings_no_overlap (booking_overlap_protection.sql)
-- is already scoped to status in ('pending','confirmed'), so flipping
-- status to 'annulled' releases the time slot immediately with no
-- separate step - confirmed against that constraint's own definition, and
-- against isRangeAvailable/isTimeSlotTaken (src/lib/availability.ts),
-- which already treat 'annulled' as inactive.
--
-- Callable directly by either participant (unlike the deposit-paid
-- cancellation flow, there's no provider/payment call involved, so no
-- reason this needs to go through the server at all).
--
-- Run this once against your Supabase project's SQL editor, after
-- booking_overlap_protection.sql and booking_annulled_reconcile.sql
-- already exist. Safe to re-run.

create or replace function public.cancel_unpaid_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_role text;
  v_reason text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
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

  -- Already annulled/cancelled (this call or the 24h auto-annul racing it) -
  -- idempotent return, not an error.
  if v_booking.status in ('annulled', 'cancelled') then
    return v_booking;
  end if;

  if v_booking.status <> 'pending' or v_booking.payment_status <> 'unpaid' then
    raise exception 'This booking already has a deposit involved and can no longer be cancelled this way';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'Cancelled by ' || v_role || ' before the deposit was paid');

  update public.bookings set
    status = 'annulled',
    cancelled_by = v_uid,
    cancelled_at = now(),
    cancellation_reason = v_reason
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, v_role, 'annulled', v_reason);

  insert into public.notifications (user_id, actor_id, type, title, message, related_id) values
    (
      v_booking.client_id, v_uid, 'booking_cancelled', 'Booking cancelled',
      case when v_role = 'client'
        then 'You cancelled this booking before the deposit was paid.'
        else 'The freelancer cancelled this booking before the deposit was paid.'
      end,
      p_booking_id
    ),
    (
      v_booking.freelancer_id, v_uid, 'booking_cancelled', 'Booking cancelled',
      case when v_role = 'freelancer'
        then 'You cancelled this booking before the deposit was paid — the time slot is available again.'
        else 'The client cancelled this booking before paying the deposit — the time slot is available again.'
      end,
      p_booking_id
    );

  return v_booking;
end;
$$;

revoke all on function public.cancel_unpaid_booking(uuid, text) from public;
grant execute on function public.cancel_unpaid_booking(uuid, text) to authenticated;
