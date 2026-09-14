-- The freelancer-response round (dispute_status = 'open', dispute_awaiting
-- = 'freelancer'/'client') is retired — a client's report now goes
-- straight to dispute_status = 'under_admin_review' (see
-- DataService.openBookingDispute). This bumps any booking still sitting in
-- the old 'open' state so it isn't stranded waiting for a freelancer
-- response UI that no longer appears; the freelancer's tracking page now
-- just shows "Deposit Frozen" while admin support decides.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run
-- (a no-op once nothing is left in 'open').

update public.bookings
set dispute_status = 'under_admin_review',
    dispute_awaiting = null,
    dispute_response_deadline = null
where dispute_status = 'open';
