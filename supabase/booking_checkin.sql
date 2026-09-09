-- Privacy-preserving booking check-in: lets a client and freelancer each
-- independently confirm attendance at a booking, verified against a
-- radius around the booking's agreed location. No raw GPS coordinates are
-- ever persisted or returned to a client — only the verdict (verified /
-- outside_area / location_unavailable / permission_denied), a coarse
-- distance bucket, and the timestamp. All writes go through
-- checkin_to_booking()/set_booking_location(), which are the only things
-- allowed to touch booking_check_ins — a malicious client cannot submit
-- location_verified = true directly.
--
-- Window/radius constants (kept in sync with src/lib/bookingCheckIn.ts):
--   CHECK_IN_OPEN_MINUTES = 30, CHECK_IN_CLOSE_MINUTES = 30 (soft — a late
--   check-in is still accepted, just flagged is_late), CHECK_IN_RADIUS_METERS = 100.

alter table public.bookings
  add column if not exists location_lat numeric(10,7),
  add column if not exists location_lng numeric(10,7),
  add column if not exists location_address text,
  add column if not exists location_place_id text,
  add column if not exists location_city text,
  add column if not exists location_district text,
  add column if not exists location_set_by uuid references public.users,
  add column if not exists location_updated_at timestamptz;

create table if not exists public.booking_check_ins (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  role text not null check (role in ('client','freelancer')),
  checked_in_at timestamptz default timezone('utc', now()) not null,
  check_in_status text not null check (check_in_status in
    ('verified','outside_area','location_unavailable','permission_denied')),
  location_verified boolean not null default false,
  distance_bucket text check (distance_bucket in ('within_50m','within_100m','beyond_100m')),
  is_late boolean not null default false,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (booking_id, user_id)
);

create index if not exists idx_booking_check_ins_booking_id on public.booking_check_ins(booking_id);

alter table public.booking_check_ins enable row level security;

