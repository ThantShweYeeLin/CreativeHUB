-- Lets a counter offer also propose a different END time, not just a new
-- start time. supabase/counter_schedule.sql added counter_date/counter_time,
-- but a counter's end time was never stored anywhere — accepting a counter
-- just carried the ORIGINAL request's duration forward instead (see
-- src/lib/acceptRequest.ts). Run this once against your Supabase project's
-- SQL editor.

alter table public.requests
  add column if not exists counter_end_time time;

alter table public.request_offers
  add column if not exists end_time time;

-- Also needed for the requests list (RequestsPage.tsx / FreelancerDashboard.tsx)
-- to live-update when the other party counters/accepts/rejects, instead of
-- only ever refreshing on page load — mirrors notifications/messages/posts
-- already being on this publication (see supabase/schema.sql).
do $$
begin
  alter publication supabase_realtime add table public.requests;
exception when duplicate_object then null;
end $$;
