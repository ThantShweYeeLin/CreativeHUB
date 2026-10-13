-- No column in requests/bookings has ever stopped client_id = freelancer_id
-- - unlike blocking.sql's blocker_id <> blocked_id or schema.sql's
-- follower_id <> following_id, both the same shape of self-reference guard.
-- Found live on this project: a user whose account is role = 'client' but
-- who still has a (dormant, pre-role-switch) freelancer_profiles row showed
-- up as a bookable candidate in their OWN Event Matcher search and in
-- RequestsPage.tsx's "Add Another Freelancer"/recipients list - neither of
-- those client-side lists excluded the viewer's own id, so nothing stopped
-- them selecting themselves and sending a request to themselves. The app
-- code paths are fixed separately (EventMatcherPage.tsx, RequestsPage.tsx);
-- this is the database-level backstop for any current or future path that
-- creates a requests/bookings row directly.
--
-- Two existing requests rows already violate this (both already terminal -
-- 'cancelled' and 'rejected', never accepted into a real booking - bookings
-- has zero violations) - deleted first since a CHECK constraint can't be
-- added while existing rows fail it.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

delete from public.requests where client_id = freelancer_id;

do $$ begin
  alter table public.requests add constraint requests_not_self_booking check (client_id <> freelancer_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bookings add constraint bookings_not_self_booking check (client_id <> freelancer_id);
exception when duplicate_object then null; end $$;
