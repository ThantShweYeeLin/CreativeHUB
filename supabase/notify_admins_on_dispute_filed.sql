-- No admin notification was ever wired to a booking's dispute_status
-- transitioning into 'under_admin_review' — only follow-up chat messages on
-- an already-open dispute notify admins (notify_on_dispute_message(), see
-- ticket_and_dispute_message_notifications.sql / dispute_reporter_only_messaging.sql).
-- openBookingDispute() (dataService.ts) sets dispute_status directly via a
-- plain table update, as do several admin-side re-escalation paths
-- (admin_system_2_rest.sql, booking_annulled_reconcile.sql,
-- booking_completion_status_fix.sql, dispute_single_round.sql) — none of
-- them ever notified anyone except the other booking participant
-- ('booking_disputed'). A new dispute, or one re-escalated back to admin
-- review, was only ever discoverable by an admin manually checking
-- /admin/disputes.
--
-- A trigger (not a change to any one of those call sites) so this covers
-- every current and future path that makes this same transition, the same
-- reasoning already used for notify_on_dispute_message().
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create or replace function public.notify_admins_on_dispute_filed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dispute_status = 'under_admin_review' and old.dispute_status is distinct from 'under_admin_review' then
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, metadata, read)
      select u.id, null, 'dispute_message',
        'New dispute needs review',
        'A booking dispute was filed and needs admin review.',
        new.id, '{}'::jsonb, false
      from public.users u
      where u.role = 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_dispute_filed_notify on public.bookings;
create trigger bookings_dispute_filed_notify
  after update on public.bookings
  for each row execute function public.notify_admins_on_dispute_filed();
