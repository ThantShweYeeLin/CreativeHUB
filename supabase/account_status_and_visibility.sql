-- Adds a freelancer-only profile visibility setting (public/limited) and a
-- role-agnostic account pause/deactivate flag. Run this once against your
-- Supabase project's SQL editor.

alter table public.users
  add column if not exists account_status text default 'active'
    check (account_status in ('active','paused'));

alter table public.freelancer_profiles
  add column if not exists visibility text default 'public'
    check (visibility in ('public','limited'));
