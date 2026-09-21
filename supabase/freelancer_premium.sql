-- CreativeHUB Freelancer Premium (฿99/month, ฿999/year).
--
-- What Premium unlocks, enforced HERE (in Postgres) rather than in the UI:
--   1. Appearing in Event Matcher results  -> get_event_matcher_candidates()
--   2. Being notified about relevant open Group Requests / Event plans
--                                           -> create_group_opportunity()
--   3. Discovering + applying to open Group Requests
--                                           -> get_group_opportunities(),
--                                              apply_to_group_opportunity()
-- Everything else (profile, portfolio, Explore visibility, ordinary direct
-- booking requests) is untouched and stays free.
--
-- Premium is never a quality signal: no function below returns subscription
-- status about another user, and get_event_matcher_candidates() returns the
-- same shape it always did.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

-- ============================================================
-- 1. Subscriptions (written ONLY by the server after Omise confirms a paid
--    charge; clients can read their own row, nothing else)
-- ============================================================

create table if not exists public.freelancer_subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  -- 'cancelled' = the user turned renewal off; access still runs to
  -- current_period_end. Expiry is never a status flip - it's simply
  -- current_period_end <= now(), so nothing needs a cron job to lapse.
  status text not null default 'active' check (status in ('active', 'cancelled')),
  current_period_end timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  plan text not null check (plan in ('monthly', 'annual')),
  amount_satang integer not null check (amount_satang > 0),
  currency text not null default 'thb',
  -- Unique: the same Omise charge can never grant a period twice, however
  -- many times the confirm endpoint is called.
  omise_charge_id text not null unique,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.freelancer_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users read their own subscription" ON public.freelancer_subscriptions FOR SELECT
    TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users read their own subscription payments" ON public.subscription_payments FOR SELECT
    TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No INSERT/UPDATE/DELETE policy on either table, and no table privileges
-- for clients: a signed-in user cannot grant themselves Premium through the
-- API no matter what they send.
revoke insert, update, delete on public.freelancer_subscriptions from anon, authenticated;
revoke insert, update, delete on public.subscription_payments from anon, authenticated;

-- Internal entitlement check. Not executable by clients: callable only from
-- the security-definer functions below (which run as the function owner), so
-- nobody can probe whether ANOTHER user is Premium.
create or replace function public.internal_has_active_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.freelancer_subscriptions s
    where s.user_id = p_user and s.current_period_end > now()
  );
$$;
revoke all on function public.internal_has_active_premium(uuid) from public, anon, authenticated;

-- Called by the server (service role) after it has verified with Omise that a
-- charge is paid. Idempotent on the charge id, and extends (rather than
-- overwrites) a period that's still running so a renewal never loses time.
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

  -- Same charge confirmed twice -> return the current state, grant nothing.
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

-- Turns renewal off. Access is untouched until current_period_end.
create or replace function public.cancel_my_subscription()
returns public.freelancer_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.freelancer_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.freelancer_subscriptions
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where user_id = auth.uid() and current_period_end > now()
    returning * into v_result;
  if not found then
    raise exception 'No active subscription to cancel';
  end if;
  return v_result;
end;
$$;
revoke all on function public.cancel_my_subscription() from public, anon;
grant execute on function public.cancel_my_subscription() to authenticated;

-- ============================================================
-- 2. Notification preferences (server-side, so server-created notifications
--    can actually respect them; the older Settings toggles only live in
--    localStorage and nothing server-side can read those)
-- ============================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  opportunity_alerts boolean not null default true,
  application_updates boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users manage their own notification preferences" ON public.notification_preferences FOR ALL
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3. Open Group Request opportunities + applications
--
-- The existing Group Request is a client picking specific freelancers.
-- This adds an OPEN variant: a client describes the roles they need, and
-- eligible Premium freelancers can discover it and apply. An application is
-- a normal `requests` row (a freelancer counter-offer), so the client
-- reviews / counters / accepts it in the existing Requests page and it
-- becomes a booking through the existing acceptRequestAndCreateBooking flow.
-- ============================================================

