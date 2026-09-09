-- Wires the 'annulled' status (added in supabase/booking_overlap_protection.sql)
-- into reconcile_booking_escrow()'s 24h-unpaid-deposit branch, which
-- previously set status = 'cancelled' for this case — a lapsed deposit
-- deadline is a system-driven invalidation, not an intentional
-- cancellation, and the two are worth telling apart in analytics/audit
-- history. cancellation_reason='deposit_not_paid' is kept for detail.
--
-- Run this once against your Supabase project's SQL editor, AFTER
-- booking_overlap_protection.sql has been run and committed — Postgres
-- won't let a brand-new enum value be referenced in the same transaction
-- that added it, so these must be two separate statements/runs.
--
-- Re-created in full (not just the changed line) since CREATE OR REPLACE
-- FUNCTION replaces the whole body — this must match the authoritative
-- version in supabase/booking_completion_status_fix.sql plus the one
-- status change.

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
    update public.bookings set status = 'annulled', cancellation_reason = 'deposit_not_paid'
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
    update public.bookings set payment_status = 'paid', status = 'completed'
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
    update public.bookings set dispute_status = 'under_admin_review'
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, reason) values
        (p_booking_id, 'system', 'complain',
         format('%s did not respond within 72 hours. Escalated for admin review.',
                case when v_booking.dispute_awaiting = 'freelancer' then 'Freelancer' else 'Client' end));
      return v_updated;
    end if;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.reconcile_booking_escrow(uuid) from public;
grant execute on function public.reconcile_booking_escrow(uuid) to authenticated;

-- One-time backfill: any booking that already lapsed its deposit deadline
-- under the old logic (status='cancelled', cancellation_reason=
-- 'deposit_not_paid') is retroactively relabeled 'annulled' so historical
-- data matches the new distinction too.
update public.bookings
  set status = 'annulled'
  where status = 'cancelled' and cancellation_reason = 'deposit_not_paid';
