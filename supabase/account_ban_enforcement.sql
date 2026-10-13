-- account_status already includes 'banned' (admin_system_2_rest.sql) and
-- admin_set_account_status() already requires an admin, records a reason,
-- and writes to admin_actions - but nothing has ever actually enforced a
-- ban anywhere: it's a status value with zero real effect. A banned user
-- could still send messages, create requests, apply to Open Group
-- Requests, edit their profile, etc. - exactly as freely as an active one.
--
-- This is the database-level half of fixing that (see also the server's
-- new POST /admin/ban route, which bans the account at the Supabase Auth
-- layer itself so a banned user can't even log back in, and
-- AuthContext.tsx's client-side check for an already-open session).
-- Blocking only in the UI was explicitly the wrong approach here - this is
-- the backstop that holds even against a direct API/RPC call.
--
-- Two new columns on users let a banned user see their OWN reason/date
-- (admin_actions is admin-only readable, so without this they'd see
-- nothing explaining why) - populated by admin_set_account_status()
-- whenever it sets 'banned', left alone on every other status.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

alter table public.users
  add column if not exists account_status_reason text,
  add column if not exists account_status_changed_at timestamptz;

create or replace function public.is_banned(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = uid and account_status = 'banned');
$$;

revoke all on function public.is_banned(uuid) from public;
grant execute on function public.is_banned(uuid) to authenticated, service_role;

-- One reusable trigger function, attached to every table a banned user
-- could otherwise still write to. It only ever checks the ACTING user
-- (auth.uid()) - never a row's own client_id/freelancer_id/etc - so an
-- admin or any other non-banned participant updating a shared row (e.g.
-- resolving a dispute on a booking whose other party is banned) is
-- completely unaffected.
-- NOTE: account_suspension_enforcement.sql later redeclares this same
-- function (via create or replace) to also block suspended accounts.
-- Because both files use create or replace, whichever one is run LAST
-- wins outright - re-running this file after the suspension file has
-- already run would silently drop suspension enforcement with no error
-- (this happened once in practice). The guarded is_suspended() call below
-- makes this file's own definition converge to the same combined
-- behavior on its own, so re-running either file in any order never
-- regresses the other. The exception handler only exists for a fresh
-- database where this file runs before account_suspension_enforcement.sql
-- has ever been applied, in which case is_suspended() doesn't exist yet.
create or replace function public.block_if_banned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_banned(auth.uid()) then
    raise exception 'Your account has been banned. Contact CreativeHUB support for help with any existing bookings.';
  end if;

  begin
    if public.is_suspended(auth.uid()) then
      raise exception 'Your account is temporarily suspended. You cannot perform this action while your suspension is active.';
    end if;
  exception when undefined_function then
    null;
  end;

  return new;
end;
$$;

-- "Create or accept booking requests"
drop trigger if exists block_banned_requests_insert on public.requests;
create trigger block_banned_requests_insert
  before insert on public.requests
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_bookings_write on public.bookings;
create trigger block_banned_bookings_write
  before insert or update on public.bookings
  for each row execute function public.block_if_banned();

-- "Send messages"
drop trigger if exists block_banned_messages_insert on public.messages;
create trigger block_banned_messages_insert
  before insert on public.messages
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_conversations_write on public.conversations;
create trigger block_banned_conversations_write
  before insert or update on public.conversations
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_group_messages_insert on public.group_messages;
create trigger block_banned_group_messages_insert
  before insert on public.group_messages
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_group_conversations_insert on public.group_conversations;
create trigger block_banned_group_conversations_insert
  before insert on public.group_conversations
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_group_members_insert on public.group_conversation_members;
create trigger block_banned_group_members_insert
  before insert on public.group_conversation_members
  for each row execute function public.block_if_banned();

-- "Apply to Open Group Requests" / create one as a client
drop trigger if exists block_banned_group_opportunities_insert on public.group_opportunities;
create trigger block_banned_group_opportunities_insert
  before insert on public.group_opportunities
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_group_applications_insert on public.group_opportunity_applications;
create trigger block_banned_group_applications_insert
  before insert on public.group_opportunity_applications
  for each row execute function public.block_if_banned();

-- "Edit profile or publish portfolio"
drop trigger if exists block_banned_freelancer_profiles_update on public.freelancer_profiles;
create trigger block_banned_freelancer_profiles_update
  before update on public.freelancer_profiles
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_users_update on public.users;
create trigger block_banned_users_update
  before update on public.users
  for each row execute function public.block_if_banned();

drop trigger if exists block_banned_posts_insert on public.client_posts;
create trigger block_banned_posts_insert
  before insert on public.client_posts
  for each row execute function public.block_if_banned();

-- Re-declared in full (admin_system_2_rest.sql has the original) - the only
-- change is writing account_status_reason/account_status_changed_at
-- alongside account_status itself, so the user whose status this changes
-- can see their own reason (admin_actions, where the reason already lived,
-- is admin-only readable). Left populated (not cleared) on reactivation -
-- it's the record of the most recent status change either way, same as
-- admin_actions already keeps every change in its own history.
create or replace function public.admin_set_account_status(p_user_id uuid, p_status text, p_reason text default null)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_updated public.users;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('active','paused','suspended','banned') then
    raise exception 'Invalid status';
  end if;

  update public.users
    set account_status = p_status,
        account_status_reason = p_reason,
        account_status_changed_at = timezone('utc', now())
    where id = p_user_id
    returning * into v_updated;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'set_account_status', 'user', p_user_id, jsonb_build_object('status', p_status, 'reason', p_reason));

  return v_updated;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text, text) from public;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