create table if not exists public.group_opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 2000),
  event_date date not null,
  start_time time,
  end_time time,
  -- Only the coarse area is ever shown to freelancers before a booking exists.
  location_city text,
  location_text text,
  location_lat double precision,
  location_lng double precision,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_opportunity_roles (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.group_opportunities(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 60),
  budget numeric not null check (budget > 0),
  currency text not null default 'THB',
  styles text[] not null default '{}',
  slots integer not null default 1 check (slots between 1 and 20),
  note text check (char_length(note) <= 500)
);

create table if not exists public.group_opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.group_opportunities(id) on delete cascade,
  role_id uuid not null references public.group_opportunity_roles(id) on delete cascade,
  freelancer_id uuid not null references public.users(id) on delete cascade,
  request_id uuid unique references public.requests(id) on delete set null,
  proposed_price numeric not null check (proposed_price > 0),
  message text check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  -- The duplicate-application guard: one application per freelancer per
  -- opportunity, enforced by the database (a race can't get around it).
  unique (opportunity_id, freelancer_id)
);

create index if not exists idx_group_opp_status_date on public.group_opportunities(status, event_date);
create index if not exists idx_group_opp_roles_opp on public.group_opportunity_roles(opportunity_id);
create index if not exists idx_group_opp_apps_freelancer on public.group_opportunity_applications(freelancer_id);

alter table public.group_opportunities enable row level security;
alter table public.group_opportunity_roles enable row level security;
alter table public.group_opportunity_applications enable row level security;

