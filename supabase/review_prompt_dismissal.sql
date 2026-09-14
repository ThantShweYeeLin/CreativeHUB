-- The global "rate this freelancer/client" prompt (shown once, site-wide,
-- after a booking finishes) needs to remember a dismissal ("Cancel") the
-- same way it remembers a submitted review — otherwise cancelling would
-- just mean it asks again on the next page. A submitted review is already
-- its own permanent record (see reviews.booking_id/reviewer_id), so these
-- columns only need to cover the "asked and declined" case.

alter table public.bookings
  add column if not exists client_review_prompt_dismissed_at timestamptz,
  add column if not exists freelancer_review_prompt_dismissed_at timestamptz;
