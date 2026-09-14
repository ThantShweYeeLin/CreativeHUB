-- One-time data fix: existing Musician/Live Entertainment profiles still
-- have their real performer-format values (Solo Artist, Band, DJ, ...)
-- sitting in `styles`, left over from before add_performer_type_field.sql
-- and src/lib/categories.ts moved that concept to its own field. This
-- migration doesn't touch existing rows on its own — this moves each
-- profile's current styles values into performer_type (where they
-- actually belong) and clears styles, since we have no real genre data to
-- put there instead and shouldn't fabricate one.
--
-- Only affects rows whose styles values are recognized performer-format
-- values (an exact match against the fixed list from categories.ts) — a
-- profile that already has real genre words in styles is left untouched.
--
-- Run this once against your Supabase project's SQL editor, after
-- add_performer_type_field.sql.

update public.freelancer_profiles
set
  performer_type = styles,
  styles = array[]::text[]
where title = 'Musician/Live Entertainment'
  and styles <@ array['Solo Artist', 'Band', 'Singer/Vocalist', 'Acoustic Duo', 'Instrumentalist', 'DJ']::text[]
  and (performer_type is null or performer_type = array[]::text[]);