-- Direct table reads are limited to the owner (and admins). Freelancers read
-- opportunities only through the sanitizing, entitlement-checking RPCs below,
-- so the raw client_id / exact address / other applicants never leave the DB.
DO $$ BEGIN
  CREATE POLICY "Owners read their opportunities" ON public.group_opportunities FOR SELECT
    TO authenticated USING (client_id = auth.uid() OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners read their opportunity roles" ON public.group_opportunity_roles FOR SELECT
    TO authenticated USING (
      EXISTS (SELECT 1 FROM public.group_opportunities o WHERE o.id = opportunity_id AND (o.client_id = auth.uid() OR public.is_admin(auth.uid())))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Applicant or owner reads an application" ON public.group_opportunity_applications FOR SELECT
    TO authenticated USING (
      freelancer_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.group_opportunities o WHERE o.id = opportunity_id AND o.client_id = auth.uid())
      OR public.is_admin(auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

revoke insert, update, delete on public.group_opportunities from anon, authenticated;
revoke insert, update, delete on public.group_opportunity_roles from anon, authenticated;
revoke insert, update, delete on public.group_opportunity_applications from anon, authenticated;

-- Anonymous callers get no table access at all to any of the new tables.
revoke all on public.freelancer_subscriptions, public.subscription_payments, public.notification_preferences,
  public.group_opportunities, public.group_opportunity_roles, public.group_opportunity_applications from anon;

-- Same coverage rule as src/lib/eventMatcher.ts's locationCovers(): a flat
-- 60km radius around any listed location (or studio), falling back to a loose
-- city/district text match for rows with no coordinates. Never assumes a
-- provider travels somewhere they haven't listed.
create or replace function public.provider_covers_location(
  p_locations jsonb, p_lat double precision, p_lng double precision, p_event_text text
)
returns boolean
language plpgsql
immutable
as $$
declare
  pt jsonb;
  pt_lat double precision;
  pt_lng double precision;
  dist double precision;
  txt text := lower(coalesce(p_event_text, ''));
  v_city text;
  v_district text;
begin
  if p_locations is null or jsonb_typeof(p_locations) <> 'array' then
    return false;
  end if;
  for pt in select * from jsonb_array_elements(p_locations) loop
    pt_lat := nullif(pt->>'latitude', '')::double precision;
    pt_lng := nullif(pt->>'longitude', '')::double precision;
    if pt_lat is not null and pt_lng is not null and p_lat is not null and p_lng is not null then
      dist := 2 * 6371 * asin(sqrt(
        power(sin(radians(p_lat - pt_lat) / 2), 2)
        + cos(radians(pt_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - pt_lng) / 2), 2)
      ));
      if dist <= 60 then return true; end if;
    elsif txt <> '' then
      v_city := lower(coalesce(pt->>'city', ''));
      v_district := lower(coalesce(pt->>'district', ''));
      if (v_city <> '' and position(v_city in txt) > 0) or (v_district <> '' and position(v_district in txt) > 0) then
        return true;
      end if;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.provider_covers_location(jsonb, double precision, double precision, text) from public, anon;
grant execute on function public.provider_covers_location(jsonb, double precision, double precision, text) to authenticated;

-- Free on that date? Same rule as availability.ts's isFreelancerFreeOnDate():
-- no blocked date, and no booking that day that isn't cancelled/rejected/annulled.
create or replace function public.internal_is_free_on_date(p_profile_id uuid, p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.freelancer_blocked_dates d where d.freelancer_id = p_profile_id and d.blocked_date = p_date)
     and not exists (
       select 1 from public.bookings b
       where b.freelancer_id = p_user and b.start_date = p_date and b.status not in ('cancelled', 'annulled')
     );
$$;
revoke all on function public.internal_is_free_on_date(uuid, uuid, date) from public, anon, authenticated;

-- Everything that makes a freelancer eligible for ONE role of ONE opportunity,
-- in one place so the notification fan-out, the discovery list, the detail
-- view and the apply action can never disagree.
create or replace function public.internal_freelancer_eligible_for_role(p_freelancer uuid, p_role_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.group_opportunity_roles;
  v_opp public.group_opportunities;
  v_fp public.freelancer_profiles;
  v_status text;
begin
  select * into v_role from public.group_opportunity_roles where id = p_role_id;
  if not found then return false; end if;
  select * into v_opp from public.group_opportunities where id = v_role.opportunity_id;
  if not found or v_opp.status <> 'open' or v_opp.event_date < current_date then return false; end if;
  if v_opp.client_id = p_freelancer then return false; end if;

  select * into v_fp from public.freelancer_profiles where user_id = p_freelancer;
  if not found or v_fp.title is distinct from v_role.category then return false; end if;
  if coalesce(v_fp.is_available, false) = false or coalesce(v_fp.visibility, 'public') = 'limited' then return false; end if;

  select coalesce(account_status, 'active') into v_status from public.users where id = p_freelancer;
  if v_status <> 'active' then return false; end if;

  if not public.internal_has_active_premium(p_freelancer) then return false; end if;
  if public.is_blocked(p_freelancer, v_opp.client_id) then return false; end if;
  if not public.internal_is_free_on_date(v_fp.id, p_freelancer, v_opp.event_date) then return false; end if;

  return public.provider_covers_location(
    coalesce(v_fp.locations, '[]'::jsonb) || coalesce(v_fp.studio_locations, '[]'::jsonb),
    v_opp.location_lat, v_opp.location_lng,
    coalesce(v_opp.location_city, '') || ' ' || coalesce(v_opp.location_text, '')
  );
end;
$$;
revoke all on function public.internal_freelancer_eligible_for_role(uuid, uuid) from public, anon, authenticated;

-- Posts an open Group Request and notifies eligible Premium freelancers once
-- each (one notification per freelancer per opportunity, even if they match
-- several roles), respecting their notification preference. The notification
-- deliberately carries no client identity.
create or replace function public.create_group_opportunity(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid := auth.uid();
  v_opp_id uuid;
  v_role jsonb;
  v_role_id uuid;
  v_roles jsonb := coalesce(p_payload->'roles', '[]'::jsonb);
  v_event_date date := nullif(p_payload->>'event_date', '')::date;
  v_notify record;
begin
  if v_client is null then raise exception 'Not authenticated'; end if;
  if v_event_date is null or v_event_date < current_date then
    raise exception 'The event date must be today or later';
  end if;
  if jsonb_typeof(v_roles) <> 'array' or jsonb_array_length(v_roles) not between 1 and 10 then
    raise exception 'Add between 1 and 10 roles';
  end if;
  -- Keeps a single account from flooding freelancers with alerts.
  if (select count(*) from public.group_opportunities where client_id = v_client and status = 'open') >= 5 then
    raise exception 'You already have 5 open group requests - close one before posting another';
  end if;

  insert into public.group_opportunities
    (client_id, title, description, event_date, start_time, end_time, location_city, location_text, location_lat, location_lng)
  values (
    v_client,
    trim(p_payload->>'title'),
    nullif(trim(coalesce(p_payload->>'description', '')), ''),
    v_event_date,
    nullif(p_payload->>'start_time', '')::time,
    nullif(p_payload->>'end_time', '')::time,
    nullif(trim(coalesce(p_payload->>'location_city', '')), ''),
    nullif(trim(coalesce(p_payload->>'location_text', '')), ''),
    nullif(p_payload->>'location_lat', '')::double precision,
    nullif(p_payload->>'location_lng', '')::double precision
  )
  returning id into v_opp_id;

  for v_role in select * from jsonb_array_elements(v_roles) loop
    insert into public.group_opportunity_roles (opportunity_id, category, budget, currency, styles, slots, note)
    values (
      v_opp_id,
      trim(v_role->>'category'),
      (v_role->>'budget')::numeric,
      coalesce(nullif(v_role->>'currency', ''), 'THB'),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_role->'styles', '[]'::jsonb))), '{}'),
      coalesce(nullif(v_role->>'slots', '')::integer, 1),
      nullif(trim(coalesce(v_role->>'note', '')), '')
    );
  end loop;

  for v_notify in
    select distinct fp.user_id
    from public.group_opportunity_roles r
    join public.freelancer_profiles fp on fp.title = r.category
    where r.opportunity_id = v_opp_id
      and public.internal_freelancer_eligible_for_role(fp.user_id, r.id)
      and coalesce((select np.opportunity_alerts from public.notification_preferences np where np.user_id = fp.user_id), true)
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = v_notify.user_id and n.type = 'opportunity_new' and n.related_id = v_opp_id
    ) then
      insert into public.notifications (user_id, actor_id, type, title, message, related_id, read, metadata)
      values (
        v_notify.user_id, null, 'opportunity_new',
        'New Group Request opportunity',
        'A new Group Request needs your skills' ||
          case when (select location_city from public.group_opportunities where id = v_opp_id) is not null
               then ' in ' || (select location_city from public.group_opportunities where id = v_opp_id) else '' end ||
          ' on ' || to_char(v_event_date, 'Mon DD, YYYY') || '. Open Opportunities to apply.',
        v_opp_id, false, jsonb_build_object('opportunity_id', v_opp_id)
      );
    end if;
  end loop;

  return v_opp_id;
