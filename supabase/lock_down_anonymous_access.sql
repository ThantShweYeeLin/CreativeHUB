-- Makes the Supabase API unusable without a signed-in session.
--
-- Problem found by probing the API with only the public anon key (which
-- ships in the frontend bundle, so anyone can extract it): 15 tables
-- returned real rows to a completely unauthenticated caller - including
-- public.users (every account's profile row) - and get_platform_stats()
-- plus several helper RPCs were executable by `anon`. The old policies
-- (`for select using (true)`, "... viewable by everyone") apply to the
-- default `public` role, which includes anon.
--
-- This migration is deliberately written against whatever policies
-- ACTUALLY exist in the live database (loop over pg_policies) rather than
-- naming them, since the live schema has drifted from the committed
-- migration files. Signed-in behaviour is unchanged: every policy keeps its
-- exact USING / WITH CHECK expression, it just stops applying to anon.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

-- 1) Re-scope every policy that currently applies to anon (directly, or via
--    the default `public` role) so it only applies to signed-in users.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles && ARRAY['public', 'anon']::name[])
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 2) Defence in depth: even a policy someone adds later by mistake can't
--    expose data, because anon no longer has table privileges at all.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- 3) RPCs: Postgres grants EXECUTE to PUBLIC by default, which includes
--    anon, and a few migrations granted it to anon explicitly
--    (get_platform_stats, create_social_notification, create_app_notification,
--    accept_friend_request, is_group_conversation_*). Only functions anon can
--    currently run are touched: they're re-scoped to signed-in users (and
--    the service role), so anonymous callers get "permission denied" while
--    every function stays exactly as reachable as before for a session.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.sig);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped % (owned by an extension)', fn.sig;
    END;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