DO $$ BEGIN
  CREATE POLICY "Participants view own booking check-ins" ON public.booking_check_ins FOR SELECT
    USING (auth.uid() in (select client_id from public.bookings where id = booking_id)
        OR auth.uid() in (select freelancer_id from public.bookings where id = booking_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins view all booking check-ins" ON public.booking_check_ins FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No INSERT/UPDATE/DELETE policy for 'authenticated' is created here on
-- purpose. RLS defaults to deny, so the only way a row can ever be written
-- is through checkin_to_booking() below, which runs as security definer
-- and re-derives every field itself.

alter table public.booking_events
  drop constraint if exists booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check
  check (action in (
    'deposit_paid','completion_submitted','confirmed',
    'complain','evidence','conceded','released','refunded','annulled',
    'checked_in','check_in_failed','location_set'
  ));

-- Either participant may set/update the booking's venue location. The
-- address/city/district are the agreed meeting place — already implicitly
-- known to both parties — so no privacy concern; only a person's live GPS
-- position at check-in time is sensitive (see checkin_to_booking below).
create or replace function public.set_booking_location(
  p_booking_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_address text,
  p_place_id text default null,
  p_city text default null,
  p_district text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_updated public.bookings;
  v_role text;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and (client_id = v_uid or freelancer_id = v_uid);
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'This booking is cancelled';
  end if;

  v_role := case when v_booking.client_id = v_uid then 'client' else 'freelancer' end;

  update public.bookings set
    location_lat = p_lat,
    location_lng = p_lng,
    location_address = p_address,
    location_place_id = p_place_id,
    location_city = p_city,
    location_district = p_district,
    location_set_by = v_uid,
    location_updated_at = timezone('utc', now())
  where id = p_booking_id
  returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, v_role, 'location_set', p_address);

  return v_updated;
end;
$$;

revoke all on function public.set_booking_location(uuid, numeric, numeric, text, text, text, text) from public;
grant execute on function public.set_booking_location(uuid, numeric, numeric, text, text, text, text) to authenticated;

-- The actual security boundary for check-in. Re-derives auth.uid(), role,
-- booking eligibility, the check-in window, and the verification verdict
-- entirely server-side from stored data — a caller can send any lat/lng
-- (or none) but cannot influence check_in_status or location_verified
-- directly, and cannot claim a role or booking they are not part of.
create or replace function public.checkin_to_booking(
  p_booking_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_permission_denied boolean default false,
  p_location_unavailable boolean default false
)
returns table (
  id uuid,
  booking_id uuid,
  user_id uuid,
  role text,
  checked_in_at timestamptz,
  check_in_status text,
  location_verified boolean,
  distance_bucket text,
  is_late boolean,
  already_checked_in boolean
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
  v_open_minutes int := 30;
  v_close_minutes int := 30;
  v_radius_meters numeric := 100;
  v_status text;
  v_verified boolean := false;
  v_bucket text := null;
  v_late boolean := false;
  v_distance_m double precision;
  v_existing public.booking_check_ins%rowtype;
  v_inserted public.booking_check_ins%rowtype;
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
    raise exception 'This booking is not eligible for check-in';
  end if;

  select e.* into v_existing from public.booking_check_ins e
    where e.booking_id = p_booking_id and e.user_id = v_uid;
  if found then
    return query select
      v_existing.id, v_existing.booking_id, v_existing.user_id, v_existing.role,
      v_existing.checked_in_at, v_existing.check_in_status, v_existing.location_verified,
      v_existing.distance_bucket, v_existing.is_late, true;
    return;
  end if;

  if v_booking.start_date is not null then
    -- start_date/start_time are stored as naive wall-clock values with no
    -- timezone (chosen directly from a picker — see requestSchedule.ts) and
    -- this app defaults to Thailand/THB throughout, so interpret them as
    -- Asia/Bangkok local time rather than letting the bare ::timestamptz
    -- cast silently assume UTC.
    v_scheduled_at := (v_booking.start_date::text || ' ' || coalesce(v_booking.start_time::text, '00:00'))::timestamp
      at time zone 'Asia/Bangkok';
  end if;

  if v_scheduled_at is not null and now() < v_scheduled_at - make_interval(mins => v_open_minutes) then
    raise exception 'Check-in opens at %', to_char(
      (v_scheduled_at - make_interval(mins => v_open_minutes)) at time zone 'Asia/Bangkok', 'HH12:MI AM'
    );
  end if;

  if v_scheduled_at is not null and now() > v_scheduled_at + make_interval(mins => v_close_minutes) then
    v_late := true;
  end if;

  if p_permission_denied then
    v_status := 'permission_denied';
  elsif p_location_unavailable or p_lat is null or p_lng is null then
    v_status := 'location_unavailable';
  elsif v_booking.location_lat is null or v_booking.location_lng is null then
    -- Nothing to verify against yet — still record attendance rather than
    -- blocking the user for a gap in platform setup.
    v_status := 'verified';
    v_verified := false;
    v_bucket := null;
  else
    -- Haversine distance in meters.
    v_distance_m := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_booking.location_lat) / 2), 2) +
      cos(radians(v_booking.location_lat)) * cos(radians(p_lat)) *
      power(sin(radians(p_lng - v_booking.location_lng) / 2), 2)
    ));

    if v_distance_m <= v_radius_meters then
      v_status := 'verified';
      v_verified := true;
      v_bucket := case when v_distance_m <= 50 then 'within_50m' else 'within_100m' end;
    else
      v_status := 'outside_area';
      v_verified := false;
      v_bucket := 'beyond_100m';
    end if;
  end if;

  insert into public.booking_check_ins as bci (booking_id, user_id, role, check_in_status, location_verified, distance_bucket, is_late)
    values (p_booking_id, v_uid, v_role, v_status, v_verified, v_bucket, v_late)
  on conflict on constraint booking_check_ins_booking_id_user_id_key do nothing
  returning bci.* into v_inserted;

  if v_inserted.id is null then
    -- Concurrent duplicate call landed between our SELECT and INSERT.
    select e.* into v_inserted from public.booking_check_ins e
      where e.booking_id = p_booking_id and e.user_id = v_uid;
    return query select
      v_inserted.id, v_inserted.booking_id, v_inserted.user_id, v_inserted.role,
      v_inserted.checked_in_at, v_inserted.check_in_status, v_inserted.location_verified,
      v_inserted.distance_bucket, v_inserted.is_late, true;
    return;
  end if;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (
      p_booking_id, v_role,
      case when v_status = 'verified' then 'checked_in' else 'check_in_failed' end,
      case v_status
        when 'verified' then case when v_late then 'Checked in (late)' else 'Checked in' end
        when 'outside_area' then 'Check-in attempted outside the booking area'
        when 'location_unavailable' then 'Check-in attempted, location unavailable'
        when 'permission_denied' then 'Check-in attempted, location permission denied'
      end
    );

  return query select
    v_inserted.id, v_inserted.booking_id, v_inserted.user_id, v_inserted.role,
    v_inserted.checked_in_at, v_inserted.check_in_status, v_inserted.location_verified,
    v_inserted.distance_bucket, v_inserted.is_late, false;
end;
$$;

revoke all on function public.checkin_to_booking(uuid, double precision, double precision, boolean, boolean) from public;
grant execute on function public.checkin_to_booking(uuid, double precision, double precision, boolean, boolean) to authenticated;
