-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable ENUM types
create type user_role as enum ('freelancer', 'client');
create type request_status as enum ('pending', 'accepted', 'rejected', 'completed');
create type booking_status as enum ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Users table (extends Supabase auth)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  cover_url text,
  bio text,
  role user_role default 'client',
  location text,
  rating numeric(3,2) default 0,
  total_reviews int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Freelancer profiles
create table public.freelancer_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid unique references public.users on delete cascade not null,
  title text,
  description text,
  hourly_rate numeric(10,2),
  skills text[] default array[]::text[],
  styles text[] default array[]::text[],
  experience_years int,
  portfolio_count int default 0,
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Portfolio items
create table public.portfolios (
  id uuid default uuid_generate_v4() primary key,
  freelancer_id uuid references public.freelancer_profiles on delete cascade not null,
  title text not null,
  description text,
  image_urls text[] default array[]::text[],
  project_url text,
  tools_used text[] default array[]::text[],
  featured boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bookings/Orders
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.users on delete cascade not null,
  freelancer_id uuid references public.users on delete cascade not null,
  project_name text not null,
  description text,
  budget numeric(10,2) not null,
  status booking_status default 'pending',
  start_date date,
  end_date date,
  deliverables text,
  payment_status text default 'unpaid',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Requests/Proposals
create table public.requests (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.users on delete cascade not null,
  freelancer_id uuid references public.users on delete cascade not null,
  project_name text not null,
  description text,
  budget numeric(10,2),
  status request_status default 'pending',
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Messages
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid not null,
  sender_id uuid references public.users on delete cascade not null,
  recipient_id uuid references public.users on delete cascade not null,
  content text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Conversations (for grouping messages)
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  participant_1_id uuid references public.users on delete cascade not null,
  participant_2_id uuid references public.users on delete cascade not null,
  last_message_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(participant_1_id, participant_2_id)
);

-- Favorites/Likes
create table public.favorites (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  freelancer_id uuid references public.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, freelancer_id)
);

-- Reviews
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  reviewer_id uuid references public.users on delete cascade not null,
  reviewee_id uuid references public.users on delete cascade not null,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notifications
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  type text not null,
  title text not null,
  message text,
  related_id uuid,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.users enable row level security;
alter table public.freelancer_profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.bookings enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- RLS Policies
-- Users: public read, own write
create policy "Users are viewable by everyone" on public.users
  for select using (true);

create policy "Users can update own record" on public.users
  for update using (auth.uid() = id);

-- Freelancer profiles: public read
create policy "Freelancer profiles are viewable by everyone" on public.freelancer_profiles
  for select using (true);

create policy "Users can update own freelancer profile" on public.freelancer_profiles
  for update using (auth.uid() = user_id);

-- Portfolios: public read
create policy "Portfolios are viewable by everyone" on public.portfolios
  for select using (true);

create policy "Freelancers can manage own portfolios" on public.portfolios
  for all using (auth.uid() in (select user_id from public.freelancer_profiles where id = freelancer_id));

-- Bookings: users see their own
create policy "Users see own bookings" on public.bookings
  for select using (auth.uid() = client_id or auth.uid() = freelancer_id);

create policy "Users can insert own bookings" on public.bookings
  for insert with check (auth.uid() = client_id);

create policy "Users can update own bookings" on public.bookings
  for update using (auth.uid() = client_id or auth.uid() = freelancer_id);

-- Messages: participants only
create policy "Users see own messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Notifications: users see own
create policy "Users see own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- Indexes for performance
create index idx_freelancer_profiles_user_id on public.freelancer_profiles(user_id);
create index idx_portfolios_freelancer_id on public.portfolios(freelancer_id);
create index idx_bookings_client_id on public.bookings(client_id);
create index idx_bookings_freelancer_id on public.bookings(freelancer_id);
create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_messages_sender_id on public.messages(sender_id);
create index idx_conversations_participant_ids on public.conversations(participant_1_id, participant_2_id);
create index idx_favorites_user_id on public.favorites(user_id);
create index idx_reviews_booking_id on public.reviews(booking_id);
create index idx_notifications_user_id on public.notifications(user_id);

