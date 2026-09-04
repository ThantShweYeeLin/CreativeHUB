-- Tracks whether a freelancer's AI style embedding is up to date, so a
-- failed Gemini call is visible and retryable instead of silently leaving
-- that freelancer invisible to the AI Matcher. Safe to run multiple times.

alter table public.freelancer_profiles
  add column if not exists embedding_status text default 'pending'
    check (embedding_status in ('pending','processing','ready','failed')),
  add column if not exists embedding_updated_at timestamptz;

-- Backfill status for rows that already have (or already lack) an
-- embedding from before this column existed, so existing data starts in
-- an accurate state rather than everything defaulting to 'pending'.
update public.freelancer_profiles
  set embedding_status = case when style_embedding is not null then 'ready' else 'pending' end
  where embedding_status = 'pending';
