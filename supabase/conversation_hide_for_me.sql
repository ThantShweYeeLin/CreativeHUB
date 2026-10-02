-- "Delete chat" without blocking - WhatsApp/Messenger-style: hides a
-- conversation from the caller's own inbox only, keeps it fully intact for
-- the other participant, and quietly un-hides itself for the caller the
-- next time the other person actually sends a new message (so "delete"
-- never silently drops future messages the way blocking would). Nothing
-- here touches blocked_users/is_blocked (blocking.sql) - this is a
-- deliberately separate, much weaker action.
--
-- Run this once against your Supabase project's SQL editor, after
-- schema.sql and blocking.sql already exist. Safe to re-run.

alter table public.conversations
  add column if not exists participant_1_hidden_at timestamptz,
  add column if not exists participant_2_hidden_at timestamptz;

-- Runs as the owner so it can write a column the caller doesn't directly
-- have UPDATE access to pick between - the existing "Participants can
-- update own conversations" policy (blocking.sql) has no column-level
-- restriction, so a plain client-side update could otherwise let a user
-- set the *other* participant's hidden flag instead of their own.
create or replace function public.hide_conversation_for_me(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conversation public.conversations;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'Conversation not found';
  end if;

  if v_conversation.participant_1_id = v_uid then
    update public.conversations set participant_1_hidden_at = timezone('utc', now()) where id = p_conversation_id;
  elsif v_conversation.participant_2_id = v_uid then
    update public.conversations set participant_2_hidden_at = timezone('utc', now()) where id = p_conversation_id;
  else
    raise exception 'Not a participant on this conversation';
  end if;
end;
$$;

revoke all on function public.hide_conversation_for_me(uuid) from public;
grant execute on function public.hide_conversation_for_me(uuid) to authenticated;
