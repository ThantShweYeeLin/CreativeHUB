-- Mutual attendance verification & no-show reporting. Replaces the earlier
-- GPS-based self-check-in feature (booking_check_ins / checkin_to_booking /
-- set_booking_location) with a peer-confirmation model: the CLIENT confirms
-- the FREELANCER's presence and vice versa — neither party ever confirms
-- themselves. A richer, role-specific no-show/attendance-problem report
-- exists alongside it, kept deliberately separate from the pre-existing
-- work-quality dispute system (dispute_status/booking_events 'complain'
-- lifecycle), since the two have different timing rules (a 30-minute
-- attendance window vs. the escrow's day/week-scale deadlines).
--
-- Window: [scheduled-30min, scheduled+30min]. start_date/start_time are
-- naive values with no stored timezone (see requestSchedule.ts) and this
-- app defaults to Thailand/THB throughout, so — exactly as verified in the
-- prior check-in feature's debugging — they're interpreted as Asia/Bangkok
-- local time rather than left to default to UTC.

-- ============================================================
-- Remove the superseded GPS check-in feature.
-- ============================================================
drop function if exists public.checkin_to_booking(uuid, double precision, double precision, boolean, boolean);
drop function if exists public.set_booking_location(uuid, numeric, numeric, text, text, text, text);
drop table if exists public.booking_check_ins;

-- ============================================================
-- Schema
-- ============================================================

alter table public.bookings
  add column if not exists attendance_window_notified_at timestamptz;

create table if not exists public.booking_attendance_confirmations (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  confirmer_id uuid references public.users on delete cascade not null,
  confirmer_role text not null check (confirmer_role in ('client','freelancer')),
  confirmed_at timestamptz default timezone('utc', now()) not null,
  scheduled_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (booking_id, confirmer_id)
);

create index if not exists idx_booking_attendance_confirmations_booking_id
  on public.booking_attendance_confirmations(booking_id);

create table if not exists public.attendance_reports (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  reporter_id uuid references public.users on delete cascade not null,
  reporter_role text not null check (reporter_role in ('client','freelancer')),
  reported_user_id uuid references public.users on delete cascade not null,
  reason text not null check (
    (reporter_role = 'client' and reason in (
      'freelancer_no_show','freelancer_late','freelancer_wrong_location','freelancer_cancelled_last_minute',
      'freelancer_refused_service','freelancer_identity_mismatch','freelancer_off_platform_request','other'
    ))
    or
    (reporter_role = 'freelancer' and reason in (
      'client_no_show','client_late','client_wrong_location','client_cancelled_last_minute',
      'client_different_work_requested','client_refused_payment_conditions','client_unsafe_situation',
      'client_off_platform_request','other'
    ))
  ),
  explanation text,
  evidence_paths text[] default array[]::text[],
  status text not null default 'open' check (status in ('open','under_review','resolved')),
  admin_decision text check (admin_decision in (
    'confirm_client_no_show','confirm_freelancer_no_show','reject_report','mark_mutual_dispute','resolve_without_penalty'
  )),
  admin_decision_reason text,
  resolved_by uuid references public.users,
  resolved_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (booking_id, reporter_id)
);

create index if not exists idx_attendance_reports_booking_id on public.attendance_reports(booking_id);
create index if not exists idx_attendance_reports_status on public.attendance_reports(status);

alter table public.booking_attendance_confirmations enable row level security;
alter table public.attendance_reports enable row level security;

DO $$ BEGIN
  CREATE POLICY "Participants view own attendance confirmations" ON public.booking_attendance_confirmations FOR SELECT
    USING (auth.uid() in (select client_id from public.bookings where id = booking_id)
        OR auth.uid() in (select freelancer_id from public.bookings where id = booking_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins view all attendance confirmations" ON public.booking_attendance_confirmations FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants view own attendance reports" ON public.attendance_reports FOR SELECT
    USING (auth.uid() in (select client_id from public.bookings where id = booking_id)
        OR auth.uid() in (select freelancer_id from public.bookings where id = booking_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins view all attendance reports" ON public.attendance_reports FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No INSERT/UPDATE/DELETE policy for 'authenticated' on either table —
-- deliberately, per the same reasoning as booking_check_ins before it: the
-- only way a row can be written is through the security-definer RPCs
-- below, which re-derive role/eligibility/window server-side. This closes
-- both self-confirmation and post-dispute evidence tampering at the RLS
-- layer, not just in the UI.

-- Widen the allowlist for the four new action values this feature logs,
-- while guaranteeing every row already in the table stays valid — this
-- repo's concurrent migrations (booking_reschedule.sql, plus whatever else
-- may have written booking_events directly) mean the authoritative set of
-- legacy values isn't something to hand-enumerate here; read it from the
-- table itself instead of trying to guess/transcribe it.
DO $$
DECLARE
  v_existing_actions text;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(action), ',') INTO v_existing_actions FROM public.booking_events;

  EXECUTE 'alter table public.booking_events drop constraint if exists booking_events_action_check';
  EXECUTE format(
    'alter table public.booking_events add constraint booking_events_action_check check (action in (%s%s%s))',
    -- Every action value known from source across every migration that
    -- touches this constraint (booking_escrow.sql's original set, the
    -- removed check-in feature's legacy values, booking_reschedule.sql's
    -- reschedule handshake, and this feature's four) — a full union so
    -- re-running this migration in any order relative to theirs never
    -- narrows what another feature is allowed to write.
    quote_literal('deposit_paid') || ',' || quote_literal('completion_submitted') || ',' || quote_literal('confirmed') || ',' ||
      quote_literal('complain') || ',' || quote_literal('evidence') || ',' || quote_literal('conceded') || ',' ||
      quote_literal('released') || ',' || quote_literal('refunded') || ',' || quote_literal('annulled') || ',' ||
      quote_literal('checked_in') || ',' || quote_literal('check_in_failed') || ',' || quote_literal('location_set') || ',' ||
      quote_literal('reschedule_proposed') || ',' || quote_literal('reschedule_accepted') || ',' ||
      quote_literal('reschedule_declined') || ',' || quote_literal('reschedule_withdrawn') || ',' ||
      quote_literal('presence_confirmed') || ',' || quote_literal('attendance_report_submitted') || ',' ||
      quote_literal('attendance_evidence_requested') || ',' || quote_literal('attendance_report_resolved'),
    CASE WHEN v_existing_actions IS NOT NULL THEN ',' ELSE '' END,
    coalesce(v_existing_actions, '')
  );
END $$;

DO $$
DECLARE
  v_existing_target_types text;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(target_type), ',') INTO v_existing_target_types FROM public.admin_actions;

  EXECUTE 'alter table public.admin_actions drop constraint if exists admin_actions_target_type_check';
  EXECUTE format(
    'alter table public.admin_actions add constraint admin_actions_target_type_check check (target_type in (%s%s%s))',
    quote_literal('user') || ',' || quote_literal('report') || ',' || quote_literal('ticket') || ',' ||
      quote_literal('dispute') || ',' || quote_literal('attendance_report'),
    CASE WHEN v_existing_target_types IS NOT NULL THEN ',' ELSE '' END,
    coalesce(v_existing_target_types, '')
  );
END $$;

-- ============================================================
-- RPCs
-- ============================================================

-- Shared eligibility/window logic is duplicated (not factored into a helper
-- function) across the two RPCs below to keep each one independently
-- auditable, matching this codebase's existing style (checkin_to_booking
-- did the same).

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

  return query select
    v_inserted.id, v_inserted.booking_id, v_inserted.confirmer_id, v_inserted.confirmer_role,
    v_inserted.confirmed_at, v_inserted.scheduled_at, false;
end;
$$;

revoke all on function public.confirm_attendance(uuid) from public;
grant execute on function public.confirm_attendance(uuid) to authenticated;

create or replace function public.submit_attendance_report(
  p_booking_id uuid,
  p_reason text,
  p_explanation text default null,
  p_evidence_paths text[] default array[]::text[]
)
returns public.attendance_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_role text;
  v_reported_user_id uuid;
  v_scheduled_at timestamptz;
  v_window_minutes int := 30;
  v_inserted public.attendance_reports%rowtype;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.client_id = v_uid then
    v_role := 'client';
    v_reported_user_id := v_booking.freelancer_id;
  elsif v_booking.freelancer_id = v_uid then
    v_role := 'freelancer';
    v_reported_user_id := v_booking.client_id;
  else
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.status = 'cancelled' or v_booking.payment_status is distinct from 'deposit_paid' then
    raise exception 'This booking is not eligible for an attendance report';
  end if;

  if v_booking.start_date is not null then
    v_scheduled_at := (v_booking.start_date::text || ' ' || coalesce(v_booking.start_time::text, '00:00'))::timestamp
      at time zone 'Asia/Bangkok';
  end if;

  if v_scheduled_at is not null and now() < v_scheduled_at - make_interval(mins => v_window_minutes) then
    raise exception 'Attendance reporting will be available 30 minutes before the booking.';
  end if;

  if v_scheduled_at is not null and now() > v_scheduled_at + make_interval(mins => v_window_minutes) then
    raise exception 'The attendance verification window for this booking has closed.';
  end if;

  insert into public.attendance_reports as ar (
    booking_id, reporter_id, reporter_role, reported_user_id, reason, explanation, evidence_paths
  )
  values (p_booking_id, v_uid, v_role, v_reported_user_id, p_reason, p_explanation, coalesce(p_evidence_paths, array[]::text[]))
  on conflict on constraint attendance_reports_booking_id_reporter_id_key do nothing
  returning ar.* into v_inserted;

  if v_inserted.id is null then
    select ar.* into v_inserted from public.attendance_reports ar
      where ar.booking_id = p_booking_id and ar.reporter_id = v_uid;
    return v_inserted;
  end if;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, v_role, 'attendance_report_submitted', p_reason);

  return v_inserted;
end;
$$;

revoke all on function public.submit_attendance_report(uuid, text, text, text[]) from public;
grant execute on function public.submit_attendance_report(uuid, text, text, text[]) to authenticated;

-- Opportunistic, no-cron notification of "the window is open" — called on
-- page load like reconcile_booking_escrow. Idempotent via
-- attendance_window_notified_at; mutates nothing else.
create or replace function public.reconcile_attendance_window(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_updated public.bookings%rowtype;
  v_scheduled_at timestamptz;
begin
  select b.* into v_booking from public.bookings b
    where b.id = p_booking_id and (b.client_id = auth.uid() or b.freelancer_id = auth.uid());
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.attendance_window_notified_at is not null or v_booking.start_date is null then
    return v_booking;
  end if;

  v_scheduled_at := (v_booking.start_date::text || ' ' || coalesce(v_booking.start_time::text, '00:00'))::timestamp
    at time zone 'Asia/Bangkok';

  if now() < v_scheduled_at - interval '30 minutes' then
    return v_booking;
  end if;

  update public.bookings set attendance_window_notified_at = timezone('utc', now())
    where id = p_booking_id and attendance_window_notified_at is null
    returning * into v_updated;

  if found then
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
      (v_booking.client_id, null, 'attendance_window_open',
       'Attendance check available',
       format('Your attendance check for "%s" is now available. Please confirm the other party''s presence.', v_booking.project_name),
       p_booking_id, false),
      (v_booking.freelancer_id, null, 'attendance_window_open',
       'Attendance check available',
       format('Your attendance check for "%s" is now available. Please confirm the other party''s presence.', v_booking.project_name),
       p_booking_id, false);
    return v_updated;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.reconcile_attendance_window(uuid) from public;
grant execute on function public.reconcile_attendance_window(uuid) to authenticated;

create or replace function public.admin_resolve_attendance_report(p_report_id uuid, p_decision text, p_reason text default null)
returns public.attendance_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.attendance_reports%rowtype;
  v_updated public.attendance_reports%rowtype;
  v_booking public.bookings%rowtype;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('confirm_client_no_show','confirm_freelancer_no_show','reject_report','mark_mutual_dispute','resolve_without_penalty') then
    raise exception 'Invalid decision';
  end if;

  select ar.* into v_report from public.attendance_reports ar where ar.id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  select b.* into v_booking from public.bookings b where b.id = v_report.booking_id;

  update public.attendance_reports set
    status = 'resolved',
    admin_decision = p_decision,
    admin_decision_reason = p_reason,
    resolved_by = v_admin,
    resolved_at = timezone('utc', now())
  where id = p_report_id
  returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (v_report.booking_id, 'admin', 'attendance_report_resolved', p_reason);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'resolve_attendance_report', 'attendance_report', p_report_id, jsonb_build_object('decision', p_decision, 'reason', p_reason));

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
    (v_booking.client_id, v_admin, 'attendance_report_resolved', 'Attendance report resolved',
     'CreativeHUB support reviewed the attendance report for this booking and reached a decision.', v_report.booking_id, false),
    (v_booking.freelancer_id, v_admin, 'attendance_report_resolved', 'Attendance report resolved',
     'CreativeHUB support reviewed the attendance report for this booking and reached a decision.', v_report.booking_id, false);

  return v_updated;
end;
$$;

revoke all on function public.admin_resolve_attendance_report(uuid, text, text) from public;
grant execute on function public.admin_resolve_attendance_report(uuid, text, text) to authenticated;

create or replace function public.admin_request_attendance_evidence(p_report_id uuid)
returns public.attendance_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.attendance_reports%rowtype;
  v_updated public.attendance_reports%rowtype;
  v_booking public.bookings%rowtype;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;

  select ar.* into v_report from public.attendance_reports ar where ar.id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  select b.* into v_booking from public.bookings b where b.id = v_report.booking_id;

  update public.attendance_reports set status = 'under_review' where id = p_report_id
    returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (v_report.booking_id, 'admin', 'attendance_evidence_requested', 'CreativeHUB support requested more evidence.');

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'request_attendance_evidence', 'attendance_report', p_report_id, '{}'::jsonb);

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
    (v_booking.client_id, v_admin, 'attendance_evidence_requested', 'Additional evidence requested',
     'CreativeHUB support requested additional evidence for this booking''s attendance report.', v_report.booking_id, false),
    (v_booking.freelancer_id, v_admin, 'attendance_evidence_requested', 'Additional evidence requested',
     'CreativeHUB support requested additional evidence for this booking''s attendance report.', v_report.booking_id, false);

  return v_updated;
end;
$$;

revoke all on function public.admin_request_attendance_evidence(uuid) from public;
grant execute on function public.admin_request_attendance_evidence(uuid) to authenticated;
