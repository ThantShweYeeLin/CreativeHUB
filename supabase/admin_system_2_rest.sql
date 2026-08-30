-- Step 2 of 2 for the admin system migration. Run this AFTER admin_system_1_enum.sql
-- has been executed and committed on its own (see that file's comment).
-- Safe to re-run this file by itself multiple times.

alter table public.users
  drop constraint if exists users_account_status_check;
alter table public.users
  add constraint users_account_status_check
  check (account_status in ('active','paused','suspended','banned'));

alter table public.booking_events
  drop constraint if exists booking_events_actor_check;
alter table public.booking_events
  add constraint booking_events_actor_check
  check (actor in ('client','freelancer','system','admin'));

alter table public.bookings
  drop constraint if exists bookings_dispute_status_check;
alter table public.bookings
  add constraint bookings_dispute_status_check
  check (dispute_status in ('none','open','under_admin_review','resolved'));

create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = uid and role = 'admin');
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- ============================================================
-- User Reports (admin-adjudicated - distinct from the existing
-- message_reports/blocked_users spam-report-and-block feature, which
-- resolves itself automatically and is untouched by this migration).
-- ============================================================

create table if not exists public.user_reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.users on delete cascade not null,
  reported_user_id uuid references public.users on delete cascade not null,
  reason text not null check (reason in (
    'harassment','scam_fraud','fake_information',
    'inappropriate_content','unprofessional_behavior','other'
  )),
  description text,
  evidence_photo_paths text[] default array[]::text[],
  related_booking_id uuid references public.bookings on delete set null,
  status text not null default 'open' check (status in ('open','resolved')),
  decision text check (decision in ('no_action','warning','suspended','banned')),
  decision_reason text,
  resolved_by uuid references public.users,
  resolved_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null
);

alter table public.user_reports enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users file their own reports" ON public.user_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Reporters see own reports, admins see all" ON public.user_reports FOR SELECT
    USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Support Tickets ("Report an Issue" - website/technical problems,
-- distinct from reporting another person).
-- ============================================================

create table if not exists public.support_tickets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  category text not null check (category in (
    'technical','payment','account','booking','suggestion','other'
  )),
  description text not null,
  screenshot_path text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_notes text,
  resolved_by uuid references public.users,
  resolved_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null
);

alter table public.support_tickets enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users file their own tickets" ON public.support_tickets FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users see own tickets, admins see all" ON public.support_tickets FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Admin audit trail - write-only via the security-definer RPCs below,
-- never directly from a client.
-- ============================================================

create table if not exists public.admin_actions (
  id uuid default uuid_generate_v4() primary key,
  admin_id uuid references public.users not null,
  action_type text not null,
  target_type text not null check (target_type in ('user','report','ticket','dispute')),
  target_id uuid not null,
  details jsonb,
  created_at timestamptz default timezone('utc', now()) not null
);

alter table public.admin_actions enable row level security;

DO $$ BEGIN
  CREATE POLICY "Admins view the audit log" ON public.admin_actions FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Admin-only read access to tables that are otherwise participant-scoped.
-- users/freelancer_profiles already have public SELECT policies, so they
-- need no changes here.
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "Admins view all bookings" ON public.bookings FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins view all booking events" ON public.booking_events FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Private evidence bucket for user reports and ticket screenshots, same
-- per-uploader-folder pattern as booking-evidence.
insert into storage.buckets (id, name, public)
values ('report-evidence', 'report-evidence', false)
on conflict (id) do update set public = excluded.public;

DO $$ BEGIN
  CREATE POLICY "Uploaders and admins view report evidence" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'report-evidence'
      AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users upload their own report evidence" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'report-evidence'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Admin action RPCs - the only way admin mutations happen. Each checks
-- is_admin() itself (defense in depth even though only an admin's client
-- would call these), performs one narrow action, and logs to
-- admin_actions - this is what "admins act through specific actions with
-- an audit trail, not arbitrary edits" actually means at the DB level.
-- ============================================================

