-- Adds working-hours fields to public.freelancer_profiles for existing (already-deployed) databases.
-- Run this once against your Supabase project's SQL editor.

alter table public.freelancer_profiles
  add column if not exists working_hours_start text default '09:00',
  add column if not exists working_hours_end text default '18:00';

update public.freelancer_profiles
  set working_hours_start = '09:00'
  where working_hours_start is null;

update public.freelancer_profiles
  set working_hours_end = '18:00'
  where working_hours_end is null;
