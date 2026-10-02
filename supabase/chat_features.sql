-- Brings the regular 1:1/group chat (MessagesPage.tsx) closer to a normal
-- chat app: photo/file attachments, emoji reactions, and reply-to-message.
-- "Seen" read receipts and the typing indicator need no schema changes —
-- messages.read already exists, and typing uses an ephemeral Realtime
-- broadcast channel rather than a table (see RequestChatThread-style
-- comments in dataService.ts for why: a DB row per keystroke would be
-- wasteful and has no reason to ever persist).
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_type text,
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

-- Private attachment bucket, folder layout {senderUserId}/{conversationId}/{filename} -
-- same pattern as booking-evidence (booking_escrow.sql).
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do update set public = excluded.public;

DO $$ BEGIN
  CREATE POLICY "Participants view message attachments" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'message-attachments'
      AND EXISTS (
        SELECT 1 FROM public.conversations
        WHERE conversations.id::text = (storage.foldername(name))[2]
        AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Senders upload their own message attachments" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'message-attachments'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.conversations
        WHERE conversations.id::text = (storage.foldername(name))[2]
        AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reactions: one emoji per user per message (tapping a different one
-- replaces it, same as Messenger/iMessage, not a growing list of past
-- reactions from the same person).
create table if not exists public.message_reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (message_id, user_id)
);

create index if not exists idx_message_reactions_message_id on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

DO $$ BEGIN
  CREATE POLICY "Conversation participants view reactions" ON public.message_reactions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_id AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their own reactions" ON public.message_reactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_id AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

revoke all on public.message_reactions from anon;
