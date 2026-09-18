-- Diagnostic + fix for "notifications only show up after a refresh".
--
-- The bell (MainLayout.tsx) and the requests list (RequestsPage.tsx /
-- FreelancerDashboard.tsx) both already subscribe to Supabase Realtime — but
-- Realtime only pushes a row the instant it changes if that table has
-- actually been added to the `supabase_realtime` publication in THIS
-- project. If that step was skipped (or schema.sql was only partially run),
-- everything still works, just silently falls back to "you'll see it next
-- time you load the page" — which matches exactly what's being reported.

-- Step 1 — run this first to see what's actually live right now:
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
-- If 'notifications', 'requests', or 'bookings' is missing from the result,
-- that confirms the gap. Run the block below either way — it's idempotent.

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.requests;
exception when duplicate_object then null;
end $$;

-- Booking status/payment/dispute changes and timeline events (e.g. the other
-- party confirms attendance, an admin decides a dispute, deposit gets paid)
-- now push live to BookingTrackingClientPage/BookingTrackingFreelancerPage
-- via useBookingTracking's new subscription.
do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.booking_events;
exception when duplicate_object then null;
end $$;
