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

## Step 5: Enable Email Authentication

1. Go to **Authentication → Providers**
2. Make sure "Email" is enabled (it should be by default)
3. Go to **Email Templates** to customize if needed

## Step 6: Configure Storage Buckets (Optional)

For file uploads (portfolio images, avatars):

1. Go to **Storage** in the Supabase console
2. Click "New bucket"
3. Create buckets:
   - `portfolio-images` (public)
   - `avatars` (public, used for profile pictures and profile backgrounds)
   - `contract-files` (private)

4. Add storage policies for `avatars` so authenticated users can upload and update their own profile images:
   ```sql
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

   create policy "Avatar files are publicly viewable"
     on storage.objects
     for select
     using (bucket_id = 'avatars');
   ```

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
