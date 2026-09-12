-- Some creative services don't end when the appointment does (a
-- photographer's edited photos, a videographer's cut, a designer's final
-- files arrive later) while others are immediate (makeup, hair). This adds
-- an OPTIONAL, freelancer-declared "estimated result delivery" separate
-- from the booking's financial/escrow lifecycle — booking.status already
-- tracks the service appointment and deposit, and stays untouched here;
-- delivery_status is its own independent axis, exactly the "service
-- completion vs result delivery are two different milestones" distinction.
--
-- delivery_status is nullable with no default (not 'not_applicable') so
-- every booking starts in an explicit "not yet decided" state — the UI
-- only shows a delivery story once the freelancer has actually said
-- whether one applies, rather than presuming either way for a service
-- (e.g. makeup) that was never going to have one.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

alter table public.bookings
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists delivery_status text,
  add column if not exists delivery_notes text;

DO $$ BEGIN
  alter table public.bookings
    add constraint bookings_delivery_status_check
    check (delivery_status is null or delivery_status in ('not_applicable', 'pending', 'in_progress', 'delivered'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- booking_events.action's allowlist needs the delivery lifecycle's own
-- event types, so freelancer-set/updated estimates and delivery-status
-- changes become part of the same timeline/evidence trail everything else
-- (deposit paid, checked in, rescheduled, ...) already uses — no second
-- event system, per the existing booking_events convention.
alter table public.booking_events
  drop constraint if exists booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check
  check (action in (
    'deposit_paid','completion_submitted','confirmed',
    'complain','evidence','conceded','released','refunded','annulled',
    'checked_in','check_in_failed','location_set',
    'reschedule_proposed','reschedule_accepted','reschedule_declined','reschedule_withdrawn',
    'delivery_date_set','delivery_date_updated','deliverables_marked_in_progress','deliverables_delivered'
  ));
