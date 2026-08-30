-- Fixes booking/payment notifications always showing a generic "User" as
-- the actor instead of the real client/freelancer name.
--
-- Root cause: notifications.actor_id's foreign key points at
-- public.profiles (the separate For-You social-feed table), not at the
-- universal identity table. A normal client/freelancer who has a
-- public.users row but no public.profiles row (i.e. never touched the
-- social feed) can't be referenced there — inserting their id as actor_id
-- violates the FK, the primary create_social_notification() RPC call
-- errors out, and dataService.ts's createNotification() silently falls
-- back to the legacy create_app_notification() RPC, whose SQL body has no
-- actor_id column at all (see supabase/rls_fixes.sql). The result: actor_id
-- ends up null on every booking/payment notification for any such user,
-- and the UI falls back to a generic "User" label.
--
-- Both public.users.id and public.profiles.id ultimately reference
-- auth.users.id as their own primary key, so pointing the FK there instead
-- covers every account type. Already applied directly to the live
-- database via the SQL editor — this file just documents/reproduces that
-- change for fresh environments.

alter table public.notifications drop constraint if exists notifications_actor_id_fkey;

alter table public.notifications
  add constraint notifications_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
