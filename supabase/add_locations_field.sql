-- Adds a freelancer-managed "locations" list to public.freelancer_profiles
-- (e.g. "Studio, Outdoor, Client's Location") for existing (already-deployed)
-- databases. Run this once against your Supabase project's SQL editor.

alter table public.freelancer_profiles
  add column if not exists locations text[] default array[]::text[];
