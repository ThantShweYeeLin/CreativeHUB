-- Admin dispute messaging was two-sided by design: admin_send_dispute_message()
-- notified both booking.client_id and booking.freelancer_id on every admin
-- message, the "Participants view own dispute evidence" policy let both of
-- them read every dispute_evidence row regardless of who it was from or to,
-- and notify_on_dispute_message() even let a client/freelancer's own reply
-- notify the other side directly - a real client<->freelancer conversation
-- channel inside a dispute, not just an admin broadcast.
--
-- That's the opposite of the intended design: admin should only ever be
-- talking to whichever party actually filed the dispute, so there is no
-- direct back-and-forth between the client and freelancer themselves over a
-- live disagreement. The other (reported) party should still see that a
-- dispute exists and their deposit is frozen (booking.dispute_status, which
-- this migration does not touch) and can still submit their own evidence
-- into the record, but should never see the reporter's or admin's messages.
--
-- Run this once against your Supabase project's SQL editor, after
-- dispute_evidence.sql, booking_escrow.sql, dispute_admin_messages.sql,
-- admin_dispute_message_attachments.sql, and
-- ticket_and_dispute_message_notifications.sql already exist. Safe to re-run.

-- 1) Who actually filed this dispute. openBookingDispute() (dataService.ts)
--    rejects a second dispute on an already-disputed booking, so there is
--    at most one genuine client/freelancer 'complain' event per booking -
--    the first one is always the original filer, regardless of which side.
--    admin's own 'complain' rows (from admin_request_more_evidence) are
--    excluded by the actor filter.
create or replace function public.dispute_reporter_id(p_booking_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case e.actor
    when 'client' then b.client_id
    when 'freelancer' then b.freelancer_id
    else null
  end
  from public.booking_events e
  join public.bookings b on b.id = e.booking_id
  where e.booking_id = p_booking_id and e.action = 'complain' and e.actor in ('client', 'freelancer')
  order by e.created_at asc
  limit 1;
$$;

revoke all on function public.dispute_reporter_id(uuid) from public;
grant execute on function public.dispute_reporter_id(uuid) to authenticated, service_role;

-- 2) booking_events carries the whole booking lifecycle (deposit_paid,
--    completion_submitted, confirmed, released, ...), which both parties
--    still need to see in full - only 'complain' rows (the dispute filing
--    itself, and an admin's "requested more evidence" log entry) are the
--    private part that should be hidden from whoever isn't the reporter.
drop policy if exists "Participants view own booking events" on public.booking_events;
create policy "Participants view own booking events" on public.booking_events for select
  using (
    (auth.uid() = (select client_id from public.bookings where id = booking_id)
      or auth.uid() = (select freelancer_id from public.bookings where id = booking_id))
    and (action <> 'complain' or auth.uid() = public.dispute_reporter_id(booking_id))
  );

-- 3) dispute_evidence: a participant can always see what they themselves
--    submitted (so the reported party can still see their own evidence
--    went into the record), and the reporter can additionally see
--    everything else on the thread (the admin's messages, their own
--    earlier items). The reported party never sees the reporter's or
--    admin's messages.
drop policy if exists "Participants view own dispute evidence" on public.dispute_evidence;
create policy "Participants view own dispute evidence" on public.dispute_evidence for select
  using (
    submitted_by = auth.uid()
    or auth.uid() = public.dispute_reporter_id(booking_id)
  );

-- 4) admin_send_dispute_message(): notify only the reporter, not both
--    parties. Falls back to the client if no 'complain' event can be found
--    at all (defensive, for any pre-existing dispute without one) since
--    that was this function's hardcoded behavior before either party could
--    file.
create or replace function public.admin_send_dispute_message(p_booking_id uuid, p_message text, p_storage_path text default null)
returns public.dispute_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_booking public.bookings;
  v_inserted public.dispute_evidence;
  v_reporter uuid;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.dispute_status is null or v_booking.dispute_status = 'none' then
    raise exception 'This booking has no dispute to message about';
  end if;
  if coalesce(trim(p_message), '') = '' and p_storage_path is null then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.dispute_evidence (booking_id, round, submitted_by, role, evidence_type, description, storage_path)
    values (p_booking_id, coalesce(v_booking.dispute_round, 1), v_admin, 'admin', 'message', nullif(trim(p_message), ''), p_storage_path)
    returning * into v_inserted;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'send_dispute_message', 'dispute', p_booking_id, '{}'::jsonb);

  v_reporter := coalesce(public.dispute_reporter_id(p_booking_id), v_booking.client_id);

  perform public.create_social_notification(
    v_reporter, v_admin, 'dispute_message',
    'CreativeHUB support sent you a message',
    'Support sent a message about your dispute. Open your ticket to read it.',
    null, null, '{}'::jsonb, p_booking_id
  );

  return v_inserted;
end;
$$;

revoke all on function public.admin_send_dispute_message(uuid, text, text) from public;
grant execute on function public.admin_send_dispute_message(uuid, text, text) to authenticated;

-- 5) notify_on_dispute_message(): drop the "notify the other participant"
--    branch entirely - a client/freelancer's own reply (still possible via
--    submitDisputeEvidenceItem, e.g. submitting extra evidence) should
--    reach admins, never the other side directly. The admin-authored
--    branch is already handled inline above and unaffected.
create or replace function public.notify_on_dispute_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if new.evidence_type <> 'message' or new.role = 'admin' then
    return new;
  end if;

  select * into v_booking from public.bookings where id = new.booking_id;
  if not found then
    return new;
  end if;

  -- Every admin needs to know a participant replied, the same way they'd
  -- need to know about a fresh dispute filing. The other participant is
  -- deliberately not notified here any more - see this file's header.
  insert into public.notifications (user_id, actor_id, type, title, message, related_id, metadata, read)
    select u.id, new.submitted_by, 'dispute_message',
      'New message on a dispute',
      'A user sent a message about their dispute. Open it to read and reply.',
      v_booking.id, '{}'::jsonb, false
    from public.users u
    where u.role = 'admin';

  return new;
end;
$$;

-- Trigger already exists (ticket_and_dispute_message_notifications.sql) -
-- CREATE OR REPLACE on the function above is enough.

-- 6) Cosmetic but worth fixing since it's now accurate: the log entry this
--    writes is a 'complain' row, which step 2 above now hides from whoever
--    isn't the reporter anyway.
create or replace function public.admin_request_more_evidence(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_deadline timestamptz := now() + interval '72 hours';
  v_updated public.bookings;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;

  update public.bookings set dispute_response_deadline = v_deadline where id = p_booking_id
    returning * into v_updated;

  insert into public.booking_events (booking_id, actor, action, reason)
    values (p_booking_id, 'admin', 'complain', 'CreativeHUB support requested more evidence from the reporter.');

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'request_more_evidence', 'dispute', p_booking_id, jsonb_build_object('new_deadline', v_deadline));

  return v_updated;
end;
$$;

revoke all on function public.admin_request_more_evidence(uuid) from public;
grant execute on function public.admin_request_more_evidence(uuid) to authenticated;
