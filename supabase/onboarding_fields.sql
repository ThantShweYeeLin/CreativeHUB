-- Adds the fields collected by the restructured client and freelancer
-- onboarding flows. Run this once against your Supabase project's SQL editor.
-- All columns are nullable/defaulted and additive — safe to run on an
-- already-populated database.

-- Client-specific fields, stored directly on public.users (no separate
-- client_profiles table — there are only a handful of these fields).
-- onboarding_completed is shared by both roles: it gates access to the rest
-- of the app until the role-specific onboarding flow has been finished once.
alter table public.users
  add column if not exists client_type text[] default array[]::text[],
  add column if not exists client_interests text[] default array[]::text[],
  add column if not exists client_budget_preference text,
  add column if not exists client_preferences text[] default array[]::text[],
  add column if not exists onboarding_completed boolean default false;

-- Freelancer-specific fields, stored on public.freelancer_profiles alongside
-- the existing title/description/hourly_rate/skills/styles/experience_years.
alter table public.freelancer_profiles
  add column if not exists experience_level text,
  add column if not exists pricing_type text,
  add column if not exists min_price numeric(10,2),
  add column if not exists max_price numeric(10,2),
  add column if not exists service_area_type text,
  add column if not exists service_radius_km int,
  add column if not exists working_days text[] default array[]::text[],
  add column if not exists working_hours_start time,
  add column if not exists working_hours_end time,
  add column if not exists requirements text,
  add column if not exists limitation_days text[] default array[]::text[],
  add column if not exists limitation_note text,
  add column if not exists contact_preference text[] default array['creativehub_messages']::text[],
  add column if not exists phone_verified boolean default false,
  add column if not exists identity_status text default 'not_submitted';
