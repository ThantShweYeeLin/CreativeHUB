-- Instagram-style message requests + block/report. Safe to run multiple
-- times (idempotent create/alter/policy statements throughout).

create table if not exists public.blocked_users (
  id uuid default uuid_generate_v4() primary key,
  blocker_id uuid references public.users on delete cascade not null,
  blocked_id uuid references public.users on delete cascade not null,
  created_at timestamptz default timezone('utc', now()) not null,
  unique(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users manage their own block list" ON public.blocked_users FOR ALL
    USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A blocked person is never told they're blocked, and can't read the
-- blocker's list — but the RLS policies below need to check "is there a
-- block between A and B, in either direction" without exposing the row
-- itself. security definer bypasses the SELECT-only-own-rows policy above
-- purely to answer that one boolean.
create or replace function public.is_blocked(user_a uuid, user_b uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create table if not exists public.message_reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.users on delete cascade not null,
  reported_user_id uuid references public.users on delete cascade not null,
  conversation_id uuid references public.conversations on delete set null,
  reason text,
  created_at timestamptz default timezone('utc', now()) not null
);

alter table public.message_reports enable row level security;

DO $$ BEGIN
  CREATE POLICY "Users file their own reports" ON public.message_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Reporters can see their own reports" ON public.message_reports FOR SELECT
    USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 'pending' = a message request awaiting the recipient's decision;
-- 'accepted' = a normal open thread (mutual follow at creation time, or the
-- recipient replied/accepted a request). Existing rows default to
-- 'accepted' so no currently-open conversation is retroactively turned
-- into a request.
alter table public.conversations
  add column if not exists status text not null default 'accepted' check (status in ('accepted', 'pending')),
  add column if not exists initiated_by uuid references public.users;

-- Block enforcement, defense in depth alongside the app-level checks in
-- DataService.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can create own conversations" ON public.conversations;
  CREATE POLICY "Users can create own conversations" ON public.conversations FOR INSERT
    WITH CHECK (
      (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
      AND NOT public.is_blocked(participant_1_id, participant_2_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No UPDATE policy on conversations exists in the tracked schema/rls_fixes
-- files (only SELECT/INSERT) yet sendMessage() has long updated
-- last_message_at on every send, and the request-accept flow below needs to
-- flip status - add it explicitly so both work reliably under RLS.
DO $$ BEGIN
  CREATE POLICY "Participants can update own conversations" ON public.conversations FOR UPDATE
    USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
    WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
  CREATE POLICY "Users can send messages" ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id AND NOT public.is_blocked(sender_id, recipient_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Clients can create requests" ON public.requests;
  CREATE POLICY "Clients can create requests" ON public.requests FOR INSERT
    WITH CHECK (auth.uid() = client_id AND NOT public.is_blocked(client_id, freelancer_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Hides a blocked person's posts from you and yours from them, at the read
-- layer directly — no app code changes needed anywhere client_posts is
-- queried.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Client posts are viewable by everyone" ON public.client_posts;
  CREATE POLICY "Client posts are viewable by everyone" ON public.client_posts FOR SELECT
    USING (is_published = true AND (auth.uid() IS NULL OR NOT public.is_blocked(auth.uid(), client_id)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