end;
$$;
revoke all on function public.create_group_opportunity(jsonb) from public, anon;
grant execute on function public.create_group_opportunity(jsonb) to authenticated;

create or replace function public.close_group_opportunity(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_opportunities set status = 'closed'
    where id = p_opportunity_id and client_id = auth.uid();
  if not found then raise exception 'Opportunity not found'; end if;
end;
$$;
revoke all on function public.close_group_opportunity(uuid) from public, anon;
grant execute on function public.close_group_opportunity(uuid) to authenticated;

-- Shared shape for the list + detail views. Never includes client_id, the
-- exact address, other applicants, or anyone's subscription status.
create or replace function public.internal_opportunity_json(p_opp_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'title', o.title,
    'description', o.description,
    'event_date', o.event_date,
    'start_time', o.start_time,
    'end_time', o.end_time,
    'location_city', o.location_city,
    'status', o.status,
    'created_at', o.created_at,
    'has_applied', exists (select 1 from public.group_opportunity_applications a where a.opportunity_id = o.id and a.freelancer_id = p_viewer),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'category', r.category,
        'budget', r.budget,
        'currency', r.currency,
        'styles', r.styles,
        'slots', r.slots,
        'note', r.note,
        'slots_filled', (
          select count(*) from public.group_opportunity_applications a
          join public.requests q on q.id = a.request_id
          where a.role_id = r.id and q.status = 'accepted'
        ),
        'eligible', public.internal_freelancer_eligible_for_role(p_viewer, r.id)
      ) order by r.category)
      from public.group_opportunity_roles r where r.opportunity_id = o.id
    ), '[]'::jsonb)
  )
  from public.group_opportunities o where o.id = p_opp_id;
