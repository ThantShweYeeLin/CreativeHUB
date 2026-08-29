-- Adds counter-offer negotiation, calendar/blocked-date availability, and a
-- real per-service pricing model for the freelancer dashboard. Run this once
-- against your Supabase project's SQL editor.
--
-- Note: "alter type ... add value" cannot run inside the same transaction as
-- other statements that use the new value, but it can run standalone. If
-- your SQL editor wraps the whole script in one transaction, run the first
-- statement by itself first, then the rest.

alter type request_status add value if not exists 'countered';

alter table public.requests
  add column if not exists counter_price numeric(10,2),
  add column if not exists counter_message text,
  add column if not exists counter_by text; -- 'freelancer' | 'client'

alter table public.bookings
  add column if not exists start_time time,
  add column if not exists end_time time;

create table if not exists public.freelancer_blocked_dates (
  id uuid default uuid_generate_v4() primary key,
  freelancer_id uuid references public.freelancer_profiles on delete cascade not null,
  blocked_date date not null,
  reason text,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (freelancer_id, blocked_date)
);

create index if not exists idx_freelancer_blocked_dates_freelancer_id on public.freelancer_blocked_dates(freelancer_id);

alter table public.freelancer_blocked_dates enable row level security;

create policy "Blocked dates are viewable by everyone" on public.freelancer_blocked_dates
  for select using (true);

create policy "Freelancers manage own blocked dates" on public.freelancer_blocked_dates
  for all using (auth.uid() in (select user_id from public.freelancer_profiles where id = freelancer_id));

create table if not exists public.freelancer_services (
  id uuid default uuid_generate_v4() primary key,
  freelancer_id uuid references public.freelancer_profiles on delete cascade not null,
  name text not null,
  description text,
  starting_price numeric(10,2),
  pricing_type text default 'starting_from', -- 'fixed' | 'starting_from' | 'custom_quote'
  duration text,
  included text,
  extras jsonb default '[]'::jsonb, -- [{ "label": string, "price": number }]
  requirements text,
  position int default 0,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_freelancer_services_freelancer_id on public.freelancer_services(freelancer_id);

alter table public.freelancer_services enable row level security;

create policy "Services are viewable by everyone" on public.freelancer_services
  for select using (true);

create policy "Freelancers manage own services" on public.freelancer_services
  for all using (auth.uid() in (select user_id from public.freelancer_profiles where id = freelancer_id));
