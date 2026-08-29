-- Lets a counter offer also propose a different date/time, not just price.
-- Mirrors the counter_price/counter_message pattern already on `requests`,
-- plus the same two columns on the request_offers history log. Run this
-- once against your Supabase project's SQL editor.

alter table public.requests
  add column if not exists counter_date date,
  add column if not exists counter_time time;

alter table public.request_offers
  add column if not exists date date,
  add column if not exists time time;