$$;
revoke all on function public.internal_opportunity_json(uuid, uuid) from public, anon, authenticated;

-- Discovery list: Premium only, and only opportunities where at least one
-- role is one this freelancer is eligible for.
create or replace function public.get_group_opportunities()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_result jsonb;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if not public.internal_has_active_premium(v_me) then
    raise exception 'PREMIUM_REQUIRED';
  end if;

  select coalesce(jsonb_agg(j order by (j->>'event_date'), (j->>'created_at')), '[]'::jsonb) into v_result
  from (
    select public.internal_opportunity_json(o.id, v_me) as j
    from public.group_opportunities o
    where o.status = 'open' and o.event_date >= current_date and o.client_id <> v_me
      and exists (
        select 1 from public.group_opportunity_roles r
        where r.opportunity_id = o.id and public.internal_freelancer_eligible_for_role(v_me, r.id)
      )
  ) s;
  return v_result;
end;
$$;
revoke all on function public.get_group_opportunities() from public, anon;
grant execute on function public.get_group_opportunities() to authenticated;

-- Detail: an active Premium freelancer who is eligible for it, OR anyone who
-- already applied (so a lapsed subscription never hides your own application).
create or replace function public.get_group_opportunity(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_applied boolean;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  select exists (select 1 from public.group_opportunity_applications where opportunity_id = p_opportunity_id and freelancer_id = v_me)
    into v_applied;
  if v_applied then
    return public.internal_opportunity_json(p_opportunity_id, v_me);
  end if;
  if not public.internal_has_active_premium(v_me) then
    raise exception 'PREMIUM_REQUIRED';
  end if;
  if not exists (
    select 1 from public.group_opportunity_roles r
    join public.group_opportunities o on o.id = r.opportunity_id
    where o.id = p_opportunity_id and o.status = 'open' and o.event_date >= current_date
      and public.internal_freelancer_eligible_for_role(v_me, r.id)
  ) then
    raise exception 'Opportunity not found';
  end if;
  return public.internal_opportunity_json(p_opportunity_id, v_me);
end;
$$;
revoke all on function public.get_group_opportunity(uuid) from public, anon;
grant execute on function public.get_group_opportunity(uuid) to authenticated;

-- Apply. Every rule is re-checked here, server side, at the moment of the
-- write. Creates a freelancer counter-offer on a normal `requests` row so the
-- client's existing review/accept/counter flow handles it from here.
create or replace function public.apply_to_group_opportunity(p_role_id uuid, p_price numeric, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role public.group_opportunity_roles;
  v_opp public.group_opportunities;
  v_request_id uuid;
  v_app_id uuid;
  v_msg text;
  v_schedule text;
  v_filled integer;
  v_start time;
  v_end time;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Enter a valid price'; end if;

  select * into v_role from public.group_opportunity_roles where id = p_role_id;
  if not found then raise exception 'Opportunity not found'; end if;
  select * into v_opp from public.group_opportunities where id = v_role.opportunity_id;

  if v_opp.client_id = v_me then raise exception 'You cannot apply to your own request'; end if;
  if v_opp.status <> 'open' or v_opp.event_date < current_date then raise exception 'This request is no longer open'; end if;

  if not public.internal_has_active_premium(v_me) then raise exception 'PREMIUM_REQUIRED'; end if;

  if exists (select 1 from public.group_opportunity_applications where opportunity_id = v_opp.id and freelancer_id = v_me) then
    raise exception 'ALREADY_APPLIED';
  end if;

  select count(*) into v_filled
    from public.group_opportunity_applications a
    join public.requests q on q.id = a.request_id
    where a.role_id = v_role.id and q.status = 'accepted';
  if v_filled >= v_role.slots then raise exception 'ROLE_FILLED'; end if;

  if not public.internal_freelancer_eligible_for_role(v_me, v_role.id) then
    raise exception 'NOT_ELIGIBLE';
  end if;

  v_start := coalesce(v_opp.start_time, time '12:00');
  v_end := coalesce(v_opp.end_time, v_start + interval '2 hours');
  v_schedule := '[[SCHEDULE_META:' || v_opp.event_date::text || ':' || to_char(v_start, 'HH24:MI') || ':' || to_char(v_end, 'HH24:MI') || ']]';
  v_msg := coalesce(nullif(trim(p_message), ''), 'Applying to your open Group Request.')
    || E'\n\n' || v_schedule
    || case when v_opp.location_city is not null then E'\n\n[[LOCATION_META:' || replace(v_opp.location_city, ']', '') || ']]' else '' end;

  insert into public.requests (
    client_id, freelancer_id, project_name, description, message, budget, status,
    counter_price, counter_message, counter_by, counter_round,
    counter_date, counter_time, counter_end_time,
    start_date, start_time, end_time
  ) values (
    v_opp.client_id, v_me, v_opp.title || ' — ' || v_role.category, v_msg, v_msg, v_role.budget, 'countered',
    p_price, nullif(trim(p_message), ''), 'freelancer', 1,
    v_opp.event_date, v_start, v_end,
    v_opp.event_date, v_start, v_end
  ) returning id into v_request_id;

  begin
    insert into public.group_opportunity_applications (opportunity_id, role_id, freelancer_id, request_id, proposed_price, message)
    values (v_opp.id, v_role.id, v_me, v_request_id, p_price, nullif(trim(p_message), ''))
    returning id into v_app_id;
  exception when unique_violation then
    raise exception 'ALREADY_APPLIED';
  end;

  insert into public.request_offers (request_id, round, offered_by, action, price, message, date, time, end_time)
  values (v_request_id, 1, 'freelancer', 'counter', p_price, nullif(trim(p_message), ''), v_opp.event_date, v_start, v_end);

  -- The client sees this like any other freelancer counter-offer. The type
  -- contains "request" so the notification panel routes it to My Requests.
  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read, metadata)
  values (
    v_opp.client_id, v_me, 'group_application_request', 'New application on your Group Request',
    'A freelancer applied to "' || v_opp.title || '" as ' || v_role.category || '. Review it in My Requests.',
    v_request_id, false, jsonb_build_object('request_id', v_request_id, 'opportunity_id', v_opp.id)
  );

  return v_app_id;
end;
$$;
revoke all on function public.apply_to_group_opportunity(uuid, numeric, text) from public, anon;
grant execute on function public.apply_to_group_opportunity(uuid, numeric, text) to authenticated;

-- "My applications": always available, subscription or not - a lapsed
-- subscription never hides or cancels an existing application.
create or replace function public.get_my_group_applications()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'opportunity_id', o.id,
    'title', o.title,
    'event_date', o.event_date,
    'location_city', o.location_city,
    'category', r.category,
    'proposed_price', a.proposed_price,
    'currency', r.currency,
    'message', a.message,
    'request_status', q.status,
    'counter_by', q.counter_by,
    'counter_price', q.counter_price,
    'applied_at', a.created_at,
    'updated_at', q.updated_at
  ) order by a.created_at desc), '[]'::jsonb)
  from public.group_opportunity_applications a
  join public.group_opportunities o on o.id = a.opportunity_id
  join public.group_opportunity_roles r on r.id = a.role_id
  left join public.requests q on q.id = a.request_id
  where a.freelancer_id = auth.uid();