-- insert policy for users to create their own profile upon sign up --
create policy "Users can insert own record" 
  on public.users
  for insert
  with check (auth.uid() = id);

<<<<<<< HEAD
-- Storage bucket for profile pictures and profile backgrounds
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

create policy "Avatar files are publicly viewable"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar files"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own avatar files"
  on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
=======
-- CreativeHUB For You social feed
do $$
begin
  create type public.creative_profession as enum (
    'Fashion Designer',
    'Photographer',
    'Videographer',
    'Model',
    'Makeup Artist',
    'Graphic Designer',
    'Illustrator',
    'Stylist',
    'Architect',
    'Creative Director'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.post_media_type as enum ('image', 'video');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.share_target as enum ('creativehub', 'copy_link', 'whatsapp', 'telegram', 'facebook', 'x');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_type as enum ('like', 'comment', 'follow', 'share', 'mention');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  avatar_url text,
  bio text,
  profession public.creative_profession not null,
  is_pro boolean default false not null,
  is_verified boolean default false not null,
  profile_views int default 0 not null check (profile_views >= 0),
  follower_count int default 0 not null check (follower_count >= 0),
  following_count int default 0 not null check (following_count >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.posts (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.profiles on delete cascade not null,
  caption text default '' not null,
  likes_count int default 0 not null check (likes_count >= 0),
  comments_count int default 0 not null check (comments_count >= 0),
  shares_count int default 0 not null check (shares_count >= 0),
  saves_count int default 0 not null check (saves_count >= 0),
  profile_views_snapshot int default 0 not null check (profile_views_snapshot >= 0),
  engagement_score numeric generated always as (
    (likes_count * 1) +
    (comments_count * 3) +
    (shares_count * 5) +
    (saves_count * 4) +
    (profile_views_snapshot * 0.2)
  ) stored,
  is_trending boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.post_media (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts on delete cascade not null,
  media_type public.post_media_type not null,
  url text not null,
  thumbnail_url text,
  alt_text text,
  position int default 0 not null check (position >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, position)
);

create table if not exists public.post_likes (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  parent_id uuid references public.post_comments on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2200),
  mentions text[] default array[]::text[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.post_shares (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  target public.share_target not null,
  recipient_id uuid references public.profiles on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.save_collections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name)
);

create table if not exists public.saved_posts (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  collection_id uuid references public.save_collections on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, user_id, collection_id)
);

create table if not exists public.followers (
  id uuid default uuid_generate_v4() primary key,
  follower_id uuid references public.profiles on delete cascade not null,
  following_id uuid references public.profiles on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.notifications
  add column if not exists actor_id uuid references public.profiles on delete set null,
  add column if not exists post_id uuid references public.posts on delete cascade,
  add column if not exists comment_id uuid references public.post_comments on delete cascade,
  add column if not exists metadata jsonb default '{}'::jsonb not null;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_shares enable row level security;
alter table public.save_collections enable row level security;
alter table public.saved_posts enable row level security;
alter table public.followers enable row level security;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Posts are public" on public.posts for select using (true);
create policy "Creators manage own posts" on public.posts for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "Post media is public" on public.post_media for select using (true);
create policy "Creators manage own post media" on public.post_media
  for all using (auth.uid() in (select author_id from public.posts where id = post_id))
  with check (auth.uid() in (select author_id from public.posts where id = post_id));

create policy "Likes are visible" on public.post_likes for select using (true);
create policy "Users like as themselves" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "Users remove own likes" on public.post_likes for delete using (auth.uid() = user_id);

create policy "Comments are visible" on public.post_comments for select using (true);
create policy "Users comment as themselves" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "Users update own comments" on public.post_comments for update using (auth.uid() = user_id);
create policy "Users delete own comments" on public.post_comments for delete using (auth.uid() = user_id);

create policy "Shares are visible to owner" on public.post_shares for select using (auth.uid() = user_id);
create policy "Users share as themselves" on public.post_shares for insert with check (auth.uid() = user_id);

create policy "Users manage own collections" on public.save_collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own saved posts" on public.saved_posts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Follows are visible" on public.followers for select using (true);
create policy "Users follow as themselves" on public.followers for insert with check (auth.uid() = follower_id);
create policy "Users unfollow as themselves" on public.followers for delete using (auth.uid() = follower_id);

create index if not exists idx_posts_for_you_rank on public.posts(engagement_score desc, created_at desc, id desc);
create index if not exists idx_posts_author_id on public.posts(author_id);
create index if not exists idx_post_media_post_id_position on public.post_media(post_id, position);
create index if not exists idx_post_likes_post_user on public.post_likes(post_id, user_id);
create index if not exists idx_post_comments_post_parent_created on public.post_comments(post_id, parent_id, created_at);
create index if not exists idx_post_shares_post_id on public.post_shares(post_id);
create index if not exists idx_saved_posts_user_post on public.saved_posts(user_id, post_id);
create unique index if not exists idx_saved_posts_default_unique on public.saved_posts(post_id, user_id) where collection_id is null;
create index if not exists idx_followers_following on public.followers(following_id);
create index if not exists idx_followers_follower on public.followers(follower_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.extract_mentions(value text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct lower(match[1])), array[]::text[])
  from regexp_matches(value, '@([a-zA-Z0-9_]{3,30})', 'g') as match;
$$;

create or replace function public.create_social_notification(
  target_user_id uuid,
  actor_user_id uuid,
  notification_kind text,
  notification_title text,
  notification_message text,
  notification_post_id uuid default null,
  notification_comment_id uuid default null,
  notification_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_user_id is null or target_user_id = actor_user_id then
    return;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    message,
    related_id,
    post_id,
    comment_id,
    metadata
  ) values (
    target_user_id,
    actor_user_id,
    notification_kind,
    notification_title,
    notification_message,
    coalesce(notification_post_id, notification_comment_id),
    notification_post_id,
    notification_comment_id,
    notification_metadata
  );
end;
$$;

create or replace function public.handle_post_like_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  actor_name text;
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id returning author_id into owner_id;
    select full_name into actor_name from public.profiles where id = new.user_id;
    perform public.create_social_notification(owner_id, new.user_id, 'like', 'New like', coalesce(actor_name, 'Someone') || ' liked your post.', new.post_id);
    return new;
  end if;

  update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create or replace function public.set_comment_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.mentions := public.extract_mentions(new.body);
  return new;
end;
$$;

create or replace function public.handle_post_comment_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  actor_name text;
  mentioned_user record;
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id returning author_id into owner_id;
    select full_name into actor_name from public.profiles where id = new.user_id;
    perform public.create_social_notification(owner_id, new.user_id, 'comment', 'New comment', coalesce(actor_name, 'Someone') || ' commented on your post.', new.post_id, new.id);

    for mentioned_user in
      select id from public.profiles where lower(username) = any(new.mentions)
    loop
      perform public.create_social_notification(mentioned_user.id, new.user_id, 'mention', 'You were mentioned', coalesce(actor_name, 'Someone') || ' mentioned you in a comment.', new.post_id, new.id);
    end loop;
    return new;
  end if;

  update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create or replace function public.handle_post_share_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  actor_name text;
begin
  update public.posts set shares_count = shares_count + 1 where id = new.post_id returning author_id into owner_id;
  select full_name into actor_name from public.profiles where id = new.user_id;
  perform public.create_social_notification(owner_id, new.user_id, 'share', 'Post shared', coalesce(actor_name, 'Someone') || ' shared your post.', new.post_id, null, jsonb_build_object('target', new.target));
  return new;
end;
$$;

create or replace function public.handle_saved_post_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.saved_posts where post_id = new.post_id and user_id = new.user_id) = 1 then
      update public.posts set saves_count = saves_count + 1 where id = new.post_id;
    end if;
    return new;
  end if;

  if not exists (select 1 from public.saved_posts where post_id = old.post_id and user_id = old.user_id) then
    update public.posts set saves_count = greatest(saves_count - 1, 0) where id = old.post_id;
  end if;
  return old;
end;
$$;

create or replace function public.handle_follow_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    select full_name into actor_name from public.profiles where id = new.follower_id;
    perform public.create_social_notification(new.following_id, new.follower_id, 'follow', 'New follower', coalesce(actor_name, 'Someone') || ' followed you.');
    return new;
  end if;

  update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
  update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  return old;
end;
$$;

create or replace function public.sync_post_profile_views()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.posts set profile_views_snapshot = new.profile_views where author_id = new.id;
  return new;
end;
$$;

create or replace trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create or replace trigger posts_touch_updated_at before update on public.posts for each row execute function public.touch_updated_at();
create or replace trigger comments_touch_updated_at before update on public.post_comments for each row execute function public.touch_updated_at();
create or replace trigger collections_touch_updated_at before update on public.save_collections for each row execute function public.touch_updated_at();
create or replace trigger post_like_counts after insert or delete on public.post_likes for each row execute function public.handle_post_like_counts();
create or replace trigger post_comment_mentions before insert or update on public.post_comments for each row execute function public.set_comment_mentions();
create or replace trigger post_comment_counts after insert or delete on public.post_comments for each row execute function public.handle_post_comment_counts();
create or replace trigger post_share_counts after insert on public.post_shares for each row execute function public.handle_post_share_counts();
create or replace trigger saved_post_counts after insert or delete on public.saved_posts for each row execute function public.handle_saved_post_counts();
create or replace trigger follow_counts after insert or delete on public.followers for each row execute function public.handle_follow_counts();
create or replace trigger sync_profile_views after update of profile_views on public.profiles for each row execute function public.sync_post_profile_views();

create or replace view public.for_you_posts as
select
  p.id,
  p.author_id,
  p.caption,
  p.likes_count,
  p.comments_count,
  p.shares_count,
  p.saves_count,
  p.profile_views_snapshot,
  p.engagement_score,
  p.is_trending,
  p.created_at,
  pr.full_name,
  pr.username,
  pr.avatar_url,
  pr.profession,
  pr.is_pro,
  pr.is_verified,
  pr.follower_count
from public.posts p
join public.profiles pr on pr.id = p.author_id;

create or replace function public.get_for_you_feed(
  viewer_id uuid default auth.uid(),
  cursor_score numeric default null,
  cursor_created_at timestamp with time zone default null,
  cursor_post_id uuid default null,
  page_size int default 12
)
returns table (
  id uuid,
  author_id uuid,
  caption text,
  likes_count int,
  comments_count int,
  shares_count int,
  saves_count int,
  profile_views_snapshot int,
  engagement_score numeric,
  is_trending boolean,
  created_at timestamp with time zone,
  author jsonb,
  media jsonb,
  viewer jsonb
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.author_id,
    p.caption,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.saves_count,
    p.profile_views_snapshot,
    p.engagement_score,
    p.is_trending,
    p.created_at,
    jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'username', pr.username,
      'avatar_url', pr.avatar_url,
      'profession', pr.profession,
      'is_pro', pr.is_pro,
      'is_verified', pr.is_verified,
      'follower_count', pr.follower_count
    ) as author,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', pm.id,
          'media_type', pm.media_type,
          'url', pm.url,
          'thumbnail_url', pm.thumbnail_url,
          'alt_text', pm.alt_text,
          'position', pm.position
        ) order by pm.position)
        from public.post_media pm
        where pm.post_id = p.id
      ),
      '[]'::jsonb
    ) as media,
    jsonb_build_object(
      'liked', exists(select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = viewer_id),
      'saved', exists(select 1 from public.saved_posts sp where sp.post_id = p.id and sp.user_id = viewer_id),
      'following_author', exists(select 1 from public.followers f where f.following_id = p.author_id and f.follower_id = viewer_id)
    ) as viewer
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where
    cursor_score is null
    or (p.engagement_score, p.created_at, p.id) < (cursor_score, cursor_created_at, cursor_post_id)
  order by p.engagement_score desc, p.created_at desc, p.id desc
  limit least(greatest(page_size, 1), 30);
