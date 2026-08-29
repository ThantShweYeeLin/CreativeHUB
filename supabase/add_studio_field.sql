-- Adds freelancer-managed studio details to public.freelancer_profiles so
-- clients can pick "my studio" as a booking location alongside the existing
-- freelancer-preferred locations list. Run this once against your Supabase
-- project's SQL editor.
--
-- SUPERSEDED: locations_to_structured_jsonb.sql upgrades studio_locations
-- (and locations) from text[] to structured jsonb. If you haven't run
-- either migration yet, just run locations_to_structured_jsonb.sql — it
-- creates these columns fresh if this one was never applied.

alter table public.freelancer_profiles
  add column if not exists studio_name text,
  add column if not exists studio_locations text[] default array[]::text[];