$$;
revoke all on function public.get_my_group_applications() from public, anon;
grant execute on function public.get_my_group_applications() to authenticated;

-- Application status -> notification. Fires when the client accepts,
-- rejects, cancels, or counters back on a request that came from an
-- application. Existing (and already accepted) applications keep getting
-- updates regardless of subscription state.
create or replace function public.notify_group_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.group_opportunity_applications;
  v_opp public.group_opportunities;
  v_event text;
  v_text text;
begin
  if new.status is not distinct from old.status and new.counter_by is not distinct from old.counter_by then
    return new;
  end if;

  select * into v_app from public.group_opportunity_applications where request_id = new.id;
  if not found then return new; end if;
  select * into v_opp from public.group_opportunities where id = v_app.opportunity_id;

  if new.status = 'accepted' then
    v_event := 'accepted'; v_text := 'was accepted';
  elsif new.status = 'rejected' then
    v_event := 'declined'; v_text := 'was declined';
  elsif new.status = 'cancelled' then
    v_event := 'cancelled'; v_text := 'was withdrawn by the client';
  elsif new.status = 'countered' and new.counter_by = 'client' then
    v_event := 'countered'; v_text := 'received a counter-offer';
  else
    return new;
  end if;

  if not coalesce((select np.application_updates from public.notification_preferences np where np.user_id = v_app.freelancer_id), true) then
    return new;
  end if;

  if exists (
    select 1 from public.notifications n
    where n.user_id = v_app.freelancer_id and n.type = 'application_update'
      and n.related_id = v_opp.id and n.metadata->>'event' = v_event
      and n.metadata->>'application_id' = v_app.id::text
  ) then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read, metadata)
  values (
    v_app.freelancer_id, null, 'application_update', 'Application update',
    'Your application for "' || v_opp.title || '" ' || v_text || '.',
    v_opp.id, false, jsonb_build_object('event', v_event, 'application_id', v_app.id)
  );
  return new;