$$;

create or replace function public.get_post_comments(target_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  parent_id uuid,
  body text,
  mentions text[],
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  author jsonb
)
language sql stable security definer set search_path = public as $$
  select
    pc.id,
    pc.post_id,
    pc.user_id,
    pc.parent_id,
    pc.body,
    pc.mentions,
    pc.created_at,
    pc.updated_at,
    jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'username', pr.username,
      'avatar_url', pr.avatar_url,
      'profession', pr.profession,
      'is_pro', pr.is_pro
    ) as author
  from public.post_comments pc
  join public.profiles pr on pr.id = pc.user_id
  where pc.post_id = target_post_id
  order by coalesce(pc.parent_id, pc.id), pc.parent_id nulls first, pc.created_at;
$$;

create or replace function public.get_suggested_creators(viewer_id uuid default auth.uid(), page_size int default 5)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  profession public.creative_profession,
  is_pro boolean,
  is_verified boolean,
  follower_count int
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.avatar_url, p.profession, p.is_pro, p.is_verified, p.follower_count
  from public.profiles p
  where p.id <> viewer_id
    and not exists (
      select 1 from public.followers f
      where f.follower_id = viewer_id and f.following_id = p.id
    )
  order by p.follower_count desc, p.profile_views desc, p.created_at desc
  limit least(greatest(page_size, 1), 10);
