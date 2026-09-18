-- Lets an admin send a message to both participants on a booking dispute,
-- visible in the same dispute conversation the client/freelancer already
-- see and reply to from their own side (see DisputeTicketDetailPage.tsx,
-- which reads dispute_evidence rows with evidence_type = 'message'). Until
-- now only client/freelancer could write a 'message' row there (dispute_
-- evidence.sql's role check + INSERT policy only allow role in ('client',
-- 'freelancer')) - admin had no way to write into that same thread at all.
--
-- Deliberately reuses dispute_evidence rather than adding a new table: it's
-- already the shared, per-round-and-role evidence/conversation store for a
-- dispute, already has the exact 'message' evidence_type this needs, and
-- the client-side conversation UI already renders every 'message' row
-- regardless of who submitted it.
--
-- Run this once against your Supabase project's SQL editor, after
-- dispute_evidence.sql already exists.

DO $$ BEGIN
  alter table public.dispute_evidence drop constraint dispute_evidence_role_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

alter table public.dispute_evidence
  add constraint dispute_evidence_role_check
  check (role in ('client', 'freelancer', 'admin'));

-- No new RLS INSERT policy for admins - the existing "Participants insert
-- own dispute evidence as themselves" policy only ever matches role =
-- 'client'/'freelancer' against the booking's own participants, so it can
-- never be satisfied by an admin. The only way an admin row gets in is
-- through this security-definer RPC, same "narrow RPC + audit trail, no
-- arbitrary edits" pattern as admin_add_ticket_note/admin_update_ticket_status
-- (see support_ticket_privacy_and_lifecycle.sql).
create or replace function public.admin_send_dispute_message(p_booking_id uuid, p_message text)
returns public.dispute_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_booking public.bookings;
  v_inserted public.dispute_evidence;
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
  if coalesce(trim(p_message), '') = '' then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.dispute_evidence (booking_id, round, submitted_by, role, evidence_type, description)
    values (p_booking_id, coalesce(v_booking.dispute_round, 1), v_admin, 'admin', 'message', p_message)
    returning * into v_inserted;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'send_dispute_message', 'dispute', p_booking_id, '{}'::jsonb);

  -- Both participants get notified - unlike a client/freelancer reply
  -- (which only the other side would need to know about), an admin message
  -- is CreativeHUB support reaching out, which both sides of the dispute
  -- care about.
  perform public.create_social_notification(
    v_booking.client_id, v_admin, 'dispute_message',
    'CreativeHUB support sent you a message',
    'Support sent a message about your dispute. Open your ticket to read it.',
    null, null, '{}'::jsonb, p_booking_id
  );
  perform public.create_social_notification(
    v_booking.freelancer_id, v_admin, 'dispute_message',
    'CreativeHUB support sent you a message',
    'Support sent a message about your dispute. Open your ticket to read it.',
    null, null, '{}'::jsonb, p_booking_id
  );

  return v_inserted;
end;
$$;

revoke all on function public.admin_send_dispute_message(uuid, text) from public;
grant execute on function public.admin_send_dispute_message(uuid, text) to authenticated;
