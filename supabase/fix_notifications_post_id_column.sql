-- Root cause of "every notification shows a generic 'User' as the actor"
-- (not just one notification type — confirmed by direct testing that
-- create_social_notification() fails on every call on this database):
--
-- create_social_notification() (see supabase/fix_notifications_related_id.sql)
-- inserts into public.notifications' post_id and comment_id columns, but
-- those columns were only ever defined inside an old, still-unresolved git
-- merge-conflict block in supabase/schema.sql (search that file for
-- "eb039740 (For you page)") and were never actually applied to this
-- database — confirmed directly: a plain select against public.notifications
-- returns no post_id/comment_id key at all. Every call to
-- create_social_notification() has therefore been failing with "column
-- post_id does not exist", and dataService.ts's createNotification()
-- silently falls back to the legacy create_app_notification() RPC, whose
-- body has no actor_id/metadata columns at all — so actor_id ends up null
-- on every notification, and the UI falls back to a generic "User" label
-- (see also supabase/fix_notifications_actor_fk.sql, which fixed a
-- different, already-applied part of this same underlying problem — the
-- actor_id foreign key target — but not this).
--
-- The original conflicted block pointed post_id/comment_id at public.posts
-- and public.post_comments, the unused Instagram-style schema that was
-- never actually created here (also confirmed directly) — this points them
-- at the real, live tables instead: client_posts / client_post_comments.

alter table public.notifications
  add column if not exists post_id uuid references public.client_posts(id) on delete cascade,
  add column if not exists comment_id uuid references public.client_post_comments(id) on delete cascade;
