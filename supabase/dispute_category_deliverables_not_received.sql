-- Adds a 5th dispute category so "the service happened, but I never got my
-- files" has a real option instead of forcing a client to pick 'other'.
-- Reuses the existing dispute mechanism/RPCs entirely — this is not a
-- second delivery-tracking system, just one more value clients and the
-- admin dispute UI can select/display. The delivery_status/estimated_
-- delivery_at fields and their booking_events actions (from
-- booking_delivery_tracking.sql) are untouched; this only widens the
-- dispute *category* they can now be reported under.
--
-- Widening (not replacing) dispute_categories.sql's 4-value set —
-- historical migration files stay as-is, this is an additive follow-up,
-- same pattern that file itself used over its own predecessor.

alter table public.booking_events drop constraint if exists booking_events_category_check;

alter table public.booking_events add constraint booking_events_category_check
  check (category in ('no_show','not_performed','differed_from_agreement','not_as_agreed','deliverables_not_received','other'));
