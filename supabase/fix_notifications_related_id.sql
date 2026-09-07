-- Fixes booking/request/payment notifications always having related_id = null,
-- which breaks notification click-through deep-linking (e.g. opening the right
-- request/booking) and the client-side actor-name resolution fallback that
-- looks up the related requests/bookings row via related_id.
--
-- Root cause: create_social_notification() only ever set
-- related_id = coalesce(notification_post_id, notification_comment_id).
-- dataService.ts's createNotification()/notifyEvent() never populate
-- notification_post_id/notification_comment_id for non-social notifications
-- (booking requests, counter offers, payments, etc.) — they only pass a
-- relatedId value that this RPC had no parameter to accept, so it was
-- silently discarded and related_id ended up null on every such row.
--
-- Fix: add an explicit notification_related_id parameter that takes priority
-- over the post/comment-derived value, so social notifications (likes,
-- comments, shares) keep working exactly as before while everything else can
-- now pass its own related_id through.

create or replace function public.create_social_notification(
  target_user_id uuid,
  actor_user_id uuid,
  notification_kind text,
  notification_title text,
  notification_message text,
  notification_post_id uuid default null,
  notification_comment_id uuid default null,
  notification_metadata jsonb default '{}'::jsonb,
  notification_related_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_user_id is null or target_user_id = actor_user_id then
    return;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    message,
    related_id,
    post_id,
    comment_id,
    metadata
  ) values (
    target_user_id,
    actor_user_id,
    notification_kind,
    notification_title,
    notification_message,
    coalesce(notification_related_id, notification_post_id, notification_comment_id),
    notification_post_id,
    notification_comment_id,
    notification_metadata
  );
end;
$$;

grant execute on function public.create_social_notification(uuid, uuid, text, text, text, uuid, uuid, jsonb, uuid) to anon, authenticated;
