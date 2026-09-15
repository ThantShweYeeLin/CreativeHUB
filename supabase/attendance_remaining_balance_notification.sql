-- When both parties have mutually confirmed attendance (see
-- attendance_verification.sql), notify both the client and the freelancer
-- that the remaining balance is now due — as an actual amount, not a
-- percentage, since neither side should have to do that math themselves.
-- CreativeHUB only ever holds the deposit in escrow (see
-- src/app/pages/admin/AdminBookingDetail.tsx's note that the remaining
-- balance is settled directly between client and freelancer), so this is a
-- reminder, not a payment the platform processes.
--
-- Re-declares confirm_attendance() in full (create or replace), following
-- this repo's existing pattern of later migrations patching an earlier
-- function's body (e.g. reconcile_booking_escrow across booking_escrow.sql /
-- booking_annulled_reconcile.sql / booking_completion_status_fix.sql).
--
-- v2: the original version of this migration inserted both notifications
-- with actor_id = null, which rendered as a literal "User" placeholder name
-- and a blank avatar (see mapNotificationRecord in
-- src/components/MainLayout.tsx — actorName falls back to 'User' with no
-- avatar when actor_id doesn't resolve to a real user). Fixed below by
-- attributing each notification to the other party, same as every sibling
-- booking notification already does.

create or replace function public.confirm_attendance(p_booking_id uuid)
returns table (
  id uuid,
  booking_id uuid,
  confirmer_id uuid,
  confirmer_role text,
  confirmed_at timestamptz,
  scheduled_at timestamptz,
  already_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_role text;
  v_scheduled_at timestamptz;
  v_window_minutes int := 30;
  v_existing public.booking_attendance_confirmations%rowtype;
  v_inserted public.booking_attendance_confirmations%rowtype;
  v_other_confirmed boolean;
  v_remaining numeric;
  v_remaining_label text;
  v_freelancer_name text;
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

  if v_booking.status = 'cancelled' or v_booking.payment_status is distinct from 'deposit_paid' then
    raise exception 'This booking is not eligible for attendance confirmation';
  end if;

  select e.* into v_existing from public.booking_attendance_confirmations e
    where e.booking_id = p_booking_id and e.confirmer_id = v_uid;
  if found then
    return query select
      v_existing.id, v_existing.booking_id, v_existing.confirmer_id, v_existing.confirmer_role,
      v_existing.confirmed_at, v_existing.scheduled_at, true;
    return;
  end if;

  if v_booking.start_date is not null then
    v_scheduled_at := (v_booking.start_date::text || ' ' || coalesce(v_booking.start_time::text, '00:00'))::timestamp
      at time zone 'Asia/Bangkok';
  end if;

  if v_scheduled_at is not null and now() < v_scheduled_at - make_interval(mins => v_window_minutes) then
    raise exception 'Attendance verification will be available 30 minutes before the booking.';
  end if;

  if v_scheduled_at is not null and now() > v_scheduled_at + make_interval(mins => v_window_minutes) then
    raise exception 'The attendance verification window for this booking has closed.';
  end if;

  insert into public.booking_attendance_confirmations as bac (booking_id, confirmer_id, confirmer_role, scheduled_at)
    values (p_booking_id, v_uid, v_role, v_scheduled_at)
  on conflict on constraint booking_attendance_confirmations_booking_id_confirmer_id_key do nothing
  returning bac.* into v_inserted;

  if v_inserted.id is null then
    select e.* into v_inserted from public.booking_attendance_confirmations e
      where e.booking_id = p_booking_id and e.confirmer_id = v_uid;
    return query select
      v_inserted.id, v_inserted.booking_id, v_inserted.confirmer_id, v_inserted.confirmer_role,
      v_inserted.confirmed_at, v_inserted.scheduled_at, true;
    return;
  end if;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, v_role, 'presence_confirmed', null);

  -- Mutual verification complete the moment the SECOND party's confirmation
  -- lands — check for the other role's row now that this one is in.
  select exists (
    select 1 from public.booking_attendance_confirmations e
    where e.booking_id = p_booking_id and e.confirmer_id <> v_uid
  ) into v_other_confirmed;

  if v_other_confirmed then
    v_remaining := greatest(coalesce(v_booking.budget, 0) - coalesce(v_booking.deposit_amount, 0), 0);
    -- This app defaults to Thailand/THB throughout (see this file's sibling
    -- attendance_verification.sql) — bookings.budget/deposit_amount are
    -- always stored in THB, converted to the viewer's own currency only at
    -- display time client-side, which a stored notification message can't
    -- do. Baht symbol + thousands separator, no decimals, matching
    -- src/lib/currency.ts's formatCurrencyAmount(..., maximumFractionDigits: 0).
    v_remaining_label := '฿' || to_char(round(v_remaining), 'FM999,999,999');

    select u.full_name into v_freelancer_name from public.users u where u.id = v_booking.freelancer_id;

    -- actor_id matters here, not just cosmetically: NotificationsPanel shows
    -- the actor's real name + avatar next to every notification, and
    -- mapNotificationRecord (src/components/MainLayout.tsx) falls back to a
    -- literal 'User' string with a blank avatar when actor_id is null and
    -- nothing else resolves it. The client's notification is naturally
    -- attributed to the freelancer (whose confirmation triggered it and who
    -- the client now owes), and vice versa for the freelancer's — same
    -- "other party as actor" convention every other booking notification in
    -- this table already follows (e.g. deposit_payment_required).
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
      (v_booking.client_id, v_booking.freelancer_id, 'attendance_remaining_balance',
       'Remaining balance due',
       format('%s confirmed attendance for ''%s.'' Please pay the remaining %s to complete your booking.',
         coalesce(v_freelancer_name, 'Your freelancer'), v_booking.project_name, v_remaining_label),
       p_booking_id, false),
      -- No leading name here (unlike the client's row above) — NotificationsPanel
      -- always prepends the actor's name in bold before this text, so starting
      -- the message with a lowercase verb lets it read as one continuous
      -- sentence: "<b>Ceci</b> confirmed attendance for '...'" instead of the
      -- disconnected "<b>Ceci</b> Attendance confirmed for '...'" this used to
      -- produce.
      (v_booking.freelancer_id, v_booking.client_id, 'attendance_remaining_balance',
       'Remaining balance due',
       format('confirmed attendance for ''%s.'' Their remaining balance of %s is now due.',
         v_booking.project_name, v_remaining_label),
       p_booking_id, false);
  end if;

  return query select
    v_inserted.id, v_inserted.booking_id, v_inserted.confirmer_id, v_inserted.confirmer_role,
    v_inserted.confirmed_at, v_inserted.scheduled_at, false;
end;
$$;

revoke all on function public.confirm_attendance(uuid) from public;
grant execute on function public.confirm_attendance(uuid) to authenticated;
