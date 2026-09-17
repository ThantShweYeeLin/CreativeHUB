-- Phase 1 (private admin notes) + Phase 3 (ticket lifecycle) of the ticket
-- safety/workflow fix. Run this once against your Supabase project's SQL
-- editor, after admin_system_2_rest.sql, support_ticket_messages.sql, and
-- support_ticket_evidence.sql already exist.
--
-- ============================================================
-- PHASE 1 — Genuinely private admin notes
-- ============================================================
--
-- The bug being fixed: admin_update_ticket_status's p_notes argument was
-- being written into TWO owner-readable places — support_tickets.admin_notes
-- (readable by the ticket owner via the table's normal row-level RLS, which
-- only checks user_id = auth.uid(), not which column) AND a
-- support_ticket_events row (whose SELECT policy explicitly grants the
-- ticket owner read access, and which TicketDetailPage/AdminTicketDetail
-- both render as a "Timeline" — the SAME feed for both roles). Worse, the
-- note text was also used verbatim as the body of the notification sent TO
-- the user. So an admin's private reasoning was pushed to the user through
-- three separate channels, none of which the frontend "hiding" it would
-- have fixed — this closes each one at the database layer.

create table if not exists public.support_ticket_admin_notes (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references public.support_tickets(id) on delete cascade not null,
  admin_id uuid references public.users on delete set null,
  note text not null,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_support_ticket_admin_notes_ticket_id
  on public.support_ticket_admin_notes(ticket_id, created_at);

alter table public.support_ticket_admin_notes enable row level security;

-- Admin-only, full stop — unlike every other ticket-related table
-- (support_ticket_events, support_ticket_messages), there is deliberately
-- no "OR user_id = auth.uid()" clause here. This is what makes it actually
-- private, not just unrendered in one screen.
DO $$ BEGIN
  CREATE POLICY "Admins only can view internal ticket notes" ON public.support_ticket_admin_notes FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No INSERT/UPDATE/DELETE policy at all — every write goes through
-- admin_add_ticket_note or admin_update_ticket_status below (both
-- security-definer), the same "narrow RPC, audit trail, no arbitrary
-- edits" pattern support_ticket_events/admin_actions already use.

-- Lets an admin jot a note without necessarily changing status (the
-- existing admin_update_ticket_status flow below covers the "note attached
-- to a status change" case).
create or replace function public.admin_add_ticket_note(p_ticket_id uuid, p_note text)
returns public.support_ticket_admin_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_inserted public.support_ticket_admin_notes;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'Ticket not found';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Note cannot be empty';
  end if;

  insert into public.support_ticket_admin_notes (ticket_id, admin_id, note)
    values (p_ticket_id, v_admin, p_note)
    returning * into v_inserted;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'add_ticket_note', 'ticket', p_ticket_id, '{}'::jsonb);

  return v_inserted;
end;
$$;

revoke all on function public.admin_add_ticket_note(uuid, text) from public;
grant execute on function public.admin_add_ticket_note(uuid, text) to authenticated;

-- ---- Remediation: move any already-exposed note content into the new
-- ---- private table, then scrub it from the owner-readable places it was
-- ---- living in. Safe to run more than once (idempotent on empty sources).

-- 1) Any existing support_tickets.admin_notes content. There's no reliable
--    "which admin wrote this" for historical rows (the column never
--    tracked an author), so these are attributed to resolved_by when set
--    (the admin who most recently touched the ticket) and left unattributed
--    (admin_id null) otherwise — still private either way, just not
--    perfectly credited.
insert into public.support_ticket_admin_notes (ticket_id, admin_id, note, created_at)
select id, resolved_by, admin_notes, coalesce(resolved_at, created_at)
from public.support_tickets
where admin_notes is not null and trim(admin_notes) <> '';

-- 2) Any existing status_changed event whose note carries the same leaked
--    text (inserted by the old version of admin_update_ticket_status below).
--    Migrated separately from (1) since an event exists per status change,
--    not per ticket, so a ticket resolved/reopened more than once could
--    have more than one leaked note.
insert into public.support_ticket_admin_notes (ticket_id, admin_id, note, created_at)
select e.ticket_id, t.resolved_by, e.note, e.created_at
from public.support_ticket_events e
join public.support_tickets t on t.id = e.ticket_id
where e.actor = 'admin' and e.action = 'status_changed' and e.note is not null and trim(e.note) <> '';

-- 3) Scrub the now-migrated content from the user-visible timeline — keep
--    the event itself (so "status changed on <date>" still shows), just
--    remove the private text that was riding along with it.
update public.support_ticket_events
  set note = null
  where actor = 'admin' and action = 'status_changed' and note is not null;

