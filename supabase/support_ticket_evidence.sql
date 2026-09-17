-- Gives support_tickets ("Create a Ticket") the same evidence-request
-- rhythm booking disputes already have: an admin can ask for more, the
-- filer gets notified and can attach it, and the whole thing is a visible
-- timeline instead of a single description + admin_notes field. Run this
-- once against your Supabase project's SQL editor, after admin_system_2_rest.sql
-- (support_tickets, admin_update_ticket_status, create_social_notification
-- with the 9-arg signature, and report-evidence storage all need to already
-- exist).

DO $$ BEGIN
  alter table public.support_tickets drop constraint support_tickets_status_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status in ('open','in_progress','awaiting_evidence','resolved','closed'));

-- Lets a booking or payment ticket point at the specific booking, filed by
-- either the client or the freelancer on it - same shape as
-- user_reports.related_booking_id (admin_system_2_rest.sql), and likewise
-- not verified against the filer's own bookings at write time (the filer
-- self-attests; an admin with full booking visibility is the one who acts
-- on it, same trust model as the existing report flow).
alter table public.support_tickets
  add column if not exists related_booking_id uuid references public.bookings on delete set null;

-- Booking ID is mandatory for the 'booking' and 'payment' categories (the
-- frontend already enforces this at submit time - see MyTicketsPage.tsx -
-- this is the backstop so it can't be bypassed by calling the insert
-- directly). If this fails to apply, some existing row already has one of
-- these categories with no related_booking_id - fix or delete that row,
-- then rerun.
DO $$ BEGIN
  alter table public.support_tickets drop constraint support_tickets_booking_required_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

alter table public.support_tickets
  add constraint support_tickets_booking_required_check
  check (category not in ('booking','payment') or related_booking_id is not null);

create table if not exists public.support_ticket_events (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references public.support_tickets on delete cascade not null,
  actor text not null check (actor in ('user','admin')),
  action text not null check (action in ('created','evidence_requested','evidence_submitted','status_changed')),
  note text,
  evidence_paths text[] default array[]::text[],
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_support_ticket_events_ticket_id on public.support_ticket_events(ticket_id, created_at);

alter table public.support_ticket_events enable row level security;

-- No client-side INSERT policy — every row is written by a security-definer
-- RPC below (or the creation trigger), same "narrow RPC, audit trail, no
-- arbitrary edits" pattern as booking_events/admin_actions.
DO $$ BEGIN
  CREATE POLICY "Ticket owner and admins view ticket events" ON public.support_ticket_events FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
      OR public.is_admin(auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ticket creation itself stays a plain client INSERT into support_tickets
-- (unchanged, see SettingsPage.tsx's original flow) - this trigger just
-- guarantees every ticket gets a 'created' event in its timeline without
-- needing a second round-trip from the client.
create or replace function public.log_support_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_ticket_events (ticket_id, actor, action, note)
    values (new.id, 'user', 'created', new.description);
  return new;
end;
$$;

drop trigger if exists trg_log_support_ticket_created on public.support_tickets;
create trigger trg_log_support_ticket_created
  after insert on public.support_tickets
  for each row execute function public.log_support_ticket_created();

-- Redefined (not just extended) to also log a timeline event and notify the
-- filer of the status change - the original version (admin_system_2_rest.sql)
-- only updated the row.
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
  if p_status not in ('open','in_progress','awaiting_evidence','resolved','closed') then
    raise exception 'Invalid status';
  end if;

  update public.support_tickets
    set status = p_status,
        admin_notes = coalesce(p_notes, admin_notes),
        resolved_by = case when p_status in ('resolved','closed') then v_admin else resolved_by end,
        resolved_at = case when p_status in ('resolved','closed') then timezone('utc', now()) else resolved_at end
    where id = p_ticket_id
    returning * into v_updated;

  if not found then
    raise exception 'Ticket not found';
  end if;

  insert into public.support_ticket_events (ticket_id, actor, action, note)
    values (p_ticket_id, 'admin', 'status_changed', p_notes);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'update_ticket_status', 'ticket', p_ticket_id, jsonb_build_object('status', p_status));

  perform public.create_social_notification(
    v_updated.user_id, v_admin, 'ticket_status_updated',
    'Your ticket status changed',
    coalesce(p_notes, 'Your support ticket is now ' || replace(p_status, '_', ' ') || '.'),
    null, null, '{}'::jsonb, p_ticket_id
  );

  return v_updated;
end;
$$;

revoke all on function public.admin_update_ticket_status(uuid, text, text) from public;
grant execute on function public.admin_update_ticket_status(uuid, text, text) to authenticated;

-- Admin flags a ticket as needing more from the filer. Mirrors
-- admin_request_more_evidence's shape for booking disputes.
create or replace function public.admin_request_ticket_evidence(p_ticket_id uuid, p_note text)
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

  update public.support_tickets set status = 'awaiting_evidence'
    where id = p_ticket_id
    returning * into v_updated;

  if not found then
    raise exception 'Ticket not found';
  end if;

  insert into public.support_ticket_events (ticket_id, actor, action, note)
    values (p_ticket_id, 'admin', 'evidence_requested', p_note);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'request_ticket_evidence', 'ticket', p_ticket_id, jsonb_build_object('note', p_note));

  perform public.create_social_notification(
    v_updated.user_id, v_admin, 'ticket_evidence_requested',
    'More evidence needed for your ticket',
    coalesce(p_note, 'An admin requested more evidence for your support ticket.'),
    null, null, '{}'::jsonb, p_ticket_id
  );

  return v_updated;
end;
$$;

revoke all on function public.admin_request_ticket_evidence(uuid, text) from public;
grant execute on function public.admin_request_ticket_evidence(uuid, text) to authenticated;

-- The filer's response to an evidence request. Only allowed while the
-- ticket is actually in 'awaiting_evidence' (re-derived from the row, not
-- trusted from the caller) so this can't be used to bypass the normal
-- creation flow or reopen a resolved/closed ticket.
create or replace function public.submit_ticket_evidence(p_ticket_id uuid, p_note text default null, p_evidence_paths text[] default array[]::text[])
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_updated public.support_tickets;
begin
  update public.support_tickets set status = 'in_progress'
    where id = p_ticket_id and user_id = v_user and status = 'awaiting_evidence'
    returning * into v_updated;

  if not found then
    raise exception 'Ticket not found, not yours, or not awaiting evidence';
  end if;

  insert into public.support_ticket_events (ticket_id, actor, action, note, evidence_paths)
    values (p_ticket_id, 'user', 'evidence_submitted', p_note, coalesce(p_evidence_paths, array[]::text[]));

  return v_updated;
end;
$$;

revoke all on function public.submit_ticket_evidence(uuid, text, text[]) from public;
grant execute on function public.submit_ticket_evidence(uuid, text, text[]) to authenticated;
