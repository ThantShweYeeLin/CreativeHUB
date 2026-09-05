-- Enables Supabase Realtime for direct and group messages, so a reply shows
-- up in an open conversation immediately instead of requiring a page reload.
-- Safe to re-run.

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null;
end $$;
