-- Two-way conversation on top of the existing support_tickets table
-- (admin_system_2_rest.sql). Previously a ticket was a single description
-- the user filed and an admin could only change the status of - there was
-- no way for an admin to actually reply, and no way for the user to see a
-- reply if one existed. This adds a message thread, reusing the existing
-- report-evidence bucket for attachments (same per-uploader-folder pattern
-- already used for the ticket's own screenshot_path) instead of a new
-- bucket or a separate attachments table.

create table if not exists public.support_ticket_messages (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references public.support_tickets(id) on delete cascade not null,
  sender_id uuid references public.users on delete cascade not null,
  message text not null,
  attachment_path text,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists support_ticket_messages_ticket_id_idx
  on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

DO $$ BEGIN
  CREATE POLICY "Ticket owner or admin can view messages" ON public.support_ticket_messages FOR SELECT
    USING (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Ticket owner or admin can send messages" ON public.support_ticket_messages FOR INSERT
    WITH CHECK (
      sender_id = auth.uid()
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The existing report-evidence bucket policy only lets a viewer see files in
-- their own uploader folder (or lets admins see everything) - fine for a
-- user's own screenshot, but it means a ticket owner couldn't view an
-- attachment an admin uploads to a *reply*, since that file lives in the
-- admin's folder, not theirs. This adds read access to any attachment that's
-- actually linked to a message on a ticket the viewer owns, regardless of
-- whose folder it was uploaded into.
DO $$ BEGIN
  CREATE POLICY "Ticket owner can view reply attachments on their own ticket" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'report-evidence'
      AND EXISTS (
        SELECT 1 FROM public.support_ticket_messages m
        JOIN public.support_tickets t ON t.id = m.ticket_id
        WHERE m.attachment_path = storage.objects.name AND t.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifies the ticket's owner whenever an admin replies, mirroring the
-- notification admin_resolve_user_report() already sends on its own table.
-- A trigger (rather than doing this in application code) means every reply
-- notifies regardless of which client/admin screen sent it.
create or replace function public.notify_on_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
begin
  select * into v_ticket from public.support_tickets where id = new.ticket_id;

  if v_ticket.user_id != new.sender_id and public.is_admin(new.sender_id) then
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
      values (
        v_ticket.user_id, new.sender_id, 'ticket_reply',
        'New reply on your ticket',
        'An admin replied to your support ticket.',
        new.ticket_id, false
      );
  end if;

  return new;
end;
$$;

DO $$ BEGIN
  CREATE TRIGGER support_ticket_message_notify
    AFTER INSERT ON public.support_ticket_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_ticket_message();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
