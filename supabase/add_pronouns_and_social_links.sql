-- Adds a pronouns field to public.users and a social_links table for
-- freelancer profiles (replacing portfolio photos as the way freelancers
-- showcase their work). Run this once against your Supabase project's SQL
-- editor.

alter table public.users
  add column if not exists pronouns text;

create table if not exists public.social_links (
  id uuid default uuid_generate_v4() primary key,
  freelancer_id uuid references public.freelancer_profiles on delete cascade not null,
  platform text not null check (platform in ('Instagram', 'TikTok', 'Behance', 'Dribbble', 'Facebook', 'YouTube', 'Website')),
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (freelancer_id, platform)
);

create index if not exists idx_social_links_freelancer_id on public.social_links(freelancer_id);

alter table public.social_links enable row level security;

create policy "Social links are viewable by everyone" on public.social_links
  for select using (true);

create policy "Freelancers can manage own social links" on public.social_links
  for all using (auth.uid() in (select user_id from public.freelancer_profiles where id = freelancer_id));
