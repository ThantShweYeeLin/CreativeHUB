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
-- Uses the same self-healing widen as supabase/booking_change_history.sql
-- and supabase/attendance_verification.sql: reads every action value
-- actually present in the table today and unions it with the historical
-- hardcoded set, rather than trusting a hardcoded list to already be
-- complete (an earlier version of this file hardcoded the list from
-- booking_delivery_tracking.sql alone and broke on a live project that
-- also had presence_confirmed/attendance_report_submitted/
-- attendance_report_resolved/cancelled/arrival_recorded rows from
-- migrations this file's static list didn't know about) - safe to run in
-- any order relative to the others that touch this same constraint.
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
      quote_literal('arrival_recorded') || ',' || quote_literal('agreement_amended') || ',' || quote_literal('cancelled') || ',' ||
      quote_literal('deliverables_confirmed'),
    CASE WHEN v_existing_actions IS NOT NULL THEN ',' ELSE '' END,
    coalesce(v_existing_actions, '')
  );
END $$;
