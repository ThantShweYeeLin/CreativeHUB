-- Reported: any signed-in user could open /messages and see conversations
-- that don't belong to them. Every committed migration for conversations/
-- messages (schema.sql, rls_fixes.sql, blocking.sql) already scopes SELECT/
-- INSERT/UPDATE to auth.uid() = participant_1_id/participant_2_id (or
-- sender_id/recipient_id for messages) - the application code's own query
-- (DataService.getUserConversations) also filters by the signed-in user's
-- own id. Nothing in the committed files explains a leak.
--
-- This repo has already hit this exact class of bug once before -
-- lock_down_anonymous_access.sql's own header explains that the live
-- database's actual policies can drift from what's committed here (a
-- script run partially, a policy edited by hand in the dashboard, an
-- old permissive policy from before a rename that was never dropped,
-- etc.) - so rather than guess further at what's live, this
-- unconditionally drops and recreates every conversations/messages policy
-- exactly as committed. Safe to re-run; this is the fix regardless of
-- whatever the live policies currently actually say.
--
-- Run this once against your Supabase project's SQL editor.

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users can view own conversations" on public.conversations;
drop policy if exists "Users see own conversations" on public.conversations;
create policy "Users can view own conversations" on public.conversations
  for select using (auth.uid() = participant_1_id or auth.uid() = participant_2_id);

drop policy if exists "Users can create own conversations" on public.conversations;
create policy "Users can create own conversations" on public.conversations
  for insert with check (
    (auth.uid() = participant_1_id or auth.uid() = participant_2_id)
    and not public.is_blocked(participant_1_id, participant_2_id)
  );

drop policy if exists "Participants can update own conversations" on public.conversations;
create policy "Participants can update own conversations" on public.conversations
  for update
  using (auth.uid() = participant_1_id or auth.uid() = participant_2_id)
  with check (auth.uid() = participant_1_id or auth.uid() = participant_2_id);

drop policy if exists "Users see own messages" on public.messages;
create policy "Users see own messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Defence in depth, same as lock_down_anonymous_access.sql step 2: even a
-- stray permissive policy can't expose this table to a role with no
-- underlying grant at all. anon should never have reached these tables
-- (messaging requires a session), and this makes that explicit rather than
-- relying solely on RLS.
revoke all on public.conversations from anon;
revoke all on public.messages from anon;

-- Verify after running: this should list exactly the policies above, each
-- with roles = {authenticated}, nothing with roles = {public} or {anon},
-- and nothing with a USING/WITH CHECK of "true".
--   select policyname, roles, cmd, qual, with_check
--   from pg_policies
--   where tablename in ('conversations', 'messages')
--   order by tablename, policyname;
