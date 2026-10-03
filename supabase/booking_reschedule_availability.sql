-- Reschedule proposals and acceptances are validated against the freelancer's
-- real availability, not only the client-side picker: the same rules the
-- request form applies (not in the past, not a blocked date, inside working
-- hours, no overlapping booking). Both propose and accept run the same check,
-- so a proposal that went stale (the freelancer blocked the day or accepted
-- something else meanwhile) is refused at accept time too.
--
-- Times are evaluated in Asia/Bangkok wall-clock, matching start_date /
-- start_time and attendance_verification.sql. Run after booking_reschedule.sql
-- and booking_overlap_protection.sql. Safe to re-run.

create or replace function public.check_reschedule_window(
  p_booking_id uuid,
  p_freelancer_user_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (p_start at time zone 'Asia/Bangkok')::date;
  v_start_time time := (p_start at time zone 'Asia/Bangkok')::time;
  v_end_time time := (p_end at time zone 'Asia/Bangkok')::time;
  v_working_start text;
  v_working_end text;
begin
  if p_end <= p_start then
    raise exception 'The end time must be after the start time.';
  end if;

  if p_start <= now() then
    raise exception 'That time has already passed. Choose a time in the future.';
  end if;

  if (p_end at time zone 'Asia/Bangkok')::date <> v_date then
    raise exception 'A session must start and end on the same day.';
  end if;

  if exists (
    select 1 from public.freelancer_blocked_dates fb
    join public.freelancer_profiles fp on fp.id = fb.freelancer_id
    where fp.user_id = p_freelancer_user_id and fb.blocked_date = v_date
  ) then
    raise exception 'The freelancer is unavailable on that date.';
  end if;

  select fp.working_hours_start, fp.working_hours_end into v_working_start, v_working_end
    from public.freelancer_profiles fp where fp.user_id = p_freelancer_user_id;

  if v_start_time < coalesce(v_working_start, '09:00')::time or v_end_time > coalesce(v_working_end, '18:00')::time then
    raise exception 'That time is outside the freelancer''s working hours.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.freelancer_id = p_freelancer_user_id
      and b.id <> p_booking_id
      and b.status in ('pending', 'confirmed')
      and b.start_at is not null
      and b.end_at is not null
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'The freelancer already has a booking during that time.';
  end if;
end;
$$;

revoke all on function public.check_reschedule_window(uuid, uuid, timestamptz, timestamptz) from public;

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
     or v_booking.payment_status in ('paid', 'refunded') then
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

create or replace function public.accept_booking_reschedule(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_role text;
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

  if v_booking.reschedule_proposed_start_at is null or v_booking.reschedule_proposed_end_at is null then
    raise exception 'There is no pending reschedule proposal to accept.';
  end if;

  if v_booking.reschedule_proposed_by = v_uid then
    raise exception 'You cannot accept your own proposal.';
  end if;

  perform public.check_reschedule_window(
    p_booking_id, v_booking.freelancer_id,
    v_booking.reschedule_proposed_start_at, v_booking.reschedule_proposed_end_at
  );

  update public.bookings b set
    start_at = b.reschedule_proposed_start_at,
    end_at = b.reschedule_proposed_end_at,
    start_date = (b.reschedule_proposed_start_at at time zone 'Asia/Bangkok')::date,
    start_time = (b.reschedule_proposed_start_at at time zone 'Asia/Bangkok')::time,
    end_time = (b.reschedule_proposed_end_at at time zone 'Asia/Bangkok')::time,
    reschedule_proposed_start_at = null,
    reschedule_proposed_end_at = null,
    reschedule_proposed_by = null,
    reschedule_proposed_reason = null
  where b.id = p_booking_id
  returning b.* into v_updated;

  insert into public.booking_events (booking_id, actor, action)
    values (p_booking_id, v_role, 'reschedule_accepted');

  return v_updated;
end;
$$;

revoke all on function public.accept_booking_reschedule(uuid) from public;
grant execute on function public.accept_booking_reschedule(uuid) to authenticated;
