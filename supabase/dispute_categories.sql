-- Widens booking_events.category from 3 values to 4, splitting
-- 'not_as_agreed' into 'not_performed' and 'differed_from_agreement' so a
-- client can report a no-show before the freelancer ever marks the booking
-- complete. Old rows using 'not_as_agreed' stay valid; new disputes only
-- ever write the 4 new values. Safe to run multiple times.

alter table public.booking_events drop constraint if exists booking_events_category_check;

alter table public.booking_events add constraint booking_events_category_check
  check (category in ('no_show','not_performed','differed_from_agreement','not_as_agreed','other'));
