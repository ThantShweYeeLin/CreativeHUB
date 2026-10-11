-- Wires booking deposits through the same Omise/demo payment pipeline
-- already built for Freelancer Premium (server/src/lib/demoPayments.ts,
-- server/src/routes/subscriptions.ts), replacing DataService.payBookingDeposit's
-- direct client-side payment_status flip - which trusted the browser's word
-- that a deposit was paid, with no charge, token, or verification behind it
-- at all. See server/src/lib/bookingDepositCharges.ts for the JS-side half
-- of this (metadata/amount/currency/paid checks against the fetched charge).
--
-- deposit_charge_id records which Omise/demo charge actually paid the
-- deposit, the same role subscription_payments.omise_charge_id plays for
-- Premium. A partial unique index (only enforced once set) means the same
-- charge id can never be attributed to two different bookings, while every
-- pre-existing/unpaid booking's column stays null.
alter table public.bookings
  add column if not exists deposit_charge_id text;

create unique index if not exists bookings_deposit_charge_id_key
  on public.bookings (deposit_charge_id)
  where deposit_charge_id is not null;

-- Mirrors activate_freelancer_subscription's shape and idempotency pattern:
-- callable only by the server's service-role key (never a client directly),
-- and trusts the amount/booking id it's given because the caller already
-- verified the charge against Omise's own API before calling this - except
-- for the amount, which is cheap enough to re-check independently here too
-- (escrow money gets the extra layer). Safe to call any number of times,
-- concurrently, with the same charge id: the first call grants the deposit,
-- every later one (a redelivered webhook racing /confirm) is a no-op that
-- returns the booking unchanged.
create or replace function public.confirm_booking_deposit_paid(
  p_booking_id uuid, p_charge_id text, p_amount_satang integer, p_card_label text
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

  -- Same charge confirmed twice (webhook + /confirm both firing, or a
  -- redelivered webhook) - return the current row, grant nothing twice.
  if v_booking.deposit_charge_id = p_charge_id then
    return v_booking;
  end if;

  -- A deposit already secured by a DIFFERENT charge should never happen -
  -- checkout only ever creates one charge per booking's one unpaid deposit
  -- window. Refuse rather than silently overwrite which charge is of
  -- record for this booking.
  if v_booking.deposit_charge_id is not null then
    raise exception 'This booking''s deposit is already paid by a different charge';
  end if;

  if v_booking.deposit_amount is not null
     and p_amount_satang <> round(v_booking.deposit_amount * 100) then
    raise exception 'Charged amount does not match this booking''s deposit amount';
  end if;

  update public.bookings
    set status = 'confirmed',
        payment_status = 'deposit_paid',
        deposit_paid_via = p_card_label,
        deposit_charge_id = p_charge_id
    where id = p_booking_id
    returning * into v_booking;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, 'client', 'deposit_paid', 'Paid via ' || p_card_label);

  insert into public.notifications (user_id, actor_id, type, title, message, related_id)
    values (
      v_booking.freelancer_id, v_booking.client_id, 'booking_deposit_paid',
      'Deposit received',
      'Transferred the deposit — the booking is now confirmed.',
      p_booking_id
    );

  return v_booking;
end;
$$;

revoke all on function public.confirm_booking_deposit_paid(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_booking_deposit_paid(uuid, text, integer, text) to service_role;
