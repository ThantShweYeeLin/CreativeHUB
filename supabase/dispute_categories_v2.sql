-- Widens booking_events.category for the new 8-category dispute flow
-- (replacing the old 4-option "Report a Problem" form with a dynamic,
-- per-category flow). Adds the 4 categories that had no equivalent before:
--   late_arrival                 -> "Freelancer arrived late"
--   additional_payment_requested -> "Additional payment requested"
--   unauthorized_change          -> "Booking changed without agreement"
--   unexpected_cancellation      -> "Unexpected cancellation"
-- 'no_show' already existed in the allowlist (left over from the earlier
-- GPS check-in era) but nothing writes it yet — the new flow finally wires
-- it up as "Freelancer didn't show up".
--
-- 'differed_from_agreement' is NOT reused by the new flow — that concern
-- now routes to Reviews instead of the dispute system (see the "Service
-- differed from agreement"/"Quality issue" routing in the report-a-problem
-- redesign). The value stays in the allowlist so old disputed bookings
-- that already used it keep displaying correctly; the new category picker
-- simply never writes it again, same pattern this migration's own
-- predecessor (dispute_category_deliverables_not_received.sql) used for
-- the legacy 'not_as_agreed' value.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

alter table public.booking_events drop constraint if exists booking_events_category_check;

alter table public.booking_events add constraint booking_events_category_check
  check (category in (
    'no_show','not_performed','differed_from_agreement','not_as_agreed',
    'deliverables_not_received','other',
    'late_arrival','additional_payment_requested','unauthorized_change','unexpected_cancellation'
  ));
