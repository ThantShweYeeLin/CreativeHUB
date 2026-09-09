-- Closes a gap flagged in review of booking_overlap_protection.sql: the
-- exclusion constraint stops two bookings from *overlapping*, but nothing
-- stopped a single row from having a nonsensical range in the first place
-- (end_at <= start_at) or a negative deposit_amount. The frontend already
-- validates end > start (FreelancerProfile.tsx, GroupRequestPage.tsx), but
-- that's UX only — a buggy or malicious direct write must still be
-- rejected by the database itself, same reasoning as bookings_no_overlap.
--
-- Run this once, after booking_overlap_protection.sql. Safe to re-run.

DO $$ BEGIN
  alter table public.bookings
    add constraint bookings_end_after_start_check
    check (start_at is null or end_at is null or end_at > start_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  alter table public.bookings
    add constraint bookings_deposit_amount_nonnegative_check
    check (deposit_amount is null or deposit_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same defect is possible on the request side too (a request never blocks
-- the calendar, but its start_date/start_time/end_time are still real data
-- read back and displayed — e.g. the calendar's pending-request markers —
-- so they should still be internally consistent).
DO $$ BEGIN
  alter table public.requests
    add constraint requests_end_after_start_check
    check (start_time is null or end_time is null or end_time > start_time);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
