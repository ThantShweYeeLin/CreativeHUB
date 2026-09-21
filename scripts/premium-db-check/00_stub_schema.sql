-- Minimal stand-in for the parts of the live Supabase schema that
-- supabase/freelancer_premium.sql depends on (column names/types taken from
-- the live PostgREST schema), plus Supabase's roles and auth.uid(). This
-- tests the migration's logic and privileges on plain Postgres - it is not
-- a copy of the whole app schema.
create extension if not exists pgcrypto;
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create type public.booking_status as enum ('pending','confirmed','in_progress','completed','cancelled','annulled');
create type public.request_status as enum ('pending','accepted','rejected','completed','countered','cancelled');

create table public.users (
  id uuid primary key, full_name text, role text, account_status text default 'active',
  avatar_url text, gender text, rating numeric, total_reviews int, preferred_currency text
);
create table public.freelancer_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references public.users(id) on delete cascade,
  title text, is_available boolean default true, visibility text default 'public',
  locations jsonb default '[]', studio_locations jsonb default '[]', styles text[] default '{}',
  experience_years int, hourly_rate numeric
);
create table public.freelancer_blocked_dates (
  id uuid primary key default gen_random_uuid(), freelancer_id uuid references public.freelancer_profiles(id) on delete cascade, blocked_date date
);
create extension if not exists btree_gist;
create table public.bookings (
  id uuid primary key default gen_random_uuid(), client_id uuid, freelancer_id uuid, start_date date,
  status public.booking_status default 'pending',
  project_name text, description text, budget numeric, payment_status text, deliverables text,
  start_time time, end_time time, start_at timestamptz, end_at timestamptz,
  deposit_amount numeric, deposit_deadline timestamptz, confirmed_agreement jsonb, group_id text,
  -- same guard as supabase/booking_overlap_protection.sql
  constraint bookings_no_overlap exclude using gist (freelancer_id with =, tstzrange(start_at, end_at, '[)') with &&)
    where (status in ('pending', 'confirmed') and start_at is not null and end_at is not null)
);
create table public.requests (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.users(id), freelancer_id uuid references public.users(id),
  project_name text, description text, message text, budget numeric, status public.request_status default 'pending',
  counter_price numeric, counter_message text, counter_by text, counter_round int,
  counter_date date, counter_time time, counter_end_time time,
  start_date date, start_time time, end_time time,
  includes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.request_offers (
  id uuid primary key default gen_random_uuid(), request_id uuid references public.requests(id) on delete cascade,
  round int, offered_by text, action text, price numeric, message text, includes text, date date, time time, end_time time,
  created_at timestamptz default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.users(id) on delete cascade,
  type text, title text, message text, related_id uuid, read boolean default false,
  created_at timestamptz default now(), actor_id uuid, metadata jsonb, post_id uuid, comment_id uuid
);
create table public.blocked_users (blocker_id uuid, blocked_id uuid);

create function public.is_admin(uid uuid) returns boolean language sql stable security definer as
  $$ select exists (select 1 from public.users where id = uid and role = 'admin') $$;
create function public.is_blocked(a uuid, b uuid) returns boolean language sql stable security definer as
  $$ select exists (select 1 from public.blocked_users where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)) $$;
grant execute on function public.is_admin(uuid), public.is_blocked(uuid,uuid) to authenticated, service_role;

-- Supabase's default privileges: authenticated/anon can reach public tables (RLS decides rows)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
