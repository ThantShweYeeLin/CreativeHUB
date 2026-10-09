-- Tears down the Teams subsystem (supabase/teams.sql, now removed from the
-- repo - the app never shipped a way to actually create a team or invite
-- someone to one, and the live `teams` table has zero rows). Run this once
-- against your Supabase project's SQL editor if you want the now-unused
-- tables gone too; the app no longer references any of them, so it's safe
-- to leave this unrun indefinitely if you'd rather keep the tables around.
--
-- `team_bookings.booking_id` is `on delete set null` into `public.bookings`,
-- so dropping these tables cannot affect or delete any real booking.

drop table if exists public.team_booking_confirmations;
drop table if exists public.team_bookings;
drop table if exists public.team_invitations;
drop table if exists public.team_members;
drop table if exists public.teams;
