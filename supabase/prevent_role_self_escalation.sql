-- CRITICAL SECURITY FIX: "Users can update own record" (schema.sql) is
-- `for update using (auth.uid() = id)` with no WITH CHECK — it restricts
-- WHICH ROW a user can update, not WHICH COLUMNS or VALUES. Every admin
-- gate built on top of users.role (is_admin(), AdminRoute, every admin RPC's
-- own self-check) assumes that column is trustworthy, but nothing has ever
-- stopped any signed-up client or freelancer from running
-- `supabase.from('users').update({ role: 'admin' }).eq('id', myOwnId)`
-- directly from the browser and granting themselves full admin access.
-- Verified exploitable against the live database before writing this fix.
--
-- The fix can't just be "block all changes to role/account_status", because
-- two legitimate self-service flows already write these columns directly
-- from the client on the user's own row:
--   - BecomeFreelancerPage.tsx sets role: 'freelancer' when a client
--     upgrades to freelancer (DataService.updateUser -> plain UPDATE).
--   - SettingsPage.tsx toggles account_status between 'active' and
--     'paused' as a "pause my profile" feature (same path).
-- So this trigger allows exactly those legitimate transitions and blocks
-- everything else:
--   - role: client <-> freelancer stays allowed for a non-privileged
--     write; anything touching 'admin' (becoming it, or an admin's own
--     role being changed away from it) is reverted to the prior value.
--   - account_status: active <-> paused stays allowed; a row already
--     suspended/banned can't be changed by the user themselves (no
--     self-unsuspending), and a non-privileged write can never set
--     suspended/banned in the first place.
--
-- This only restricts writes coming through the normal authenticated/anon
-- PostgREST roles. The existing admin_set_user_role/admin_set_account_status
-- RPCs are `security definer` and execute as their owner (not as
-- 'authenticated'/'anon'), so current_user inside this trigger reflects
-- that owner during their execution and every legitimate admin action
-- continues to work unaffected.

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if NEW.role is distinct from OLD.role and (NEW.role = 'admin' or OLD.role = 'admin') then
      NEW.role := OLD.role;
    end if;

    if OLD.account_status in ('suspended', 'banned') then
      NEW.account_status := OLD.account_status;
    elsif NEW.account_status is distinct from OLD.account_status and NEW.account_status not in ('active', 'paused') then
      NEW.account_status := OLD.account_status;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists prevent_role_self_escalation_trigger on public.users;
create trigger prevent_role_self_escalation_trigger
  before update on public.users
  for each row
  execute function public.prevent_role_self_escalation();
