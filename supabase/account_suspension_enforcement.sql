-- account_suspension_enforcement.sql
--
-- Differentiates temporary account suspension from permanent account banning.
--
-- 1. Adds suspension tracking columns to public.users:
--    - suspension_reason text
--    - suspended_at timestamptz
--    - suspension_expires_at timestamptz (null = until manual review)
--    - suspended_by uuid references public.users(id)
--
-- 2. Creates public.check_and_lift_expired_suspension(p_user_id uuid):
--    - Restores an expired suspension back to 'active' automatically
--    - GUARANTEED: NEVER reactivates a banned account.
--
-- 3. Creates public.is_suspended(uid uuid):
--    - Evaluates whether a user is currently suspended (not expired).
--
-- 4. Updates public.block_if_banned():
--    - Enforces that both banned and currently suspended accounts are blocked
--      from creating requests, bookings, messages, conversations, posts, etc.
--
-- 5. Updates public.ad min_set_account_status():
--    - Accepts an optional expiration timestamp p_expires_at for suspensions
--    - Populates suspension columns when status is 'suspended'
--    - Clears suspension columns when status is reinstated to 'active'
--    - Sends in-app notifications to the user for suspension and reactivation.
--
-- 6. Updates public.admin_resolve_user_report():
--    - Properly records account_status_reason, account_status_changed_at, and
--      suspension columns instead of a bare UPDATE that bypassed audit tracking.
--
-- Run this AFTER supabase/account_ban_enforcement.sql - block_if_banned()
-- below calls public.is_banned(), which that file creates; running this
-- one first fails with "function is_banned does not exist". Also
-- re-declares (not re-creates) admin_set_account_status()/
-- admin_resolve_user_report() with an extra p_expires_at parameter -
-- Postgres treats a different argument count as a distinct overload
-- rather than replacing the original, so the 3-argument versions from
-- account_ban_enforcement.sql/admin_system_2_rest.sql are left behind,
-- unused but harmless (PostgREST/supabase-js resolve by named arguments,
-- so callers passing p_expires_at always reach this version).

alter table public.users
  add column if not exists suspension_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_expires_at timestamptz,
  add column if not exists suspended_by uuid references public.users(id);

-- Safely lifts an expired suspension if and only if account_status is 'suspended'
-- and suspension_expires_at <= now(). Will NEVER reactivate a banned account.
create or replace function public.check_and_lift_expired_suspension(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expires_at timestamptz;
begin
  select account_status, suspension_expires_at
    into v_status, v_expires_at
    from public.users
    where id = p_user_id;

  if v_status = 'suspended' and v_expires_at is not null and v_expires_at <= timezone('utc', now()) then
    update public.users
      set account_status = 'active',
          account_status_reason = 'Suspension period expired',
          account_status_changed_at = timezone('utc', now()),
          suspension_reason = null,
          suspended_at = null,
          suspension_expires_at = null,
          suspended_by = null
      where id = p_user_id;

    insert into public.notifications (user_id, type, title, message, related_id, read)
      values (
        p_user_id, 'account_reactivated',
        'Suspension ended',
        'Your temporary suspension period has concluded. You now have full access to CreativeHUB.',
        p_user_id, false
      );

    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.check_and_lift_expired_suspension(uuid) from public;
grant execute on function public.check_and_lift_expired_suspension(uuid) to authenticated, service_role;

-- Checks if a user is currently suspended. If an expiration date has passed,
-- it auto-lifts the suspension and returns false.
create or replace function public.is_suspended(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expires_at timestamptz;
begin
  if uid is null then
    return false;
  end if;

  select account_status, suspension_expires_at
    into v_status, v_expires_at
    from public.users
    where id = uid;

  if coalesce(v_status, '') != 'suspended' then
    return false;
  end if;

  if v_expires_at is not null and v_expires_at <= timezone('utc', now()) then
    perform public.check_and_lift_expired_suspension(uid);
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.is_suspended(uuid) from public;
grant execute on function public.is_suspended(uuid) to authenticated, service_role;

-- Update trigger function to block BOTH banned and active-suspended users
-- from restricted marketplace writes.
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
  if public.is_suspended(auth.uid()) then
    raise exception 'Your account is temporarily suspended. You cannot perform this action while your suspension is active.';
  end if;
  return new;
end;
$$;

-- Enhanced admin_set_account_status with duration/expiry support and notifications
create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text default null,
  p_expires_at timestamptz default null
)
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

  if p_status = 'suspended' then
    update public.users
      set account_status = p_status,
          account_status_reason = p_reason,
          account_status_changed_at = timezone('utc', now()),
          suspension_reason = p_reason,
          suspended_at = timezone('utc', now()),
          suspension_expires_at = p_expires_at,
          suspended_by = v_admin
      where id = p_user_id
      returning * into v_updated;
  elsif p_status = 'active' then
    update public.users
      set account_status = p_status,
          account_status_reason = p_reason,
          account_status_changed_at = timezone('utc', now()),
          suspension_reason = null,
          suspended_at = null,
          suspension_expires_at = null,
          suspended_by = null
      where id = p_user_id
      returning * into v_updated;
  else
    update public.users
      set account_status = p_status,
          account_status_reason = p_reason,
          account_status_changed_at = timezone('utc', now())
      where id = p_user_id
      returning * into v_updated;
  end if;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'set_account_status', 'user', p_user_id, jsonb_build_object(
      'status', p_status,
      'reason', p_reason,
      'expires_at', p_expires_at
    ));

  if p_status = 'suspended' then
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
      values (
        p_user_id, v_admin, 'account_suspended',
        'Account temporarily suspended',
        coalesce(
          case
            when p_expires_at is not null then
              'Your account has been temporarily suspended until ' || to_char(p_expires_at, 'YYYY-MM-DD HH24:MI') || ' UTC.'
            else
              'Your account has been temporarily suspended pending administrative review.'
          end,
          'Your account has been temporarily suspended.'
        ),
        p_user_id, false
      );
  elsif p_status = 'active' then
    insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
      values (
        p_user_id, v_admin, 'account_reactivated',
        'Account reinstated',
        'Your CreativeHUB account has been reinstated. You can now use all platform features.',
        p_user_id, false
      );
  end if;

  return v_updated;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text, text, timestamptz) from public;
