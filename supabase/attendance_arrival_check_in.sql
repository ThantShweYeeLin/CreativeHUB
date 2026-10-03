-- Self arrival check-in during the attendance window. Each participant
-- records their OWN arrival (separate from the peer presence confirmation in
-- attendance_verification.sql, which is unchanged). The arrival optionally
-- carries a one-shot device location; when the user declines or the device
-- can't provide one, the arrival is still recorded with the reason.
--
-- Privacy: raw coordinates are visible only to administrators (the admin
-- select policy below). Participants read arrivals through
-- get_booking_arrivals(), which deliberately omits coordinates — they see
-- who arrived, when, and whether a location was shared.
--
-- Window: same [scheduled-30min, scheduled+30min] window as attendance
-- verification, interpreted in Asia/Bangkok (see attendance_verification.sql).

-- ============================================================
-- Schema
-- ============================================================

create table if not exists public.booking_arrivals (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  role text not null check (role in ('client','freelancer')),
  arrived_at timestamptz default timezone('utc', now()) not null,
  location_status text not null check (location_status in ('provided','not_provided')),
  not_provided_reason text check (not_provided_reason in (
    'permission_denied','position_unavailable','timeout','not_supported'
  )),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (booking_id, user_id),
  check (
    (location_status = 'provided' and latitude is not null and longitude is not null and not_provided_reason is null)
    or
    (location_status = 'not_provided' and latitude is null and longitude is null and not_provided_reason is not null)
  ),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create index if not exists idx_booking_arrivals_booking_id on public.booking_arrivals(booking_id);

alter table public.booking_arrivals enable row level security;

DO $$ BEGIN
  CREATE POLICY "Admins view all booking arrivals" ON public.booking_arrivals FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No INSERT/UPDATE/DELETE policy and no participant SELECT policy: rows are
-- only written by record_arrival(), and participants only read them through
-- get_booking_arrivals() so coordinates never reach the other party.

-- Widen booking_events' action allowlist for 'arrival_recorded', keeping every
-- value already in the table valid (same approach as attendance_verification.sql).
DO $$
DECLARE
  v_existing_actions text;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(action), ',') INTO v_existing_actions FROM public.booking_events;

  EXECUTE 'alter table public.booking_events drop constraint if exists booking_events_action_check';
  EXECUTE format(
    'alter table public.booking_events add constraint booking_events_action_check check (action in (%s%s%s))',
    quote_literal('deposit_paid') || ',' || quote_literal('completion_submitted') || ',' || quote_literal('confirmed') || ',' ||
      quote_literal('complain') || ',' || quote_literal('evidence') || ',' || quote_literal('conceded') || ',' ||
      quote_literal('released') || ',' || quote_literal('refunded') || ',' || quote_literal('annulled') || ',' ||
      quote_literal('checked_in') || ',' || quote_literal('check_in_failed') || ',' || quote_literal('location_set') || ',' ||
      quote_literal('reschedule_proposed') || ',' || quote_literal('reschedule_accepted') || ',' ||
      quote_literal('reschedule_declined') || ',' || quote_literal('reschedule_withdrawn') || ',' ||
      quote_literal('presence_confirmed') || ',' || quote_literal('attendance_report_submitted') || ',' ||
      quote_literal('attendance_evidence_requested') || ',' || quote_literal('attendance_report_resolved') || ',' ||
      quote_literal('arrival_recorded'),
    CASE WHEN v_existing_actions IS NOT NULL THEN ',' ELSE '' END,
    coalesce(v_existing_actions, '')
  );
END $$;

-- ============================================================
-- RPCs
-- ============================================================

