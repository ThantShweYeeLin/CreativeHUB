-- Rewords reconcile_attendance_window()'s two "check-in is open" notifications
-- (originally in attendance_verification.sql). Both used to be an identical,
-- nameless "Your attendance check for ... is now available" with
-- actor_id = null, relying entirely on NotificationsPanel's bold actor-name
-- prefix (resolved client-side from related_id) to attribute it to anyone at
-- all. Per the same "instructional, not informational" rule applied to
-- deposit_payment_required: the recipient isn't being told what the OTHER
-- party did, they're being told what THEY need to do, so a bold name before
-- the sentence reads like a command directed at that other person, not a
-- reminder to the recipient. Reframed as "Check-in is now open for '[Service]'
-- with [Name]. ..." so the name is the object of "with", not the sentence's
-- subject, and the actor_id/bold-name prefix is suppressed for this type in
-- NotificationsPanel.tsx (the message already names that person, so the
-- separate bold prefix would just repeat it).
--
-- v2: reworded again per confirmed spec — "Check-in is now open for
-- '[Service]' with [Name]. Please confirm you've arrived and can see the
-- other party at the location." Each side's [Name] already correctly
-- resolved to "the other party from the recipient's perspective"
-- (v_freelancer_name on the client's row, v_client_name on the
-- freelancer's) before this revision — only the surrounding wording changed.
--
-- Re-declares reconcile_attendance_window() in full (create or replace),
-- following this repo's existing pattern of later migrations patching an
-- earlier function's body.

create or replace function public.reconcile_attendance_window(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_updated public.bookings%rowtype;
  v_scheduled_at timestamptz;
  v_client_name text;
  v_freelancer_name text;
begin
  select b.* into v_booking from public.bookings b
    where b.id = p_booking_id and (b.client_id = auth.uid() or b.freelancer_id = auth.uid());
  if not found then
    raise exception 'Not authorized for this booking';
  end if;

  if v_booking.attendance_window_notified_at is not null or v_booking.start_date is null then
    return v_booking;
  end if;

  v_scheduled_at := (v_booking.start_date::text || ' ' || coalesce(v_booking.start_time::text, '00:00'))::timestamp
    at time zone 'Asia/Bangkok';

  if now() < v_scheduled_at - interval '30 minutes' then
    return v_booking;
  end if;

  update public.bookings set attendance_window_notified_at = timezone('utc', now())
    where id = p_booking_id and attendance_window_notified_at is null
    returning * into v_updated;

  if found then
    select u.full_name into v_client_name from public.users u where u.id = v_booking.client_id;
    select u.full_name into v_freelancer_name from public.users u where u.id = v_booking.freelancer_id;

    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read) values
      (v_booking.client_id, v_booking.freelancer_id, 'attendance_window_open',
       'Attendance check available',
       format('Check-in is now open for ''%s'' with %s. Please confirm you''ve arrived and can see the other party at the location.',
         v_booking.project_name, coalesce(v_freelancer_name, 'your freelancer')),
       p_booking_id, false),
      (v_booking.freelancer_id, v_booking.client_id, 'attendance_window_open',
       'Attendance check available',
       format('Check-in is now open for ''%s'' with %s. Please confirm you''ve arrived and can see the other party at the location.',
         v_booking.project_name, coalesce(v_client_name, 'your client')),
       p_booking_id, false);
    return v_updated;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.reconcile_attendance_window(uuid) from public;
grant execute on function public.reconcile_attendance_window(uuid) to authenticated;
