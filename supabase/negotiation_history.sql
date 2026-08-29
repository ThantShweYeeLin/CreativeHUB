-- Adds a real append-only negotiation history so the full back-and-forth of
-- a counter-offer thread can be shown (not just the latest offer), plus a
-- round counter used to cap negotiations at 3 total offers. Run this once
-- against your Supabase project's SQL editor.

alter table public.requests
  add column if not exists counter_round int default 1,
  add column if not exists includes text;

create table if not exists public.request_offers (
  id uuid default uuid_generate_v4() primary key,
  request_id uuid references public.requests on delete cascade not null,
  round int not null,
  offered_by text not null,      -- 'client' | 'freelancer'
  action text not null,          -- 'request' | 'counter' | 'accept' | 'reject'
  price numeric(10,2),
  message text,
  includes text,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_request_offers_request_id on public.request_offers(request_id, round);

alter table public.request_offers enable row level security;

DO $$ BEGIN
  CREATE POLICY "Participants view own request offers" ON public.request_offers FOR SELECT
    USING (auth.uid() in (select client_id from public.requests where id = request_id)
        OR auth.uid() in (select freelancer_id from public.requests where id = request_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants insert own request offers" ON public.request_offers FOR INSERT
    WITH CHECK (auth.uid() in (select client_id from public.requests where id = request_id)
             OR auth.uid() in (select freelancer_id from public.requests where id = request_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
