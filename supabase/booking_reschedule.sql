-- Wires up rescheduleBooking() (src/lib/dataService.ts, added in the
-- overlap-protection pass but never called from anywhere) behind a mutual
-- propose/accept/decline flow, per review feedback on that pass: letting
-- either participant silently move an already-accepted booking would let
-- them unilaterally change a commitment the other side relied on. Instead:
--
--   1. Either side proposes a new start/end time (reschedule_proposed_*).
--   2. The OTHER side accepts (the actual move happens then, via the
--      existing rescheduleBooking()/bookings_no_overlap exclusion
--      constraint — so a proposal can still turn out to collide with
--      something else by the time it's accepted, and is safely rejected)
--      or declines. The proposer can also withdraw it unaccepted.
--
-- "Mutual agreement" here means the UI only offers Accept/Decline to the
-- non-proposing participant — same trust boundary as counter-offers
-- elsewhere in this app (see counter_schedule.sql): RLS's "Users can
-- update own bookings" policy already restricts writes to the two actual
-- participants, which is the real security boundary; who does which half
-- of the handshake within that pair is an application-level protocol on
-- top of it, not something the database can distinguish on its own.
--
-- Run this once, after booking_overlap_protection.sql. Safe to re-run.

alter table public.bookings
  add column if not exists reschedule_proposed_start_at timestamptz,
  add column if not exists reschedule_proposed_end_at timestamptz,
  add column if not exists reschedule_proposed_by uuid references public.users(id),
  add column if not exists reschedule_proposed_reason text;

DO $$ BEGIN
  alter table public.bookings
    add constraint bookings_reschedule_end_after_start_check
    check (
      reschedule_proposed_start_at is null
      or reschedule_proposed_end_at is null
      or reschedule_proposed_end_at > reschedule_proposed_start_at
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- booking_events.action's allowlist (booking_escrow.sql) needs the three
-- new event types this flow logs.
alter table public.booking_events
  drop constraint if exists booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check
  check (action in (
    'deposit_paid','completion_submitted','confirmed',
    'complain','evidence','conceded','released','refunded','annulled',
    'checked_in','check_in_failed','location_set',
    'reschedule_proposed','reschedule_accepted','reschedule_declined','reschedule_withdrawn'
  ));
