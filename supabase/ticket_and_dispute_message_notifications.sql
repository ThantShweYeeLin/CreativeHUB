-- Fills in the missing notification directions on the two support
-- conversations:
--   - support_ticket_messages already notifies the ticket owner when an
--     admin replies (notify_on_ticket_message(), 'ticket_reply' — see
--     support_ticket_messages.sql) but never notified anyone when the
--     ticket owner replies — no admin ever found out without going and
--     checking the ticket list themselves.
--   - dispute_evidence 'message' rows notify both participants when an
--     ADMIN sends one (admin_send_dispute_message() — see
--     dispute_admin_messages.sql) but a client/freelancer reply notified
--     no one at all: not admins, not the other participant.
--
-- Both fixed the same way as the existing admin-side notifications: a
-- trigger, so every reply notifies regardless of which screen sent it, not
-- just the ones a particular caller remembered to also notify from.
--
-- Run this once against your Supabase project's SQL editor, after
-- support_ticket_messages.sql and dispute_admin_messages.sql already exist.

create or replace function public.notify_on_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
begin
  select * into v_ticket from public.support_tickets where id = new.ticket_id;

  if v_ticket.user_id != new.sender_id and public.is_admin(new.sender_id) then
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
      values (
        v_ticket.user_id, new.sender_id, 'ticket_reply',
        'New reply on your ticket',
        'An admin replied to your support ticket.',
        new.ticket_id, false
      );
  elsif new.sender_id = v_ticket.user_id then
    -- The ticket owner replied — every admin needs to know, not just
    -- whoever happens to have the ticket list open. related_id is the
    -- ticket id, same as the admin-reply direction above, so the client-side
    -- 'ticket_'-prefixed routing (and the admin bell's own routing) both
    -- land on the same ticket regardless of who's opening it.
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
      select u.id, new.sender_id, 'ticket_message',
        'New reply on a support ticket',
        'A user replied on their support ticket. Open it to read and reply.',
        new.ticket_id, false
      from public.users u
      where u.role = 'admin';
  end if;

  return new;
end;
$$;

-- Trigger already exists (support_ticket_messages.sql) — CREATE OR REPLACE
-- on the function above is enough, no need to touch the trigger itself.

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
    -- Admin-authored messages already notify both participants inline, from
    -- inside admin_send_dispute_message() itself (see
    -- dispute_admin_messages.sql) — nothing further to do here for those.
    return new;
  end if;

  select * into v_booking from public.bookings where id = new.booking_id;
  if not found then
    return new;
  end if;

  -- Notify the other participant on this same dispute thread — a client's
  -- message is otherwise invisible to the freelancer (and vice versa) until
  -- they happen to reopen the page.
  if new.role = 'client' then
    perform public.create_social_notification(
      v_booking.freelancer_id, new.submitted_by, 'dispute_message',
      'New message on your dispute',
      'The client sent a message about your dispute. Open it to read and reply.',
      null, null, '{}'::jsonb, v_booking.id
    );
  elsif new.role = 'freelancer' then
    perform public.create_social_notification(
      v_booking.client_id, new.submitted_by, 'dispute_message',
      'New message on your dispute',
      'The freelancer sent a message about your dispute. Open it to read and reply.',
      null, null, '{}'::jsonb, v_booking.id
    );
  end if;

  -- Every admin needs to know a participant replied, the same way they'd
  -- need to know about a fresh dispute filing.
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

drop trigger if exists dispute_evidence_message_notify on public.dispute_evidence;
create trigger dispute_evidence_message_notify
  after insert on public.dispute_evidence
  for each row execute function public.notify_on_dispute_message();
