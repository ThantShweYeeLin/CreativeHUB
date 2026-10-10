-- Drops arbitrate_booking_dispute(), now fully unreachable. It had exactly
-- one remaining branch (checking for a freelancer 'conceded' booking_event
-- to auto-escalate to admin review), and that branch could only ever fire
-- while dispute_status could still reach 'open' - openBookingDispute()
-- (see supabase/dispute_single_round.sql) now sends every newly-filed
-- report straight to 'under_admin_review' instead, so dispute_status never
-- becomes 'open' any more and this function's own guard
-- (`if dispute_status <> 'open' then return`) makes every call a no-op.
-- The app's call site (useBookingTracking.ts) has already been removed.
--
-- Optional: the app no longer calls this either way, so there's no rush to
-- run this. It only removes an inert function from the schema.

drop function if exists public.arbitrate_booking_dispute(uuid);
