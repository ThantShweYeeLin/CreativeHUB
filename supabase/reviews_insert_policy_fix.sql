-- Every SQL file in this repo (schema.sql, rls_fixes.sql) already defines
-- "Users can insert own reviews" as `with check (auth.uid() = reviewer_id)`,
-- which is correct and permissive. But testing a real review submission
-- against the live project failed with "new row violates row-level
-- security policy for table reviews" even for a client inserting a review
-- with their own auth.uid() as reviewer_id - meaning the live database's
-- actual policy has drifted from these files (most likely it was never
-- successfully created, e.g. an earlier run of one of those scripts errored
-- before reaching this statement). This drops and recreates it
-- unconditionally so it's guaranteed to exist correctly regardless of the
-- live project's current state. Safe to re-run.

drop policy if exists "Users can insert own reviews" on public.reviews;

create policy "Users can insert own reviews" on public.reviews
  for insert with check (auth.uid() = reviewer_id);
