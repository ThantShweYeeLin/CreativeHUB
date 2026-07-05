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

create table if not exists public.message_reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  reaction text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(message_id, user_id)
);

alter table if exists public.client_post_likes enable row level security;
alter table if exists public.client_post_comments enable row level security;
alter table if exists public.client_post_saves enable row level security;
alter table if exists public.client_post_shares enable row level security;
alter table if exists public.message_reactions enable row level security;

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

DO $$
BEGIN
  CREATE POLICY "Users can read message reactions"
    ON public.message_reactions
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_reactions.message_id
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can react as themselves"
    ON public.message_reactions
    FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_reactions.message_id
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own reactions"
    ON public.message_reactions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own reactions"
    ON public.message_reactions
    FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill safety: keep only one like row per (post_id, user_id) before adding unique index.
delete from public.client_post_likes a
using public.client_post_likes b
where a.post_id = b.post_id
  and a.user_id = b.user_id
  and a.ctid < b.ctid;

create unique index if not exists idx_client_post_likes_post_user_unique
  on public.client_post_likes(post_id, user_id);

create index if not exists idx_client_post_likes_post_id on public.client_post_likes(post_id);
create index if not exists idx_client_post_comments_post_id on public.client_post_comments(post_id);
create index if not exists idx_client_post_saves_post_id on public.client_post_saves(post_id);
create index if not exists idx_client_post_shares_post_id on public.client_post_shares(post_id);
create index if not exists idx_message_reactions_message_id on public.message_reactions(message_id);
create index if not exists idx_message_reactions_user_id on public.message_reactions(user_id);

-- Notifications policies and fallback RPC for legacy schemas
alter table if exists public.notifications enable row level security;

DO $$
BEGIN
  CREATE POLICY "Users see own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create or replace function public.create_app_notification(
  target_user_id uuid,
  notification_kind text,
  notification_title text,
  notification_message text default null,
  notification_related_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    related_id,
    read
  ) values (
    target_user_id,
    coalesce(notification_kind, 'system'),
    coalesce(notification_title, 'Notification'),
    notification_message,
    notification_related_id,
    false
  );
end;
$$;

grant execute on function public.create_app_notification(uuid, text, text, text, uuid) to anon, authenticated;

-- Group chat tables and policies
create table if not exists public.group_conversations (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  created_by uuid references public.users on delete set null,
  related_group_request_id text,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists idx_group_conversations_related_request
  on public.group_conversations(related_group_request_id)
  where related_group_request_id is not null;

create table if not exists public.group_conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.group_conversations on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  role text default 'member' not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(conversation_id, user_id)
);

create table if not exists public.group_messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.group_conversations on delete cascade not null,
  sender_id uuid references public.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table if exists public.group_conversations enable row level security;
alter table if exists public.group_conversation_members enable row level security;
alter table if exists public.group_messages enable row level security;

create or replace function public.is_group_conversation_member(
  target_conversation_id uuid,
  target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_conversation_members gcm
    where gcm.conversation_id = target_conversation_id
      and gcm.user_id = target_user_id
  );
$$;

create or replace function public.is_group_conversation_owner(
  target_conversation_id uuid,
  target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_conversations gc
    where gc.id = target_conversation_id
      and gc.created_by = target_user_id
  );
$$;

grant execute on function public.is_group_conversation_member(uuid, uuid) to anon, authenticated;
grant execute on function public.is_group_conversation_owner(uuid, uuid) to anon, authenticated;

drop policy if exists "Users can read group conversations they joined" on public.group_conversations;
drop policy if exists "Users can create group conversations" on public.group_conversations;
drop policy if exists "Users can read group members in joined conversations" on public.group_conversation_members;
drop policy if exists "Conversation owners can add members" on public.group_conversation_members;
drop policy if exists "Users can leave group conversation" on public.group_conversation_members;
drop policy if exists "Users can read group messages in joined conversations" on public.group_messages;
drop policy if exists "Users can send group messages in joined conversations" on public.group_messages;

DO $$
BEGIN
  CREATE POLICY "Users can read group conversations they joined"
    ON public.group_conversations
    FOR SELECT
    USING (
      auth.uid() = created_by
      OR public.is_group_conversation_member(group_conversations.id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can create group conversations"
    ON public.group_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can read group members in joined conversations"
    ON public.group_conversation_members
    FOR SELECT
    USING (
      auth.uid() = user_id
      OR public.is_group_conversation_owner(group_conversation_members.conversation_id, auth.uid())
      OR public.is_group_conversation_member(group_conversation_members.conversation_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Conversation owners can add members"
    ON public.group_conversation_members
    FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      OR public.is_group_conversation_owner(group_conversation_members.conversation_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can leave group conversation"
    ON public.group_conversation_members
    FOR DELETE
    USING (
      auth.uid() = user_id
      OR public.is_group_conversation_owner(group_conversation_members.conversation_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can read group messages in joined conversations"
    ON public.group_messages
    FOR SELECT
    USING (
      public.is_group_conversation_owner(group_messages.conversation_id, auth.uid())
      OR public.is_group_conversation_member(group_messages.conversation_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can send group messages in joined conversations"
    ON public.group_messages
    FOR INSERT
    WITH CHECK (
      auth.uid() = sender_id
      AND (
        public.is_group_conversation_owner(group_messages.conversation_id, auth.uid())
        OR public.is_group_conversation_member(group_messages.conversation_id, auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create index if not exists idx_group_members_conversation_id on public.group_conversation_members(conversation_id);
create index if not exists idx_group_members_user_id on public.group_conversation_members(user_id);
create index if not exists idx_group_messages_conversation_id on public.group_messages(conversation_id);
create index if not exists idx_group_messages_sender_id on public.group_messages(sender_id);
