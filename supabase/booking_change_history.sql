-- Post-confirmation edits to a booking's price/deliverables/description
-- (via DataService.updateBooking()) currently leave no trace anywhere —
-- only reschedule, delivery, dispute, attendance, and escrow-state changes
-- get logged to booking_events. This widens booking_events.action to add
-- 'agreement_amended', which updateBooking() will insert whenever one of
-- those three fields changes on an already-confirmed booking (comparing
-- against the previous row, storing an old->new summary in `reason`) — so
-- a "Booking changed without agreement" dispute has a real platform record
-- to check instead of only the client's word against the freelancer's.
--
-- Uses the same self-healing widen as supabase/attendance_verification.sql:
-- reads every action value actually present in the table today and unions
-- it with the full historical hardcoded set, so this is safe to run in any
-- order relative to the other migrations that touch this same constraint
-- (booking_escrow.sql, booking_checkin.sql [legacy/removed feature],
-- booking_reschedule.sql, booking_delivery_tracking.sql,
-- attendance_verification.sql) — none of them narrow what another has
-- already widened.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

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
      quote_literal('agreement_amended'),
    CASE WHEN v_existing_actions IS NOT NULL THEN ',' ELSE '' END,
    coalesce(v_existing_actions, '')
  );
END $$;