create or replace function public.record_arrival(
  p_booking_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null,
  p_not_provided_reason text default null
)
returns table (
  id uuid,
  user_id uuid,
  role text,
  arrived_at timestamptz,
  location_status text,
  already_recorded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_role text;
  v_other_id uuid;
  v_scheduled_at timestamptz;
  v_window_minutes int := 30;
  v_existing public.booking_arrivals%rowtype;
  v_inserted public.booking_arrivals%rowtype;
  v_has_location boolean := p_latitude is not null and p_longitude is not null;
  v_name text;
  v_time text;
  v_location_phrase text;
  v_conversation_id uuid;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.client_id = v_uid then
    v_role := 'client';
    v_other_id := v_booking.freelancer_id;
  elsif v_booking.freelancer_id = v_uid then
    v_role := 'freelancer';
    v_other_id := v_booking.client_id;
  else
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.status = 'cancelled' or v_booking.payment_status is distinct from 'deposit_paid' then
    raise exception 'This booking is not eligible for arrival check-in';
  end if;

  select e.* into v_existing from public.booking_arrivals e
    where e.booking_id = p_booking_id and e.user_id = v_uid;
  if found then
    return query select v_existing.id, v_existing.user_id, v_existing.role, v_existing.arrived_at,
      v_existing.location_status, true;
    return;
  end if;

  if v_booking.start_date is not null then
    v_scheduled_at := (v_booking.start_date::text || ' ' || coalesce(v_booking.start_time::text, '00:00'))::timestamp
      at time zone 'Asia/Bangkok';
  end if;

  if v_scheduled_at is not null and now() < v_scheduled_at - make_interval(mins => v_window_minutes) then
    raise exception 'Arrival check-in opens 30 minutes before the booking.';
  end if;

  if v_scheduled_at is not null and now() > v_scheduled_at + make_interval(mins => v_window_minutes) then
    raise exception 'The arrival check-in window for this booking has closed.';
  end if;

  if v_has_location then
    if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
      raise exception 'The shared location is not valid.';
    end if;
  elsif p_not_provided_reason is null
    or p_not_provided_reason not in ('permission_denied','position_unavailable','timeout','not_supported') then
    raise exception 'A reason is required when no location is shared.';
  end if;

  insert into public.booking_arrivals as ba (
    booking_id, user_id, role, location_status, not_provided_reason, latitude, longitude, accuracy_m
  )
  values (
    p_booking_id, v_uid, v_role,
    case when v_has_location then 'provided' else 'not_provided' end,
    case when v_has_location then null else p_not_provided_reason end,
    case when v_has_location then p_latitude else null end,
    case when v_has_location then p_longitude else null end,
    case when v_has_location then p_accuracy_m else null end
  )
  on conflict on constraint booking_arrivals_booking_id_user_id_key do nothing
  returning ba.* into v_inserted;

  if v_inserted.id is null then
    select e.* into v_inserted from public.booking_arrivals e
      where e.booking_id = p_booking_id and e.user_id = v_uid;
    return query select v_inserted.id, v_inserted.user_id, v_inserted.role, v_inserted.arrived_at,
      v_inserted.location_status, true;
    return;
  end if;

  select u.full_name into v_name from public.users u where u.id = v_uid;
  v_name := coalesce(nullif(trim(v_name), ''), 'A ' || v_role);
  v_time := to_char(v_inserted.arrived_at at time zone 'Asia/Bangkok', 'FMHH12:MI AM');
  v_location_phrase := case when v_has_location then 'location shared' else 'location not shared' end;

  select c.id into v_conversation_id from public.conversations c
    where (c.participant_1_id = v_uid and c.participant_2_id = v_other_id)
       or (c.participant_1_id = v_other_id and c.participant_2_id = v_uid)
    limit 1;

  if v_conversation_id is null then
    insert into public.conversations (participant_1_id, participant_2_id, status, initiated_by)
      values (v_booking.client_id, v_booking.freelancer_id, 'accepted', v_booking.client_id)
      returning conversations.id into v_conversation_id;
  end if;

  insert into public.messages (conversation_id, sender_id, recipient_id, content)
    values (v_conversation_id, v_uid, v_other_id, format('%s has arrived at %s.', v_name, v_time));

  update public.conversations c set last_message_at = timezone('utc', now())
    where c.id = v_conversation_id;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, v_role, 'arrival_recorded', v_location_phrase);

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
    (v_other_id, v_uid, 'arrival_recorded',
     format('%s has arrived', v_name),
     format('%s checked in for "%s" at %s.', v_name, v_booking.project_name, v_time),
     p_booking_id, false);

  return query select v_inserted.id, v_inserted.user_id, v_inserted.role, v_inserted.arrived_at,
    v_inserted.location_status, false;
end;
$$;

revoke all on function public.record_arrival(uuid, double precision, double precision, double precision, text) from public;
grant execute on function public.record_arrival(uuid, double precision, double precision, double precision, text) to authenticated;

-- Participant-safe read: returns who arrived, when, and whether a location was
-- shared — never the coordinates themselves.
create or replace function public.get_booking_arrivals(p_booking_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role text,
  arrived_at timestamptz,
  location_status text,
  not_provided_reason text,
  user_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) and not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and (b.client_id = auth.uid() or b.freelancer_id = auth.uid())
  ) then
    raise exception 'Not authorized for this booking';
  end if;

  return query
    select ba.id, ba.user_id, ba.role, ba.arrived_at, ba.location_status, ba.not_provided_reason, u.full_name
    from public.booking_arrivals ba
    left join public.users u on u.id = ba.user_id
    where ba.booking_id = p_booking_id
    order by ba.arrived_at asc;
end;
$$;

revoke all on function public.get_booking_arrivals(uuid) from public;
grant execute on function public.get_booking_arrivals(uuid) to authenticated;
