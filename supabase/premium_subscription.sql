-- Premium subscription flag. Simulated, like the rest of this app's
-- payment flows (see FreelancerDashboard's "Simulated earnings" note) --
-- upgrading just flips this flag, no real payment processor involved. Run
-- this once against your Supabase project's SQL editor.

alter table public.users
  add column if not exists is_premium boolean not null default false,
  add column if not exists premium_since timestamptz;
