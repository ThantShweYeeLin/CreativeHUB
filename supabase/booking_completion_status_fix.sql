-- bookings.status never actually reached 'completed' anywhere in the
-- deposit/escrow lifecycle - only payment_status/dispute_status changed.
-- The client-confirmation path is fixed in application code
-- (DataService.confirmBookingCompletion). This migration applies the same
-- fix to the two system/admin paths that also finalize a booking's
-- payment: the 7-day silent auto-release, and an admin's dispute
-- resolution. Until now this meant the review system (gated on
-- status = 'completed') was unreachable for any booking finalized through
-- those paths, and MyBookingsPage's already-built "Completed" badge never
-- rendered. Re-created here in full (not just the changed lines) since
-- CREATE OR REPLACE FUNCTION replaces the whole body - this must match the
-- authoritative versions in admin_system_2_rest.sql plus the one addition.

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

create or replace function public.admin_resolve_dispute(p_booking_id uuid, p_decision text, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_booking public.bookings;
  v_updated public.bookings;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('refund','release') then
    raise exception 'Invalid decision';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  update public.bookings
    set payment_status = case when p_decision = 'refund' then 'refunded' else 'paid' end,
        status = 'completed',
        dispute_status = 'resolved',
        dispute_awaiting = null
    where id = p_booking_id
    returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, 'admin', case when p_decision = 'refund' then 'refunded' else 'released' end, p_reason);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'resolve_dispute', 'dispute', p_booking_id, jsonb_build_object('decision', p_decision, 'reason', p_reason));

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
    (v_booking.client_id, v_admin, 'booking_disputed',
     'Dispute resolved',
     case when p_decision = 'refund' then 'CreativeHUB support reviewed your dispute and refunded the deposit.'
          else 'CreativeHUB support reviewed the dispute and released the deposit to the freelancer.' end,
     p_booking_id, false),
    (v_booking.freelancer_id, v_admin, 'booking_disputed',
     'Dispute resolved',
     case when p_decision = 'refund' then 'CreativeHUB support reviewed the dispute and refunded the deposit to the client.'
          else 'CreativeHUB support reviewed the dispute and released the deposit to you.' end,
     p_booking_id, false);

  return v_updated;
end;
$$;

revoke all on function public.reconcile_booking_escrow(uuid) from public;
grant execute on function public.reconcile_booking_escrow(uuid) to authenticated;
revoke all on function public.admin_resolve_dispute(uuid, text, text) from public;
grant execute on function public.admin_resolve_dispute(uuid, text, text) to authenticated;

-- One-time backfill: any existing booking that already finished its
-- deposit lifecycle (paid or refunded) before this fix, but never got
-- marked 'completed', so reviews and the Completed badge work for it too.
update public.bookings
  set status = 'completed'
  where payment_status in ('paid', 'refunded')
    and status not in ('completed', 'cancelled');
