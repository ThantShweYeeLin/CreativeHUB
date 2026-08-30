-- Step 1 of 2 for the admin system migration. Run this FILE BY ITSELF and
-- let it finish/commit before running admin_system_2_rest.sql — Postgres
-- refuses to use a new enum value in the same transaction that added it,
-- and a SQL editor that runs a pasted script as one transaction will hit
-- "unsafe use of new value" otherwise.

alter type user_role add value if not exists 'admin';
