-- CreativeHUB RLS Fixes
-- Run this in Supabase SQL editor for existing projects.

alter table if exists public.favorites enable row level security;
alter table if exists public.requests enable row level security;
alter table if exists public.freelancer_profiles enable row level security;
alter table if exists public.conversations enable row level security;

-- Freelancer profiles policies
DO $$
BEGIN
  CREATE POLICY "Users can create own freelancer profile"
    ON public.freelancer_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER POLICY "Users can update own freelancer profile"
    ON public.freelancer_profiles
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Favorites policies
DO $$
BEGIN
  CREATE POLICY "Users can view own favorites"
    ON public.favorites
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own favorites"
    ON public.favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own favorites"
    ON public.favorites
    FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Requests policies
DO $$
BEGIN
  CREATE POLICY "Users see own requests"
    ON public.requests
    FOR SELECT
    USING (auth.uid() = client_id OR auth.uid() = freelancer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Clients can create requests"
    ON public.requests
    FOR INSERT
    WITH CHECK (auth.uid() = client_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Participants can update requests"
    ON public.requests
    FOR UPDATE
    USING (auth.uid() = client_id OR auth.uid() = freelancer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reviews policies
DO $$
BEGIN
  CREATE POLICY "Users can view own related reviews"
    ON public.reviews
    FOR SELECT
    USING (auth.uid() = reviewer_id OR auth.uid() = reviewee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conversations policies
DO $$
BEGIN
  CREATE POLICY "Users can view own conversations"
    ON public.conversations
    FOR SELECT
    USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can create own conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own reviews"
    ON public.reviews
    FOR INSERT
    WITH CHECK (auth.uid() = reviewer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client post engagement tables
create table if not exists public.client_post_likes (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.client_posts on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, user_id)
);

create table if not exists public.client_post_comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.client_posts on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.client_post_saves (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.client_posts on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, user_id)
);

create table if not exists public.client_post_shares (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.client_posts on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table if exists public.client_post_likes enable row level security;
alter table if exists public.client_post_comments enable row level security;
alter table if exists public.client_post_saves enable row level security;
alter table if exists public.client_post_shares enable row level security;

DO $$
BEGIN
  CREATE POLICY "Users can read client post likes"
    ON public.client_post_likes
    FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can like as themselves"
    ON public.client_post_likes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can unlike as themselves"
    ON public.client_post_likes
    FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can read client post comments"
    ON public.client_post_comments
    FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can comment as themselves"
    ON public.client_post_comments
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can read client post saves"
    ON public.client_post_saves
    FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can save as themselves"
    ON public.client_post_saves
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can unsave as themselves"
    ON public.client_post_saves
    FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can read client post shares"
    ON public.client_post_shares
    FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can share as themselves"
    ON public.client_post_shares
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER POLICY "Users can share as themselves"
    ON public.client_post_shares
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

create index if not exists idx_client_post_likes_post_id on public.client_post_likes(post_id);
create index if not exists idx_client_post_comments_post_id on public.client_post_comments(post_id);
create index if not exists idx_client_post_saves_post_id on public.client_post_saves(post_id);
create index if not exists idx_client_post_shares_post_id on public.client_post_shares(post_id);
