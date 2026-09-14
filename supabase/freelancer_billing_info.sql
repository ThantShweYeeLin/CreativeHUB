-- Payout/billing details so a freelancer can actually be paid — collected
-- once (onboarding) and editable afterwards (Freelancer Dashboard ->
-- Settings). Nullable/additive: existing freelancer_profiles rows are
-- unaffected until the freelancer fills this in.

alter table public.freelancer_profiles
  add column if not exists billing_bank_name text,
  add column if not exists billing_account_holder_name text,
  add column if not exists billing_account_number text;
