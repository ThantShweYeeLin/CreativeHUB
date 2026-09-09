-- Structured start/end time for requests and bookings, plus a database-
-- enforced (not just app-checked) guarantee that one freelancer can never
-- hold two overlapping accepted/confirmed bookings. Safe to re-run in
-- full. Run this once against your Supabase project's SQL editor.
--
-- Terminology note: bookings.status = 'pending' already means "freelancer
-- accepted the request, deposit outstanding" (a bookings row is only ever
-- created at accept time — a not-yet-accepted request is just a `requests`
-- row, with no calendar footprint at all, which is exactly the "soft hold"
-- behavior wanted). This migration doesn't rename that status — too many
-- call sites already key off the literal string 'pending' — it just adds
-- what's missing around it: real end times, a distinct 'annulled' outcome
-- for a lapsed deposit deadline (vs. an intentional 'cancelled'), and the
-- overlap guarantee itself.

-- 1. Requests get real, queryable start/end time (previously only encoded
--    in a free-text [[SCHEDULE_META:...]] tag inside the message, parsed
--    back out at accept time) so a pending request's slot is queryable —
--    without this becoming an exclusive hold, since nothing below scopes
--    the overlap constraint to the requests table.
alter table public.requests
  add column if not exists start_date date,
  add column if not exists start_time time,
  add column if not exists end_time time;

-- 2. Bookings get real timestamptz instants (derived from the existing
--    start_date/start_time/end_time, interpreted as Asia/Bangkok
--    wall-clock — the same interpretation supabase/booking_checkin.sql
--    already uses) so a range-overlap check is possible at all, plus a
--    persisted deposit amount (today only ever computed client-side as
--    30% of budget — see src/app/pages/bookingTracking/useBookingTracking.ts).
alter table public.bookings
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists deposit_amount numeric(10,2);

-- Backfill start_at first.
update public.bookings
set start_at = (start_date + start_time) at time zone 'Asia/Bangkok'
where start_date is not null and start_time is not null and start_at is null;

-- Then end_at, computed from start_at (a timestamptz) rather than wrapping
-- start_time (a bare time-of-day) past midnight — a 23:00 start with no
-- end_time must default to 01:00 the *next* day, not 01:00 earlier the
-- *same* day, which is what start_time + interval would silently produce.
update public.bookings
set end_at = case
  when end_time is not null then (start_date + end_time) at time zone 'Asia/Bangkok'
  else start_at + interval '120 minutes'
end
where start_at is not null and end_at is null;

-- Defensive correction, covering both any pre-existing malformed data and
-- (idempotently) an earlier buggy run of this same migration: any row
-- that still ended up with end_at <= start_at gets the same safe
-- 120-minute default instead, so the exclusion constraint below can never
-- choke building its index against real data.
update public.bookings
set end_at = start_at + interval '120 minutes'
where start_at is not null and end_at is not null and end_at <= start_at;

-- 3. The actual race-safety mechanism: the database itself refuses a
--    conflicting insert/update, atomically, for every overlap shape (same
--    start, same end, contained, spanning) — range overlap (&&) already
--    means exactly that, no custom interval-math needed. Scoped to
--    'pending'/'confirmed' only, so overlapping *requests* (no bookings
--    row yet, see the terminology note above) are never touched — a
--    freelancer can have any number of overlapping pending requests, only
--    an actual accept can no longer collide with another accepted/paid
--    booking. A reschedule (an UPDATE changing start_at/end_at) is
--    automatically re-checked against every *other* row by this same
--    constraint — no manual "release old slot, then reserve new one" step
--    needed.
--
--    Also requires start_at/end_at to actually be set: tstzrange(NULL,
--    NULL) evaluates to a fully *unbounded* range ((,)), not a NULL range
--    — unlike a plain NULL column, it wouldn't be skipped by the
--    constraint on its own, and would conflict with literally everything
--    for that freelancer. A handful of existing bookings have no recorded
--    date/time at all; excluding them here just means they're not
--    overlap-checked (same as today, where isTimeSlotTaken already skips
--    any booking without a start_time), not that they're ignored anywhere
--    else.
create extension if not exists btree_gist;

DO $$ BEGIN
  alter table public.bookings
    add constraint bookings_no_overlap
    exclude using gist (
      freelancer_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    ) where (status in ('pending', 'confirmed') and start_at is not null and end_at is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. A distinct 'annulled' status — a lapsed 24h deposit deadline is a
--    system-driven invalidation, not an intentional cancellation, and the
--    two are worth telling apart in analytics/audit history. Must be its
--    own statement, and reconcile_booking_escrow() (updated in
--    supabase/booking_annulled_reconcile.sql to actually use it) must be
--    run as a separate follow-up statement/transaction — Postgres won't
--    let a brand-new enum value be referenced in the same transaction
--    that added it.
alter type booking_status add value if not exists 'annulled';
