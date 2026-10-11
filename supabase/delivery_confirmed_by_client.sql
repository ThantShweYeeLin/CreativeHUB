-- Flips who starts the Result Delivery conversation: the client now
-- confirms whether a booking includes post-appointment deliverables
-- (edited photos, video, files, ...), and only once they've said yes does
-- the freelancer get asked for an estimated delivery date. Previously the
-- freelancer alone declared "no deliverables" with nothing to check that
-- against - a real accountability gap in an escrow system built around
-- exactly this kind of mutual confirmation (see booking_delivery_tracking.sql).
--
-- delivery_status itself is unchanged (still 'not_applicable' | 'pending' |
-- 'in_progress' | 'delivered', see bookings_delivery_status_check) - the
-- client's "yes" lands on 'pending' with estimated_delivery_at still null,
-- which the UI reads as "confirmed, awaiting the freelancer's estimate"
-- rather than needing a fifth status value.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.
alter table public.booking_events
  drop constraint if exists booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check
  check (action in (
    'deposit_paid','completion_submitted','confirmed',
    'complain','evidence','conceded','released','refunded','annulled',
    'checked_in','check_in_failed','location_set',
    'reschedule_proposed','reschedule_accepted','reschedule_declined','reschedule_withdrawn',
    'delivery_date_set','delivery_date_updated','deliverables_marked_in_progress','deliverables_delivered',
    'deliverables_confirmed'
  ));
