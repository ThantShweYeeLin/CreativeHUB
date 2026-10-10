-- Adds real, persisted backing for three Settings page controls that
-- previously only ever wrote to the browser's own localStorage and had no
-- effect anywhere else: the phone number field, and the "hide email from
-- public" / "hide phone from public" privacy checkboxes. Without this, no
-- phone number exists anywhere in the app for anyone, and the privacy
-- toggles had nothing real to govern (FreelancerProfile.tsx shows
-- users.email to any signed-in viewer today with no gating at all).
--
-- Run this once against your Supabase project's SQL editor.

alter table public.users add column if not exists phone text;
alter table public.users add column if not exists hide_email_from_public boolean not null default false;
alter table public.users add column if not exists hide_phone_from_public boolean not null default false;
