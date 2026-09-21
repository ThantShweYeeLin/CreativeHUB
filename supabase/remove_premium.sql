-- Removes the Premium subscription feature from the database entirely.
-- Run this AFTER the app version that no longer reads is_premium /
-- premium_since / premium_purchases is deployed (nothing in the code
-- references them any more), otherwise a still-running old build would
-- error on the missing column.
--
-- IRREVERSIBLE: drops the premium_purchases ledger (the live database has
-- 1 purchase, 99 THB) and the two users columns (1 premium user). Export
-- them first if you need a record of that revenue.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

drop table if exists public.premium_purchases;

alter table public.users
  drop column if exists is_premium,
  drop column if exists premium_since;
