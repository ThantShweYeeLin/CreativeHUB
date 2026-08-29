-- Adds a phone number field to public.users, collected at signup. Not
-- shown on any public profile view — private, same as email. Run this once
-- against your Supabase project's SQL editor.

alter table public.users
  add column if not exists phone text;