grant execute on function public.admin_set_account_status(uuid, text, text, timestamptz) to authenticated;

-- Enhanced admin_resolve_user_report fixing the direct UPDATE bypass
create or replace function public.admin_resolve_user_report(
  p_report_id uuid,
  p_decision text,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.user_reports;
  v_updated public.user_reports;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('no_action','warning','suspended','banned') then
    raise exception 'Invalid decision';
  end if;

  select * into v_report from public.user_reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  update public.user_reports
    set status = 'resolved', decision = p_decision, decision_reason = p_reason,
        resolved_by = v_admin, resolved_at = timezone('utc', now())
    where id = p_report_id
    returning * into v_updated;

  if p_decision = 'suspended' then
    update public.users
      set account_status = 'suspended',
          account_status_reason = coalesce(p_reason, 'Account suspended following report review'),
          account_status_changed_at = timezone('utc', now()),
          suspension_reason = coalesce(p_reason, 'Account suspended following report review'),
          suspended_at = timezone('utc', now()),
          suspension_expires_at = p_expires_at,
          suspended_by = v_admin
      where id = v_report.reported_user_id;
  elsif p_decision = 'banned' then
    update public.users
      set account_status = 'banned',
          account_status_reason = coalesce(p_reason, 'Account banned following report review'),
          account_status_changed_at = timezone('utc', now())
      where id = v_report.reported_user_id;
  end if;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'resolve_user_report', 'report', p_report_id, jsonb_build_object(
      'decision', p_decision,
      'reason', p_reason,
      'expires_at', p_expires_at
    ));

  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read)
    values (
      v_report.reported_user_id, v_admin, 'admin_report_decision',
      'Report reviewed',
      case p_decision
        when 'no_action' then 'A report against you was reviewed - no action was taken.'
        when 'warning' then 'A report against you was reviewed. This is a warning - please review our community guidelines.'
        when 'suspended' then
          case
            when p_expires_at is not null then
              'Your account has been temporarily suspended until ' || to_char(p_expires_at, 'YYYY-MM-DD HH24:MI') || ' UTC following a report review.'
            else
              'Your account has been temporarily suspended following a report review.'
          end
        when 'banned' then 'Your account has been banned following a report review.'
      end,
      p_report_id, false
    );

  return v_updated;
end;
$$;

revoke all on function public.admin_resolve_user_report(uuid, text, text, timestamptz) from public;
grant execute on function public.admin_resolve_user_report(uuid, text, text, timestamptz) to authenticated;
