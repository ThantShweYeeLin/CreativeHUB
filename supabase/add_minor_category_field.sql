-- Adds an optional secondary ("minor") freelancer category, chosen
-- alongside the primary category during onboarding. The Skills and Styles
-- steps use it to widen their suggested-chip lists to cover both
-- categories, and it's persisted here (rather than only used transiently
-- during onboarding) so it's available for future display/matching use.
--
-- Run this once against your Supabase project's SQL editor.

alter table public.freelancer_profiles
  add column if not exists minor_category text;
