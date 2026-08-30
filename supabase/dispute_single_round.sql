-- The client's "Still Not Satisfied" response now goes straight to admin
-- review instead of escalating to a second round (see respondToBookingDispute
-- in dataService.ts) - dispute_round can no longer reach 2, so the
-- round-cap/evidence branch in arbitrate_booking_dispute() below is dead
-- code. This drops it, leaving only the "freelancer explicitly conceded"
-- case, which is the sole remaining caller of this function. Safe to run
-- multiple times.

create or replace function public.arbitrate_booking_dispute(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_updated public.bookings;
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
      and actor = 'freelancer' and action = 'conceded'
  ) into v_has_conceded;

  if v_has_conceded then
    update public.bookings set dispute_status = 'under_admin_review'
      where id = p_booking_id and dispute_status = 'open'
      returning * into v_updated;
    if found then
      insert into public.booking_events (booking_id, actor, action, round, reason) values
        (p_booking_id, 'system', 'complain', v_booking.dispute_round,
         'Freelancer conceded - no evidence provided. Escalated for admin review.');
    end if;
    return coalesce(v_updated, v_booking);
  end if;

  return v_booking;
end;
$$;
