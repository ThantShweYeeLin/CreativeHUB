-- Re-asserts that a support ticket (payment/technical/general question,
-- filed via My Tickets → Create a Ticket) is private to its owner and
-- admins only — NOT the other party on a related booking, even if the
-- ticket references related_booking_id. This is already what the schema
-- says (see admin_system_2_rest.sql, support_ticket_evidence.sql,
-- support_ticket_messages.sql, support_ticket_privacy_and_lifecycle.sql),
-- but those use `CREATE POLICY ... EXCEPTION WHEN duplicate_object THEN
-- NULL`, which silently no-ops if a policy by that name already exists —
-- including a wrong one. This file instead DROPS each policy first, so it
-- unconditionally re-applies the correct definition regardless of
-- whatever is currently live.
--
-- NOTE: this is deliberately unrelated to booking disputes
-- (bookings.dispute_status / dispute_evidence) — a dispute is meant to be
-- visible to BOTH the client and freelancer on that booking, since
-- resolving it requires both sides to see each other's evidence. Only
-- plain support tickets are private to a single filer + admin.
--
-- Run this once against your Supabase project's SQL editor.

alter table public.support_tickets enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_admin_notes enable row level security;

drop policy if exists "Users see own tickets, admins see all" on public.support_tickets;
create policy "Users see own tickets, admins see all" on public.support_tickets for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Ticket owner and admins view ticket events" on public.support_ticket_events;
create policy "Ticket owner and admins view ticket events" on public.support_ticket_events for select
  using (
    exists (select 1 from public.support_tickets where id = ticket_id and user_id = auth.uid())
    or public.is_admin(auth.uid())
  );

drop policy if exists "Ticket owner or admin can view messages" on public.support_ticket_messages;
create policy "Ticket owner or admin can view messages" on public.support_ticket_messages for select
  using (
    public.is_admin(auth.uid())
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

drop policy if exists "Admins only can view internal ticket notes" on public.support_ticket_admin_notes;
create policy "Admins only can view internal ticket notes" on public.support_ticket_admin_notes for select
  using (public.is_admin(auth.uid()));

-- Storage: a ticket's own screenshot and any reply attachments, same
-- owner-or-admin scoping (see admin_system_2_rest.sql / support_ticket_messages.sql).
drop policy if exists "Uploaders and admins view report evidence" on storage.objects;
create policy "Uploaders and admins view report evidence" on storage.objects for select
  using (
    bucket_id = 'report-evidence'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "Ticket owner can view reply attachments on their own ticket" on storage.objects;
create policy "Ticket owner can view reply attachments on their own ticket" on storage.objects for select
  using (
    bucket_id = 'report-evidence'
    and exists (
      select 1 from public.support_ticket_messages m
      join public.support_tickets t on t.id = m.ticket_id
      where m.attachment_path = storage.objects.name and t.user_id = auth.uid()
    )
  );

-- Verification — after running the above, this should show ONLY 'auth.uid()
-- = user_id OR is_admin(...)'-style qualifiers on each ticket table, never
-- anything referencing client_id/freelancer_id or a booking join:
--   select tablename, policyname, cmd, qual
--   from pg_policies
--   where tablename in ('support_tickets', 'support_ticket_events', 'support_ticket_messages', 'support_ticket_admin_notes')
--   order by tablename, policyname;
