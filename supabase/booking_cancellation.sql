-- There is currently no way for a client or freelancer to cancel an
-- already-confirmed booking with a captured reason — cancellation_reason
-- (booking_escrow.sql) is only ever system-written to 'deposit_not_paid'
-- when a deposit deadline lapses. This adds real participant-initiated
-- cancellation so an "Unexpected cancellation" dispute has an actual
-- platform record (who cancelled, when, why) instead of relying entirely
-- on the other party's account.
--
-- cancelled_by/cancelled_at are set by application code
-- (DataService.cancelBooking()), alongside the existing cancellation_reason
-- column and booking.status -> 'cancelled'. No new RLS needed for the
-- columns themselves — already covered by bookings' existing "Users can
-- update own bookings" policy (any participant can update their own
-- booking's row).
--
-- Also widens booking_events.action to add 'cancelled', using the same
-- self-healing widen as booking_change_history.sql/attendance_verification.sql
-- (reads existing action values from the table and unions with the full
-- historical hardcoded set, so this is order-independent against every
-- other migration that touches this constraint).
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

alter table public.bookings
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancelled_at timestamptz;

DO $$
DECLARE
  v_existing_actions text;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(action), ',') INTO v_existing_actions FROM public.booking_events;

  EXECUTE 'alter table public.booking_events drop constraint if exists booking_events_action_check';
  EXECUTE format(
    'alter table public.booking_events add constraint booking_events_action_check check (action in (%s%s%s))',
    quote_literal('deposit_paid') || ',' || quote_literal('completion_submitted') || ',' || quote_literal('confirmed') || ',' ||
      quote_literal('complain') || ',' || quote_literal('evidence') || ',' || quote_literal('conceded') || ',' ||
      quote_literal('released') || ',' || quote_literal('refunded') || ',' || quote_literal('annulled') || ',' ||
      quote_literal('checked_in') || ',' || quote_literal('check_in_failed') || ',' || quote_literal('location_set') || ',' ||
      quote_literal('reschedule_proposed') || ',' || quote_literal('reschedule_accepted') || ',' ||
      quote_literal('reschedule_declined') || ',' || quote_literal('reschedule_withdrawn') || ',' ||
      quote_literal('delivery_date_set') || ',' || quote_literal('delivery_date_updated') || ',' ||
      quote_literal('deliverables_marked_in_progress') || ',' || quote_literal('deliverables_delivered') || ',' ||
      quote_literal('presence_confirmed') || ',' || quote_literal('attendance_report_submitted') || ',' ||
      quote_literal('attendance_evidence_requested') || ',' || quote_literal('attendance_report_resolved') || ',' ||
      quote_literal('agreement_amended') || ',' || quote_literal('cancelled'),
    CASE WHEN v_existing_actions IS NOT NULL THEN ',' ELSE '' END,
    coalesce(v_existing_actions, '')
  );
END $$;
