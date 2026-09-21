-- Lets a receipt show "Visa •••• 4242". Stores ONLY the card brand and last four
-- digits (never a card number). Run after freelancer_premium.sql. Safe to re-run.
alter table public.subscription_payments
  add column if not exists card_brand text,
  add column if not exists card_last4 text;
