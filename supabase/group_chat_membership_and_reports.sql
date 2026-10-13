-- Lets the existing 1:1 "Report Spam" / "Block" actions
-- (DataService.reportAndBlock/blockUser, see MessagesPage.tsx's message-
-- request banner) also work against a member of a group chat, not just a
-- direct conversation.
--
-- message_reports.conversation_id is a typed FK into public.conversations
-- (blocking.sql) - it can't hold a group_conversations id. Rather than
-- loosen that FK's target (which would let a report point at either table
-- with nothing enforcing which), this adds a second, equally typed,
-- equally optional column for the group case - a report is against either
-- a 1:1 thread or a group chat, never both.
--
-- No new table or RLS needed for "add people to a group chat" - the
-- group_conversation_members policies already added in rls_fixes.sql
-- ("Conversation owners can add members") already allow exactly this; the
-- app code and UI are what's missing, not the database.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

alter table public.message_reports
  add column if not exists group_conversation_id uuid references public.group_conversations on delete set null;