end;
$$;
revoke all on function public.notify_group_application_update() from public, anon, authenticated;

DO $$ BEGIN
  CREATE TRIGGER requests_notify_group_application_update
    AFTER UPDATE ON public.requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_group_application_update();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. Event Matching eligibility
--
-- Returns the same profile fields getEventMatcherCandidates() has always
-- selected, with the same filters (category, available, not limited-
-- visibility, active account) - plus "has an active Premium subscription".
-- The availability / location / budget / style matching that follows is
-- unchanged and still happens in src/lib/eventMatcher.ts. Nothing here
-- reveals or scores subscription status.
-- ============================================================
create or replace function public.get_event_matcher_candidates(p_category text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', fp.id,
    'user_id', fp.user_id,
    'title', fp.title,
    'styles', fp.styles,
    'experience_years', fp.experience_years,
    'hourly_rate', fp.hourly_rate,
    'locations', fp.locations,
    'studio_locations', fp.studio_locations,
    'users', jsonb_build_object(
      'id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url, 'gender', u.gender,
      'rating', u.rating, 'total_reviews', u.total_reviews,
      'account_status', u.account_status, 'preferred_currency', u.preferred_currency
    )
  )), '[]'::jsonb)
  from public.freelancer_profiles fp
  join public.users u on u.id = fp.user_id
  where auth.uid() is not null
    and fp.title = p_category
    and fp.is_available = true
    and coalesce(fp.visibility, 'public') <> 'limited'
    and coalesce(u.account_status, 'active') = 'active'
    and public.internal_has_active_premium(fp.user_id);
$$;
revoke all on function public.get_event_matcher_candidates(text) from public, anon;
grant execute on function public.get_event_matcher_candidates(text) to authenticated;
