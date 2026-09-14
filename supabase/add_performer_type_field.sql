-- Adds a dedicated performer-format field for Musician/Live Entertainment
-- providers (Solo Artist, Band, DJ, ...), separate from `styles`.
--
-- Previously, performer format was stored in freelancer_profiles.styles
-- itself, which meant a Musician's "styles" could never overlap with an
-- event's chosen style/theme (see lib/eventMatcher.ts's
-- scoreEventCandidate) — a performer format like "DJ" or "Band" can never
-- match a style word like "Romantic" or "Rustic". `styles` now holds
-- music genres instead (see src/lib/categories.ts), and performer format
-- moves here, matching the same array-column convention already used for
-- freelancer_profiles.skills/styles.
--
-- Run this once against your Supabase project's SQL editor.

alter table public.freelancer_profiles
  add column if not exists performer_type text[] default array[]::text[];
