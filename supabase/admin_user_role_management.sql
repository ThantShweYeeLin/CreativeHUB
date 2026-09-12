-- Adds the one RPC needed for "Promote to Admin" / "Change role" on the
-- new admin user-detail page. Follows the exact shape of the RPCs in
-- admin_system_2_rest.sql: security definer, self-checks is_admin(),
-- narrow single-purpose mutation, logs to admin_actions. Safe to re-run.
--
-- Two extra guards beyond a plain role write: an admin can't demote
-- themselves (would lock them out mid-action), and the platform can never
-- be left with zero admins (a chain of otherwise-legitimate individual
-- demotions could do this without either admin realizing it).

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text, p_reason text default null)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_target_role user_role;
  v_admin_count int;
  v_updated public.users;
begin
  if not public.is_admin(v_admin) then
    raise exception 'Not authorized';
  end if;
  if p_role not in ('client','freelancer','admin') then
    raise exception 'Invalid role';
  end if;
  if p_user_id = v_admin and p_role <> 'admin' then
    raise exception 'Admins cannot demote themselves';
  end if;

  select role into v_target_role from public.users where id = p_user_id;
  if v_target_role = 'admin' and p_role <> 'admin' then
    select count(*) into v_admin_count from public.users where role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'Cannot demote the last remaining admin';
    end if;
  end if;

  -- Role changes only ever touch users.role — freelancer_profiles and all
  -- booking/review/report history for this user are never modified here.
  -- Demoting a freelancer to client leaves their freelancer_profiles row
  -- (and everything referencing it) intact, so it's still there if they're
  -- promoted back later.
  update public.users set role = p_role::user_role where id = p_user_id returning * into v_updated;

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, details)
    values (v_admin, 'set_user_role', 'user', p_user_id, jsonb_build_object('role', p_role, 'reason', p_reason));

  return v_updated;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text, text) from public;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;