-- 4) Drop the column entirely rather than just leaving it null going
--    forward — a dropped column can never leak again through some future
--    code path that forgets this rule; a null-but-present column still
--    could. Nothing else reads/writes support_tickets.admin_notes after
--    this file (admin_update_ticket_status is redefined below to stop
--    touching it, and the one UI that rendered it — AdminTicketDetail.tsx
--    — is updated to read from support_ticket_admin_notes instead).
alter table public.support_tickets drop column if exists admin_notes;

-- ---- Redefine admin_update_ticket_status: p_notes now goes into the
-- ---- private notes table instead of the public event/notification. If an
-- ---- admin wants the USER to see something about a status change, that's
-- ---- what the reply thread (support_ticket_messages) is for — this keeps
-- ---- the two channels (private reasoning vs. message to the user)
-- ---- genuinely separate instead of one field trying to be both.
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
        resolved_by = case when p_status in ('resolved','closed') then v_admin else resolved_by end,
        resolved_at = case when p_status in ('resolved','closed') then timezone('utc', now()) else resolved_at end
    where id = p_ticket_id
    returning * into v_updated;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if p_notes is not null and trim(p_notes) <> '' then
    insert into public.support_ticket_admin_notes (ticket_id, admin_id, note)
      values (p_ticket_id, v_admin, p_notes);
  end if;

  -- No note text here anymore — see the private-notes insert above instead.
  insert into public.support_ticket_events (ticket_id, actor, action, note)
    values (p_ticket_id, 'admin', 'status_changed', null);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'update_ticket_status', 'ticket', p_ticket_id, jsonb_build_object('status', p_status));

  -- Always a generic, non-sensitive message — never p_notes' content.
  perform public.create_social_notification(
    v_updated.user_id, v_admin, 'ticket_status_updated',
    'Your ticket status changed',
    'Your support ticket is now ' || replace(p_status, '_', ' ') || '.',
    null, null, '{}'::jsonb, p_ticket_id
  );

  return v_updated;
end;
$$;

revoke all on function public.admin_update_ticket_status(uuid, text, text) from public;
grant execute on function public.admin_update_ticket_status(uuid, text, text) to authenticated;

-- ============================================================
-- PHASE 3 — Ticket lifecycle transitions
-- ============================================================

-- 'reopened' is a new action value for the timeline — used below when a
-- user's reply reopens a resolved/awaiting-evidence ticket.
DO $$ BEGIN
  alter table public.support_ticket_events drop constraint support_ticket_events_action_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

alter table public.support_ticket_events
  add constraint support_ticket_events_action_check
  check (action in ('created','evidence_requested','evidence_submitted','status_changed','reopened'));

-- A closed ticket is "finished, no further action expected" — nobody
-- (owner or admin) can post a new message until an admin explicitly moves
-- it off 'closed' via admin_update_ticket_status first. Enforced here, not
-- just in the UI, so this holds even against a direct PostgREST call.
DO $$ BEGIN
  DROP POLICY "Ticket owner or admin can send messages" ON public.support_ticket_messages;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Ticket owner or admin can send messages" ON public.support_ticket_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    )
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.status <> 'closed')
  );

-- A user's own reply to a resolved ticket reopens it (back to in_progress —
-- there's more to review again, same as a fresh reply); a reply while
-- awaiting_evidence returns it to in_progress too, for the general
-- conversation composer (submit_ticket_evidence, support_ticket_evidence.sql,
-- already does this specifically for its own dedicated "submit evidence"
-- form — this covers a plain reply typed into the regular thread instead).
-- Admin replies never trigger this — an admin already controls status
-- directly, and an admin continuing to reply on a resolved ticket isn't a
-- signal that the ticket needs reopening.
create or replace function public.handle_ticket_message_reopen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
begin
  select * into v_ticket from public.support_tickets where id = new.ticket_id;

  if v_ticket.user_id = new.sender_id and v_ticket.status in ('resolved', 'awaiting_evidence') then
    update public.support_tickets set status = 'in_progress' where id = new.ticket_id;
    insert into public.support_ticket_events (ticket_id, actor, action, note)
      values (
        new.ticket_id, 'user', 'reopened',
        case v_ticket.status
          when 'resolved' then 'Ticket reopened after a new reply.'
          else 'Returned to review after a response.'
        end
      );
  end if;

  return new;
end;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_handle_ticket_message_reopen
    AFTER INSERT ON public.support_ticket_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_message_reopen();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