$$;

create or replace function public.get_saved_posts(
  viewer_id uuid default auth.uid(),
  target_collection_id uuid default null,
  cursor_created_at timestamp with time zone default null,
  cursor_post_id uuid default null,
  page_size int default 12
)
returns table (
  id uuid,
  author_id uuid,
  caption text,
  likes_count int,
  comments_count int,
  shares_count int,
  saves_count int,
  profile_views_snapshot int,
  engagement_score numeric,
  is_trending boolean,
  created_at timestamp with time zone,
  author jsonb,
  media jsonb,
  viewer jsonb
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.author_id,
    p.caption,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.saves_count,
    p.profile_views_snapshot,
    p.engagement_score,
    p.is_trending,
    p.created_at,
    jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'username', pr.username,
      'avatar_url', pr.avatar_url,
      'profession', pr.profession,
      'is_pro', pr.is_pro,
      'is_verified', pr.is_verified,
      'follower_count', pr.follower_count
    ) as author,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', pm.id,
          'media_type', pm.media_type,
          'url', pm.url,
          'thumbnail_url', pm.thumbnail_url,
          'alt_text', pm.alt_text,
          'position', pm.position
        ) order by pm.position)
        from public.post_media pm
        where pm.post_id = p.id
      ),
      '[]'::jsonb
    ) as media,
    jsonb_build_object(
      'liked', exists(select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = viewer_id),
      'saved', true,
      'following_author', exists(select 1 from public.followers f where f.following_id = p.author_id and f.follower_id = viewer_id)
    ) as viewer
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where exists (
    select 1
    from public.saved_posts sp
    where sp.post_id = p.id
      and sp.user_id = viewer_id
      and (target_collection_id is null or sp.collection_id = target_collection_id)
  )
    and (
      cursor_created_at is null
      or (p.created_at, p.id) < (cursor_created_at, cursor_post_id)
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(page_size, 1), 30);
$$;

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_likes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_comments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_shares;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.saved_posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.followers;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
>>>>>>> eb039740 (For you page)
