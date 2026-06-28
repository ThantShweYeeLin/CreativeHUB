# Supabase Setup Guide for CreativeHUB

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Project Name**: CreativeHUB
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Select closest to your location
5. Click "Create new project" (this takes ~2 minutes)

## Step 2: Get Your Credentials

1. Once your project is created, go to **Settings → API**
2. Copy these values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 4: Run Database Schema

1. In Supabase console, go to **SQL Editor**
2. Click "New Query"
3. Copy all contents from `supabase/schema.sql`
4. Paste into the SQL editor
5. Click "Run"

This creates:
- User profiles table
- Freelancer profiles table
- Portfolios table
- Bookings table
- Messages & Conversations tables
- Favorites, Reviews, Notifications tables
- RLS (Row Level Security) policies

If you already ran an older version of the schema, add the profile background column with:
```sql
alter table public.users
  add column if not exists cover_url text;
```

If request sending fails with `new row violates row-level security policy for table "requests"`, run:
```sql
drop policy if exists "Users see own requests" on public.requests;
drop policy if exists "Clients can create requests" on public.requests;
drop policy if exists "Participants can update requests" on public.requests;

create policy "Users see own requests" on public.requests
  for select using (auth.uid() = client_id or auth.uid() = freelancer_id);

create policy "Clients can create requests" on public.requests
  for insert with check (auth.uid() = client_id);

create policy "Participants can update requests" on public.requests
  for update using (auth.uid() = client_id or auth.uid() = freelancer_id);
```

To enable client publishing on the For You page, run:
```sql
create table if not exists public.client_posts (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.users on delete cascade not null,
  caption text not null,
  image_url text,
  is_published boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.client_posts enable row level security;

drop policy if exists "Client posts are viewable by everyone" on public.client_posts;
drop policy if exists "Clients can create own posts" on public.client_posts;
drop policy if exists "Clients can update own posts" on public.client_posts;

create policy "Client posts are viewable by everyone" on public.client_posts
  for select using (is_published = true);

create policy "Clients can create own posts" on public.client_posts
  for insert with check (auth.uid() = client_id);

create policy "Clients can update own posts" on public.client_posts
  for update using (auth.uid() = client_id);
```

If you want freelancer request acceptance to auto-create bookings, update booking insert policy with:
```sql
drop policy if exists "Users can insert own bookings" on public.bookings;

create policy "Users can insert own bookings" on public.bookings
  for insert with check (auth.uid() = client_id or auth.uid() = freelancer_id);
```

## Step 5: Enable Email Authentication

1. Go to **Authentication → Providers**
2. Make sure "Email" is enabled (it should be by default)
3. Go to **Email Templates** to customize if needed

## Step 6: Configure Storage Buckets

For file uploads (portfolio images, avatars):

1. Run this SQL in Supabase SQL Editor to create the `avatars` bucket and policies used by profile pictures and profile backgrounds:
   ```sql
   insert into storage.buckets (id, name, public)
   values ('avatars', 'avatars', true)
   on conflict (id) do update set public = excluded.public;

   drop policy if exists "Avatar files are publicly viewable" on storage.objects;
   drop policy if exists "Users can upload own avatar files" on storage.objects;
   drop policy if exists "Users can update own avatar files" on storage.objects;

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
   ```

2. Optional future buckets:
   - `portfolio-images` (public)
   - `contract-files` (private)

## Step 7: Install Dependencies

```bash
pnpm install
```

## Step 8: Verify Setup

Run the dev server:
```bash
pnpm dev
```

Test by:
1. Going to `http://localhost:5173`
2. Try signing up / logging in
3. Create a freelancer profile

## Optional: Seed Test Accounts

If you want ready-made users for login, messaging, search, and booking tests:

1. In **Settings -> API**, copy your **service_role** key.
2. Add it to `.env.local` without the `VITE_` prefix:
  ```
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
  ```
3. Run:
  ```bash
  pnpm seed:test-accounts
  ```

The script creates four reusable accounts and keeps them in sync if you rerun it:

- `mia.client@creativehub.test` - client
- `noah.client@creativehub.test` - client
- `ava.freelancer@creativehub.test` - freelancer
- `liam.freelancer@creativehub.test` - freelancer

Default password for all seeded accounts:

```text
CreativeHub123!
```

You can override that password for a run with:

```bash
TEST_ACCOUNT_PASSWORD='YourOwnTestPassword123!' pnpm seed:test-accounts
```

## Database Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | User accounts (clients & freelancers) |
| `freelancer_profiles` | Extended freelancer info (skills, rate, etc) |
| `portfolios` | Freelancer portfolio items |
| `bookings` | Orders/Projects between client & freelancer |
| `messages` | Direct messages |
| `conversations` | Message thread groups |
| `requests` | Job proposals/requests |
| `favorites` | Bookmarked freelancers |
| `reviews` | Ratings & feedback |
| `notifications` | User alerts |

## Security Notes

- ✅ RLS policies are configured for data privacy
- ✅ Users can only see/edit their own data
- ✅ Freelancer profiles are public (read-only)
- ✅ Messages are private to participants only

## Troubleshooting

### Missing credentials error
- Check `.env.local` exists and has correct values
- Restart dev server after changing env variables

### Auth not working
- Confirm Email provider is enabled in Supabase
- Check browser console for error messages
- Verify `VITE_SUPABASE_URL` doesn't have trailing slash

### Can't sign up
- Check if email already exists (try different email)
- Look at Supabase logs: **Auth → User Management**

### Need to reset database
- Go to Supabase console
- Settings → Danger Zone → Reset Database
- Re-run the schema.sql script

## Next Steps

1. Update LoginPage & SignUpPage components to use Supabase auth
2. Create middleware/context for auth state management
3. Add file upload functions for portfolio images
4. Set up real-time subscriptions for messages

See `src/lib/authService.ts` and `src/lib/dataService.ts` for available functions.
