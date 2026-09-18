-- Premium subscription flag. Simulated, like the rest of this app's
-- payment flows (see FreelancerDashboard's "Simulated earnings" note) --
-- upgrading just flips this flag, no real payment processor involved. Run
-- this once against your Supabase project's SQL editor.

alter table public.users
  add column if not exists is_premium boolean not null default false,
  add column if not exists premium_since timestamptz;

-- One row per upgrade/renewal — a proper ledger (not just the users.* flag
-- above) so admin can see every premium fee collected and when, the same
-- way booking commissions are shown on the admin Earnings page (see
-- bookingEscrow.ts's getBookingEarningsBreakdown for that side).
create table if not exists public.premium_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  amount numeric not null,
  currency text not null default 'THB',
  card_label text,
  created_at timestamptz not null default now()
);

create index if not exists premium_purchases_user_id_idx on public.premium_purchases(user_id);
create index if not exists premium_purchases_created_at_idx on public.premium_purchases(created_at desc);

alter table public.premium_purchases enable row level security;

drop policy if exists "Users can view their own premium purchases" on public.premium_purchases;
create policy "Users can view their own premium purchases"
  on public.premium_purchases for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own premium purchases" on public.premium_purchases;
create policy "Users can insert their own premium purchases"
  on public.premium_purchases for insert
  with check (auth.uid() = user_id);

-- Reuses the is_admin() helper from admin_system_2_rest.sql (security
-- definer, so it doesn't recurse back into this table's own RLS) — run that
-- migration first if this policy fails to create.
drop policy if exists "Admins can view all premium purchases" on public.premium_purchases;
create policy "Admins can view all premium purchases"
  on public.premium_purchases for select
  using (public.is_admin(auth.uid()));
