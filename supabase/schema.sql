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
