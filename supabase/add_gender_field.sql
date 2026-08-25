-- Adds a gender field to public.users for existing (already-deployed) databases.
-- Run this once against your Supabase project's SQL editor.

do $$ begin
  create type gender_type as enum ('male', 'female', 'lgbtq_plus', 'prefer_not_to_say');
exception when duplicate_object then null;
end $$;

alter table public.users
  add column if not exists gender gender_type default 'prefer_not_to_say';

update public.users set gender = 'prefer_not_to_say' where gender is null;
