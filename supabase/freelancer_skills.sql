-- Major/minor freelancer skills. Run this once against your Supabase
-- project's SQL editor.
--
-- freelancer_profiles.title is already the freelancer's MAJOR skill (a
-- single controlled value from src/lib/categories.ts's FREELANCER_CATEGORIES)
-- and stays exactly as-is — every place that already reads/filters/matches
-- on it keeps working unchanged. What's new here is MINOR skills: a
-- normalized taxonomy a freelancer can pick 0-5 additional capabilities
-- from (e.g. a Photographer who also does Makeup Artist work). Both major
-- and minor picks are recorded in freelancer_skills so the system has one
-- real normalized home instead of skills living only in flat text[] tags.

create table if not exists public.skills (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.freelancer_skills (
  id uuid default uuid_generate_v4() primary key,
  freelancer_id uuid references public.freelancer_profiles(id) on delete cascade not null,
  skill_id uuid references public.skills(id) on delete restrict not null,
  skill_type text not null check (skill_type in ('major', 'minor')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (freelancer_id, skill_id)
);

-- The database itself enforces "at most one major skill per freelancer",
-- not just application logic.
create unique index if not exists freelancer_skills_one_major
  on public.freelancer_skills (freelancer_id)
  where skill_type = 'major';

alter table public.skills enable row level security;
alter table public.freelancer_skills enable row level security;

DO $$ BEGIN
  CREATE POLICY "Skills are viewable by everyone" ON public.skills FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Freelancer skills are viewable by everyone" ON public.freelancer_skills FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same ownership pattern as "Freelancers can manage own portfolios" in
-- schema.sql: a freelancer_id doesn't carry auth.uid() directly, so
-- ownership is proven by joining back to freelancer_profiles.user_id.
DO $$ BEGIN
  CREATE POLICY "Freelancers manage own skills" ON public.freelancer_skills FOR ALL
    USING (auth.uid() in (select user_id from public.freelancer_profiles where id = freelancer_id))
    WITH CHECK (auth.uid() in (select user_id from public.freelancer_profiles where id = freelancer_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed taxonomy: the 9 existing major-skill categories (so any of them can
-- also be picked as someone else's minor skill, per the spec's own
-- examples) plus the broader granular skill list.
insert into public.skills (name, category) values
  ('Photographer', 'Photography'),
  ('Portrait Photographer', 'Photography'),
  ('Wedding Photographer', 'Photography'),
  ('Product Photographer', 'Photography'),
  ('Fashion Photographer', 'Photography'),
  ('Event Photographer', 'Photography'),
  ('Food Photographer', 'Photography'),
  ('Photo Editor', 'Photography'),
  ('Videographer', 'Videography'),
  ('Cinematographer', 'Videography'),
  ('Video Editor', 'Videography'),
  ('Motion Graphics', 'Videography'),
  ('Graphic Designer', 'Design'),
  ('UI Designer', 'Design'),
  ('UX Designer', 'Design'),
  ('Brand Designer', 'Design'),
  ('Illustrator', 'Design'),
  ('3D Designer', 'Design'),
  ('Motion Designer', 'Design'),
  ('Makeup Artist', 'Beauty'),
  ('Hair Stylist', 'Beauty'),
  ('Nail Artist', 'Beauty'),
  ('Beauty Specialist', 'Beauty'),
  ('Fashion Stylist', 'Fashion'),
  ('Fashion Designer', 'Fashion'),
  ('Costume Designer', 'Fashion'),
  ('Copywriter', 'Writing'),
  ('Content Writer', 'Writing'),
  ('Scriptwriter', 'Writing'),
  ('Music Producer', 'Audio'),
  ('Sound Designer', 'Audio'),
  ('Audio Engineer', 'Audio'),
  ('Model', 'Modeling'),
  ('Decorator / Florist', 'Events'),
  ('Cake / Dessert', 'Events'),
  ('DJ / Musician', 'Events')
on conflict (name) do nothing;

-- Backfill: every existing freelancer with a recognized title gets a
-- 'major' row matching it. Anyone whose title is null or doesn't match the
-- controlled list (shouldn't happen, but not assumed) is simply left
-- without a major-skill row rather than guessed at.
insert into public.freelancer_skills (freelancer_id, skill_id, skill_type)
select fp.id, s.id, 'major'
from public.freelancer_profiles fp
join public.skills s on s.name = fp.title
where fp.title is not null
on conflict (freelancer_id, skill_id) do nothing;