create or replace function public.admin_set_account_status(p_user_id uuid, p_status text, p_reason text default null)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_updated public.users;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('active','paused','suspended','banned') then
    raise exception 'Invalid status';
  end if;

  update public.users set account_status = p_status where id = p_user_id returning * into v_updated;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'set_account_status', 'user', p_user_id, jsonb_build_object('status', p_status, 'reason', p_reason));

  return v_updated;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text, text) from public;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;

create or replace function public.admin_resolve_user_report(p_report_id uuid, p_decision text, p_reason text default null)
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.user_reports;
  v_updated public.user_reports;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('no_action','warning','suspended','banned') then
    raise exception 'Invalid decision';
  end if;

  select * into v_report from public.user_reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  update public.user_reports
    set status = 'resolved', decision = p_decision, decision_reason = p_reason,
        resolved_by = v_admin, resolved_at = timezone('utc', now())
    where id = p_report_id
    returning * into v_updated;

  if p_decision in ('suspended', 'banned') then
    update public.users set account_status = p_decision where id = v_report.reported_user_id;
  end if;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'resolve_user_report', 'report', p_report_id, jsonb_build_object('decision', p_decision, 'reason', p_reason));

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
    values (
      v_report.reported_user_id, v_admin, 'admin_report_decision',
      'Report reviewed',
      case p_decision
        when 'no_action' then 'A report against you was reviewed - no action was taken.'
        when 'warning' then 'A report against you was reviewed. This is a warning - please review our community guidelines.'
        when 'suspended' then 'Your account has been suspended following a report review.'
        when 'banned' then 'Your account has been banned following a report review.'
      end,
      p_report_id, false
    );

  return v_updated;
end;
$$;

revoke all on function public.admin_resolve_user_report(uuid, text, text) from public;
grant execute on function public.admin_resolve_user_report(uuid, text, text) to authenticated;

create or replace function public.admin_update_ticket_status(p_ticket_id uuid, p_status text, p_notes text default null)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_updated public.support_tickets;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('open','in_progress','resolved','closed') then
    raise exception 'Invalid status';
  end if;

  update public.support_tickets
    set status = p_status,
        admin_notes = coalesce(p_notes, admin_notes),
        resolved_by = case when p_status in ('resolved','closed') then v_admin else resolved_by end,
        resolved_at = case when p_status in ('resolved','closed') then timezone('utc', now()) else resolved_at end
    where id = p_ticket_id
    returning * into v_updated;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'update_ticket_status', 'ticket', p_ticket_id, jsonb_build_object('status', p_status));

  return v_updated;
end;
$$;

revoke all on function public.admin_update_ticket_status(uuid, text, text) from public;
grant execute on function public.admin_update_ticket_status(uuid, text, text) to authenticated;

create or replace function public.admin_resolve_dispute(p_booking_id uuid, p_decision text, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_booking public.bookings;
  v_updated public.bookings;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('refund','release') then
    raise exception 'Invalid decision';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  update public.bookings
    set payment_status = case when p_decision = 'refund' then 'refunded' else 'paid' end,
        dispute_status = 'resolved',
        dispute_awaiting = null
    where id = p_booking_id
    returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, 'admin', case when p_decision = 'refund' then 'refunded' else 'released' end, p_reason);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'resolve_dispute', 'dispute', p_booking_id, jsonb_build_object('decision', p_decision, 'reason', p_reason));

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
    (v_booking.client_id, v_admin, 'booking_disputed',
     'Dispute resolved',
     case when p_decision = 'refund' then 'CreativeHUB support reviewed your dispute and refunded the deposit.'
          else 'CreativeHUB support reviewed the dispute and released the deposit to the freelancer.' end,
     p_booking_id, false),
    (v_booking.freelancer_id, v_admin, 'booking_disputed',
     'Dispute resolved',
     case when p_decision = 'refund' then 'CreativeHUB support reviewed the dispute and refunded the deposit to the client.'
          else 'CreativeHUB support reviewed the dispute and released the deposit to you.' end,
     p_booking_id, false);

  return v_updated;
end;
$$;

revoke all on function public.admin_resolve_dispute(uuid, text, text) from public;
grant execute on function public.admin_resolve_dispute(uuid, text, text) to authenticated;

