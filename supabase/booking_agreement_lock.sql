-- Booking Agreement Lock: an immutable snapshot of what was actually
-- agreed (service, description/requirements, deliverables/inclusions,
-- price, deposit, scheduled time) taken the moment a request becomes a
-- booking. Everything else about a booking (project_name, description,
-- budget, deliverables, schedule) stays freely editable post-confirmation
-- via DataService.updateBooking()/rescheduleBooking() — this column is the
-- one place that never changes after being written once, so the dispute
-- system has a real baseline to compare "what's true now" against instead
-- of only ever seeing already-edited values.
--
-- Written once by application code (acceptRequestAndCreateBooking() in
-- src/lib/acceptRequest.ts), never updated afterward. No RLS changes
-- needed — it's just a column on public.bookings, already covered by that
-- table's existing "Users see/update own bookings" and "Admins view all
-- bookings" policies.
--
-- Run this once against your Supabase project's SQL editor.

alter table public.bookings
  add column if not exists confirmed_agreement jsonb;
