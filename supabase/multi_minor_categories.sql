-- Freelancer onboarding's "Also skilled in" used to allow only a single
-- extra category (freelancer_profiles.minor_category, added in
-- add_minor_category_field.sql), with no per-category experience level.
-- This lets a freelancer pick several additional specialties, each with
-- its own optional experience level. Run this once against your Supabase
-- project's SQL editor.
--
-- The old minor_category column is left in place (unused going forward,
-- but not dropped) so nothing that still reads it breaks.

alter table public.freelancer_profiles
  add column if not exists minor_categories text[] not null default '{}'::text[],
  add column if not exists minor_category_experience_levels jsonb not null default '{}'::jsonb;

-- One-time backfill: carry any existing single minor_category value over
-- into the new array column, for accounts onboarded before this change.
update public.freelancer_profiles
set minor_categories = array[minor_category]
where minor_category is not null
  and (minor_categories is null or minor_categories = '{}'::text[]);
