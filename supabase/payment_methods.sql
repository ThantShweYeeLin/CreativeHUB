-- Saved payment methods (simulated — CreativeHUB never processes real
-- payments, so only the card's display info is ever stored: brand, last 4
-- digits, expiry, and cardholder name. The full card number and CVC never
-- reach the database).
create table if not exists public.payment_methods (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  brand text not null,
  last4 text not null,
  exp_month int not null,
  exp_year int not null,
  cardholder_name text not null,
  is_default boolean not null default false,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_payment_methods_user_id on public.payment_methods(user_id);

alter table public.payment_methods enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users manage their own payment methods" ON public.payment_methods FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Records which saved card a deposit was paid with, e.g. "Visa •••• 4242" —
-- shown on the booking's payment summary after the fact.
alter table public.bookings
  add column if not exists deposit_paid_via text;
