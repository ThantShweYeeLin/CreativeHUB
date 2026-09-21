-- Freelancer Premium hardening. Run AFTER supabase/freelancer_premium.sql.
--   A. Atomic acceptance of an open-Group-Request application
--      (role-slot limit, duplicate acceptance, booking created in the same
--      transaction) - accept_group_application().
--   B. Race-safe, idempotent subscription activation (webhook + checkout can
--      now confirm the same charge at the same moment).
--   C. payment_events: a reconciliation log the Omise webhook writes to.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

-- ============================================================
-- A. Atomic acceptance
-- ============================================================

alter table public.group_opportunity_applications
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;
create unique index if not exists uq_group_application_booking
  on public.group_opportunity_applications(booking_id) where booking_id is not null;

-- The single trusted way an open-request application becomes a booking. It
-- runs as ONE transaction, so any failure (slot full, freelancer double-booked,
-- overlap constraint, ...) leaves no half-accepted request, no booking and no
-- consumed slot. The role row is locked first, which serializes every
-- acceptance for that role: two people accepting the final slot at the same
-- moment are processed one after the other and the second sees it filled.
--
-- Mirrors what src/lib/acceptRequest.ts writes for a normal request (price,
-- schedule, 30% deposit, 24h deposit deadline, locked agreement) so the
-- booking is indistinguishable downstream. Either party may accept - the one
-- who did NOT make the current offer - and no Premium check applies: an
-- expired subscription never blocks an accepted commitment.
create or replace function public.accept_group_application(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_app public.group_opportunity_applications;
  v_role public.group_opportunity_roles;
  v_req public.requests;
  v_opp public.group_opportunities;
  v_price numeric;
  v_filled integer;
  v_date date;
  v_start time;
  v_end time;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_deposit numeric;
  v_booking_id uuid;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.group_opportunity_applications where request_id = p_request_id;
  if not found then raise exception 'NOT_AN_APPLICATION'; end if;

  -- Lock order is always role -> request, so concurrent accepts can't deadlock.
  select * into v_role from public.group_opportunity_roles where id = v_app.role_id for update;
  select * into v_req from public.requests where id = p_request_id for update;

  if v_me not in (v_req.client_id, v_req.freelancer_id) then raise exception 'Not authorized'; end if;
  if v_req.status = 'accepted' or v_app.booking_id is not null then raise exception 'ALREADY_ACCEPTED'; end if;
  if v_req.status <> 'countered' then raise exception 'REQUEST_NOT_OPEN'; end if;
  if (v_req.counter_by = 'freelancer' and v_me <> v_req.client_id)
     or (v_req.counter_by = 'client' and v_me <> v_req.freelancer_id) then
    raise exception 'Only the other party can accept this offer';
  end if;

  select * into v_opp from public.group_opportunities where id = v_app.opportunity_id;
  if v_opp.status <> 'open' or v_opp.event_date < current_date then raise exception 'OPPORTUNITY_CLOSED'; end if;

  select count(*) into v_filled
    from public.group_opportunity_applications a
    join public.requests q on q.id = a.request_id
    where a.role_id = v_role.id and q.status = 'accepted';
  if v_filled >= v_role.slots then raise exception 'ROLE_FILLED'; end if;

  v_price := coalesce(v_req.counter_price, v_req.budget);
  v_date := coalesce(v_req.counter_date, v_req.start_date);
  v_start := coalesce(v_req.counter_time, v_req.start_time);
  v_end := coalesce(v_req.counter_end_time, v_req.end_time, case when v_start is not null then v_start + interval '2 hours' end);
  if v_date is not null and v_start is not null then
    v_start_at := (v_date + v_start) at time zone 'Asia/Bangkok';
    v_end_at := (v_date + v_end) at time zone 'Asia/Bangkok';
  end if;
  v_deposit := round(v_price * 0.3);

  begin
    insert into public.bookings (
      client_id, freelancer_id, project_name, description, budget,
      status, payment_status, deliverables,
      start_date, start_time, end_time, start_at, end_at,
      deposit_amount, deposit_deadline, confirmed_agreement
    ) values (
      v_req.client_id, v_req.freelancer_id, v_req.project_name,
      coalesce(v_req.description, v_req.message, 'Auto-created from accepted request.'), v_price,
      'pending', 'unpaid', 'Auto-created from request ' || v_req.id,
      v_date, v_start, v_end, v_start_at, v_end_at,
      v_deposit, now() + interval '24 hours',
      jsonb_build_object(
        'service', v_req.project_name,
        'description', coalesce(v_req.description, v_req.message),
        'deliverables', v_req.includes,
        'price', v_price,
        'deposit_amount', v_deposit,
        'scheduled_start_at', v_start_at,
        'scheduled_end_at', v_end_at,
        'locked_at', now()
      )
    ) returning id into v_booking_id;
  exception when exclusion_violation then
    -- bookings_no_overlap: the freelancer already has a pending/confirmed
    -- booking in that window. Nothing above has been committed.
    raise exception 'BOOKING_SLOT_TAKEN';
  end;

  -- Marks this transaction as the trusted path for the guard trigger below.
  perform set_config('creativehub.accepting_application', 'on', true);
  update public.requests set status = 'accepted', budget = v_price where id = v_req.id;
  update public.group_opportunity_applications set booking_id = v_booking_id where id = v_app.id;

  return jsonb_build_object('booking_id', v_booking_id, 'price', v_price, 'request_id', v_req.id);
end;
$$;
revoke all on function public.accept_group_application(uuid) from public, anon;
grant execute on function public.accept_group_application(uuid) to authenticated;

-- An application's request can only turn 'accepted' through the function
-- above. Without this, a client could still flip requests.status directly
-- (the normal "participants can update requests" policy) and exceed the slot
-- limit, or accept without a booking.
create or replace function public.guard_group_application_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and exists (select 1 from public.group_opportunity_applications a where a.request_id = new.id)
     and coalesce(current_setting('creativehub.accepting_application', true), '') <> 'on' then
    raise exception 'Applications to open Group Requests must be accepted through accept_group_application';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_group_application_acceptance() from public, anon, authenticated;

DO $$ BEGIN
  CREATE TRIGGER requests_guard_group_application_acceptance
    BEFORE UPDATE OF status ON public.requests
    FOR EACH ROW EXECUTE FUNCTION public.guard_group_application_acceptance();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- B. Race-safe activation (redefines the function from freelancer_premium.sql)
--
-- The checkout response and the Omise webhook can confirm the same charge at
-- the same instant. Advisory locks make the second caller wait, then see the
-- charge already recorded and return without granting another period. The
-- per-user lock keeps two DIFFERENT charges for one user from computing the
-- same period start.
-- ============================================================
create or replace function public.activate_freelancer_subscription(
  p_user uuid, p_plan text, p_charge_id text, p_amount_satang integer
)
returns public.freelancer_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.freelancer_subscriptions;
  v_start timestamptz;
  v_end timestamptz;
  v_result public.freelancer_subscriptions;
begin
  if p_plan not in ('monthly', 'annual') then
    raise exception 'Invalid plan';
  end if;

  perform pg_advisory_xact_lock(hashtext('premium-charge:' || p_charge_id));
  perform pg_advisory_xact_lock(hashtext('premium-user:' || p_user::text));

  if exists (select 1 from public.subscription_payments where omise_charge_id = p_charge_id) then
    select * into v_result from public.freelancer_subscriptions where user_id = p_user;
    return v_result;
  end if;

  select * into v_existing from public.freelancer_subscriptions where user_id = p_user for update;
  v_start := greatest(now(), coalesce(v_existing.current_period_end, now()));
  v_end := case p_plan when 'annual' then v_start + interval '1 year' else v_start + interval '1 month' end;

  insert into public.subscription_payments (user_id, plan, amount_satang, omise_charge_id, period_start, period_end)
    values (p_user, p_plan, p_amount_satang, p_charge_id, v_start, v_end);

  insert into public.freelancer_subscriptions (user_id, plan, status, current_period_end)
    values (p_user, p_plan, 'active', v_end)
  on conflict (user_id) do update
    set plan = excluded.plan,
        status = 'active',
        cancelled_at = null,
        current_period_end = excluded.current_period_end,
        updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.activate_freelancer_subscription(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.activate_freelancer_subscription(uuid, text, text, integer) to service_role;

-- ============================================================
-- C. Reconciliation log for the Omise webhook
-- ============================================================
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  omise_event_id text,
  event_key text,
  omise_charge_id text,
  user_id uuid,
  -- activated | already_active | ignored | rejected | error
  outcome text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_events_charge on public.payment_events(omise_charge_id);
create index if not exists idx_payment_events_outcome on public.payment_events(outcome, created_at desc);

alter table public.payment_events enable row level security;
-- No policy and no client privileges at all: written and read only with the
-- service role (the server, or an admin in the Supabase dashboard).
revoke all on public.payment_events from anon, authenticated;
