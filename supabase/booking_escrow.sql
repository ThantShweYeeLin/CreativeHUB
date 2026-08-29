-- Deposit escrow lifecycle: 24h payment deadline (auto-annul), evidence-based
-- completion, a 7-day client confirm/dispute window (auto-release), and a
-- 2-round dispute exchange with a final automatic arbitration. Run this once
-- against your Supabase project's SQL editor.

alter table public.bookings
  add column if not exists deposit_deadline timestamptz,
  -- Freelancer's completion CLAIM timestamp, not independently verified —
  -- a disputed-and-refunded booking can still have this set.
  add column if not exists completed_at timestamptz,
  add column if not exists completion_evidence_text text,
  add column if not exists completion_evidence_photos text[] default array[]::text[],
  add column if not exists client_response_deadline timestamptz,
  add column if not exists dispute_status text default 'none'
    check (dispute_status in ('none','open','resolved')),
  add column if not exists dispute_round int default 0,
  add column if not exists dispute_awaiting text
    check (dispute_awaiting in ('client','freelancer')),
  add column if not exists dispute_response_deadline timestamptz,
  add column if not exists cancellation_reason text;

create table if not exists public.booking_events (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  round int,
  actor text not null check (actor in ('client','freelancer','system')),
  action text not null check (action in (
    'deposit_paid','completion_submitted','confirmed',
    'complain','evidence','conceded','released','refunded','annulled'
  )),
  category text check (category in ('no_show','not_as_agreed','other')),
  reason text,
  evidence_text text,
  evidence_photos text[] default array[]::text[],
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_booking_events_booking_id on public.booking_events(booking_id, created_at);

alter table public.booking_events enable row level security;

DO $$ BEGIN
  CREATE POLICY "Participants view own booking events" ON public.booking_events FOR SELECT
    USING (auth.uid() in (select client_id from public.bookings where id = booking_id)
        OR auth.uid() in (select freelancer_id from public.bookings where id = booking_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only 'client'/'freelancer' actor rows can be inserted directly, and only
-- by the participant they claim to be — closes the actor-forgery hole.
-- 'system' rows can ONLY come from the security-definer functions below,
-- which bypass RLS internally but re-verify their own trigger conditions.
DO $$ BEGIN
  CREATE POLICY "Participants insert own booking events as themselves" ON public.booking_events FOR INSERT
    WITH CHECK (
      (actor = 'client' AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND client_id = auth.uid()))
      OR
      (actor = 'freelancer' AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND freelancer_id = auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Private evidence bucket — folder layout is {uploaderUserId}/{bookingId}/{filename}.
insert into storage.buckets (id, name, public)
values ('booking-evidence', 'booking-evidence', false)
on conflict (id) do update set public = excluded.public;

DO $$ BEGIN
  CREATE POLICY "Participants view own booking evidence" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'booking-evidence'
      AND EXISTS (
        SELECT 1 FROM public.bookings
        WHERE bookings.id::text = (storage.foldername(name))[2]
        AND (bookings.client_id = auth.uid() OR bookings.freelancer_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Uploader must be who they say AND the booking-id segment must be a
-- booking they actually participate in (closes the folder-forgery hole).
DO $$ BEGIN
  CREATE POLICY "Users can upload own booking evidence files" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'booking-evidence'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.bookings
        WHERE bookings.id::text = (storage.foldername(name))[2]
        AND (bookings.client_id = auth.uid() OR bookings.freelancer_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trusted, self-verifying deadline enforcement. Re-derives each condition
-- from the booking's own stored timestamps against real now() — never
-- trusts a caller-supplied "what should happen" — so it's safe to expose
-- to any authenticated participant. Applies at most one due transition
-- per call; a guarded UPDATE + only-log-on-success pattern makes repeat
-- calls (e.g. two concurrent viewers) idempotent.
create or replace function public.reconcile_booking_escrow(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_updated public.bookings;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and (client_id = auth.uid() or freelancer_id = auth.uid());
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.status = 'pending' and v_booking.payment_status = 'unpaid'
     and v_booking.deposit_deadline is not null and now() > v_booking.deposit_deadline then
    update public.bookings set status = 'cancelled', cancellation_reason = 'deposit_not_paid'
      where id = p_booking_id and status = 'pending' and payment_status = 'unpaid'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, reason)
        values (p_booking_id, 'system', 'annulled', 'Deposit not paid within 24 hours');
      return v_updated;
    end if;
  end if;

  if v_booking.dispute_status = 'none' and v_booking.payment_status = 'deposit_paid'
     and v_booking.completed_at is not null and v_booking.client_response_deadline is not null
     and now() > v_booking.client_response_deadline then
    update public.bookings set payment_status = 'paid'
      where id = p_booking_id and dispute_status = 'none' and payment_status = 'deposit_paid'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, reason)
        values (p_booking_id, 'system', 'released', 'No client response within 7 days');
      return v_updated;
    end if;
  end if;

  if v_booking.dispute_status = 'open' and v_booking.dispute_response_deadline is not null
     and now() > v_booking.dispute_response_deadline then
    if v_booking.dispute_awaiting = 'freelancer' then
      update public.bookings set payment_status = 'refunded', dispute_status = 'resolved', dispute_awaiting = null
        where id = p_booking_id and dispute_status = 'open' and dispute_awaiting = 'freelancer'
        returning * into v_updated;
      if found then
        insert into public.booking_events (booking_id, actor, action, reason)
          values (p_booking_id, 'system', 'refunded', 'Freelancer did not respond within 72 hours');
        return v_updated;
      end if;
    elsif v_booking.dispute_awaiting = 'client' then
      update public.bookings set payment_status = 'paid', dispute_status = 'resolved', dispute_awaiting = null
        where id = p_booking_id and dispute_status = 'open' and dispute_awaiting = 'client'
        returning * into v_updated;
      if found then
        insert into public.booking_events (booking_id, actor, action, reason)
          values (p_booking_id, 'system', 'released', 'Client did not respond within 72 hours');
        return v_updated;
      end if;
    end if;
  end if;

  return v_booking;
end;
$$;

-- Final arbitration once dispute rounds are exhausted or the freelancer
-- explicitly concedes. Re-derives eligibility from booking_events itself —
-- an explicit 'conceded' row (not just the absence of 'evidence') for an
-- immediate refund, or an 'evidence' row at the round cap for a release —
-- instead of trusting a caller-supplied outcome. If NEITHER a 'conceded'
-- nor an 'evidence' event exists for the current round, the freelancer
-- simply hasn't answered yet (still within their 72h window) and this is a
-- deliberate no-op — that case belongs to reconcile_booking_escrow's
-- timeout branch, not to a call made the moment a client gets impatient.
create or replace function public.arbitrate_booking_dispute(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_updated public.bookings;
  v_has_evidence boolean;
  v_has_conceded boolean;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and (client_id = auth.uid() or freelancer_id = auth.uid());
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.dispute_status <> 'open' then
    return v_booking;
  end if;

  select exists(
    select 1 from public.booking_events
    where booking_id = p_booking_id and round = v_booking.dispute_round
      and actor = 'freelancer' and action = 'evidence'
  ) into v_has_evidence;

  select exists(
    select 1 from public.booking_events
    where booking_id = p_booking_id and round = v_booking.dispute_round
      and actor = 'freelancer' and action = 'conceded'
  ) into v_has_conceded;

  if v_has_conceded then
    update public.bookings set payment_status = 'refunded', dispute_status = 'resolved', dispute_awaiting = null
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, round, reason) values
        (p_booking_id, 'system', 'refunded', v_booking.dispute_round, 'Freelancer conceded — no evidence provided for this round.');
    end if;
    return coalesce(v_updated, v_booking);
  end if;

  if v_has_evidence and v_booking.dispute_round >= 2 then
    update public.bookings set payment_status = 'paid', dispute_status = 'resolved', dispute_awaiting = null
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, round, reason) values
        (p_booking_id, 'system', 'released', v_booking.dispute_round,
         'Dispute rounds exhausted; the freelancer''s evidence was not further rebutted. This is a procedural decision — the system does not evaluate whether the evidence proves the work was completed.');
    end if;
    return coalesce(v_updated, v_booking);
  end if;

  -- Neither condition met yet (no response this round, or evidence given
  -- but rounds remain) — not arbitration-eligible; leave the dispute open.
  return v_booking;
end;
$$;
