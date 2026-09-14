-- The share-analytics table (client_post_shares) and its recording method
-- already exist (supabase/rls_fixes.sql) — this only adds which channel a
-- share used, so a future "how are people actually sharing" view is
-- possible without a second analytics system. Nullable so existing rows
-- (recorded before this column existed) stay valid.

alter table public.client_post_shares
  add column if not exists share_method text;

DO $$ BEGIN
  alter table public.client_post_shares
    add constraint client_post_shares_share_method_check
    check (share_method is null or share_method in ('copy_link', 'native', 'whatsapp', 'facebook', 'x'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
