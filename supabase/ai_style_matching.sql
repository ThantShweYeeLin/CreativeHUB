create extension if not exists vector;

alter table public.freelancer_profiles
  add column if not exists style_embedding vector(768);

-- Course-project scale (dozens of freelancers per category, not thousands) —
-- a plain sequential scan ordered by distance is fast enough without an
-- ivfflat index, which needs a minimum row count to train well. No index,
-- no background embedding jobs, no similarity cutoff — all unneeded
-- complexity/unvalidated guesses at this scale.

create or replace function public.match_freelancer_styles(
  query_embedding vector(768),
  match_category text,
  match_count int default 10
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  skills text[],
  styles text[],
  description text,
  similarity float
)
language sql stable
as $$
  select
    fp.id, fp.user_id, fp.title, fp.skills, fp.styles, fp.description,
    greatest(0, least(1, 1 - (fp.style_embedding <=> query_embedding))) as similarity
  from public.freelancer_profiles fp
  join public.users u on u.id = fp.user_id
  where fp.title = match_category
    and fp.style_embedding is not null
    and fp.is_available = true
    and fp.visibility is distinct from 'limited'
    and u.account_status = 'active'
  order by fp.style_embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50); -- don't trust the caller's count unbounded
$$;

-- Match the app's own access model (every route requires login via
-- ProtectedRoute) rather than leaving this callable by anon by default.
-- Postgres grants EXECUTE to PUBLIC on every new function unless revoked —
-- revoking from just `anon` isn't enough, since `anon` is implicitly a
-- member of PUBLIC and would still inherit that grant.
revoke execute on function public.match_freelancer_styles(vector(768), text, int) from public;
grant execute on function public.match_freelancer_styles(vector(768), text, int) to authenticated;
