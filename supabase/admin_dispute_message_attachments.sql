-- Lets an admin attach a photo to a dispute message, the same way a
-- client/freelancer already can (DataService.submitDisputeEvidenceItem).
-- admin_send_dispute_message() previously only ever took plain text, and
-- even with a storage_path param, the admin's own upload would still be
-- rejected — the existing booking-evidence INSERT policy (see
-- supabase/booking_escrow.sql) only ever allowed the booking's own
-- client_id/freelancer_id to upload into it, never an admin.
--
-- Run this once against your Supabase project's SQL editor, after
-- dispute_admin_messages.sql already exists.

DO $$ BEGIN
  CREATE POLICY "Admins can upload booking evidence files" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'booking-evidence'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_admin(auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Replaces the 2-arg version with a 3-arg one (adds p_storage_path) —
-- Postgres treats a different parameter list as a different function, so
-- the old 2-arg overload is dropped explicitly rather than left orphaned.
drop function if exists public.admin_send_dispute_message(uuid, text);

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
  -- A photo on its own is a complete message now — no caption required,
  -- as long as at least one of the two is present.
  if coalesce(trim(p_message), '') = '' and p_storage_path is null then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.dispute_evidence (booking_id, round, submitted_by, role, evidence_type, description, storage_path)
    values (p_booking_id, coalesce(v_booking.dispute_round, 1), v_admin, 'admin', 'message', nullif(trim(p_message), ''), p_storage_path)
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

revoke all on function public.admin_send_dispute_message(uuid, text, text) from public;
grant execute on function public.admin_send_dispute_message(uuid, text, text) to authenticated;