create or replace function public.admin_request_more_evidence(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_deadline timestamptz := now() + interval '72 hours';
  v_updated public.bookings;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;

  update public.bookings set dispute_response_deadline = v_deadline where id = p_booking_id
    returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, 'admin', 'complain', 'CreativeHUB support requested more evidence from both parties.');

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'request_more_evidence', 'dispute', p_booking_id, jsonb_build_object('new_deadline', v_deadline));

  return v_updated;
end;
$$;

revoke all on function public.admin_request_more_evidence(uuid) from public;
grant execute on function public.admin_request_more_evidence(uuid) to authenticated;

-- ============================================================
-- Rework the two escrow functions: the 72h/round-cap outcomes now hand off
-- to a human admin instead of deciding the refund/release themselves. The
-- 24h deposit-payment deadline and the 7-day no-dispute-opened auto-release
-- are untouched - those are silence-implies-acceptance timeouts with no
-- disagreement to adjudicate, not disputes.
-- ============================================================

create or replace function public.reconcile_booking_escrow(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_updated public.bookings;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and (client_id = auth.uid() or freelancer_id = auth.uid());
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.status = 'pending' and v_booking.payment_status = 'unpaid'
     and v_booking.deposit_deadline is not null and now() > v_booking.deposit_deadline then
    update public.bookings set status = 'cancelled', cancellation_reason = 'deposit_not_paid'
      where id = p_booking_id and status = 'pending' and payment_status = 'unpaid'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, reason)
        values (p_booking_id, 'system', 'annulled', 'Deposit not paid within 24 hours');
      return v_updated;
    end if;
  end if;

  if v_booking.dispute_status = 'none' and v_booking.payment_status = 'deposit_paid'
     and v_booking.completed_at is not null and v_booking.client_response_deadline is not null
     and now() > v_booking.client_response_deadline then
    update public.bookings set payment_status = 'paid'
      where id = p_booking_id and dispute_status = 'none' and payment_status = 'deposit_paid'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, reason)
        values (p_booking_id, 'system', 'released', 'No client response within 7 days');
      return v_updated;
    end if;
  end if;

  if v_booking.dispute_status = 'open' and v_booking.dispute_response_deadline is not null
     and now() > v_booking.dispute_response_deadline then
    update public.bookings set dispute_status = 'under_admin_review'
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, reason) values
        (p_booking_id, 'system', 'complain',
         format('%s did not respond within 72 hours. Escalated for admin review.',
                case when v_booking.dispute_awaiting = 'freelancer' then 'Freelancer' else 'Client' end));
      return v_updated;
    end if;
  end if;

  return v_booking;
end;
$$;

create or replace function public.arbitrate_booking_dispute(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_updated public.bookings;
  v_has_evidence boolean;
  v_has_conceded boolean;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and (client_id = auth.uid() or freelancer_id = auth.uid());
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.dispute_status <> 'open' then
    return v_booking;
  end if;

  select exists(
    select 1 from public.booking_events
    where booking_id = p_booking_id and round = v_booking.dispute_round
      and actor = 'freelancer' and action = 'evidence'
  ) into v_has_evidence;

  select exists(
    select 1 from public.booking_events
    where booking_id = p_booking_id and round = v_booking.dispute_round
      and actor = 'freelancer' and action = 'conceded'
  ) into v_has_conceded;

  if v_has_conceded then
    update public.bookings set dispute_status = 'under_admin_review'
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, round, reason) values
        (p_booking_id, 'system', 'complain', v_booking.dispute_round,
         'Freelancer conceded - no evidence provided for this round. Escalated for admin review.');
    end if;
    return coalesce(v_updated, v_booking);
  end if;

  if v_has_evidence and v_booking.dispute_round >= 2 then
    update public.bookings set dispute_status = 'under_admin_review'
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, round, reason) values
        (p_booking_id, 'system', 'complain', v_booking.dispute_round,
         'Dispute rounds exhausted. Escalated for admin review.');
    end if;
    return coalesce(v_updated, v_booking);
  end if;

  return v_booking;
end;
$$;
