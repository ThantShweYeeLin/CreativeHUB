-- Adds a persistent Teams subsystem: creating a team, inviting members with
-- roles/revenue share, and routing a client's team booking request through
-- an all-or-nothing per-member confirmation before a real booking is
-- created (owned by the team owner, since `bookings.freelancer_id` is a
-- single FK with no team concept). Run this once against your Supabase
-- project's SQL editor.

create table if not exists public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references public.users on delete cascade not null,
  description text,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  role text default 'member' check (role in ('owner','member')),
  revenue_share_percent numeric(5,2) default 0,
  status text default 'active' check (status in ('active','left')),
  joined_at timestamptz default timezone('utc', now()) not null,
  unique (team_id, user_id)
);

create table if not exists public.team_invitations (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams on delete cascade not null,
  inviter_id uuid references public.users on delete cascade not null,
  invitee_id uuid references public.users on delete cascade not null,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  revenue_share_percent numeric(5,2),
  created_at timestamptz default timezone('utc', now()) not null,
  responded_at timestamptz
);

create table if not exists public.team_bookings (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams on delete cascade not null,
  client_id uuid references public.users on delete cascade not null,
  booking_id uuid references public.bookings on delete set null,
  project_name text not null,
  description text,
  budget numeric(10,2),
  status text default 'pending' check (status in ('pending','confirmed','rejected','cancelled')),
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.team_booking_confirmations (
  id uuid default uuid_generate_v4() primary key,
  team_booking_id uuid references public.team_bookings on delete cascade not null,
  member_id uuid references public.users on delete cascade not null,
  status text default 'pending' check (status in ('pending','confirmed','declined')),
  responded_at timestamptz,
  unique (team_booking_id, member_id)
);

create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_invitations_invitee_id on public.team_invitations(invitee_id);
create index if not exists idx_team_bookings_team_id on public.team_bookings(team_id);
create index if not exists idx_team_booking_confirmations_team_booking_id on public.team_booking_confirmations(team_booking_id);
create index if not exists idx_team_booking_confirmations_member_id on public.team_booking_confirmations(member_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_bookings enable row level security;
alter table public.team_booking_confirmations enable row level security;

DO $$ BEGIN
  CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages own team" ON public.teams FOR ALL
    USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team roster is viewable by everyone" ON public.team_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages team members" ON public.team_members FOR ALL
    USING (auth.uid() in (select owner_id from public.teams where id = team_id))
    WITH CHECK (auth.uid() in (select owner_id from public.teams where id = team_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Member can update own membership" ON public.team_members FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Lets an invited user join by inserting their own membership row after
  -- accepting an invitation (app-layer enforces the invitation exists first).
  CREATE POLICY "Invitee can join own membership" ON public.team_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Invitations viewable by inviter and invitee" ON public.team_invitations FOR SELECT
    USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Inviter creates invitations" ON public.team_invitations FOR INSERT
    WITH CHECK (auth.uid() = inviter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Invitee responds to own invitation" ON public.team_invitations FOR UPDATE
    USING (auth.uid() = invitee_id) WITH CHECK (auth.uid() = invitee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team bookings viewable by client and team members" ON public.team_bookings FOR SELECT
    USING (
      auth.uid() = client_id
      OR auth.uid() in (select user_id from public.team_members where team_id = team_bookings.team_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Client creates team bookings" ON public.team_bookings FOR INSERT
    WITH CHECK (auth.uid() = client_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Client or team owner updates team booking" ON public.team_bookings FOR UPDATE
    USING (
      auth.uid() = client_id
      OR auth.uid() in (select owner_id from public.teams where id = team_bookings.team_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Confirmations viewable by client and team members" ON public.team_booking_confirmations FOR SELECT
    USING (
      auth.uid() = member_id
      OR auth.uid() in (
        select tb.client_id from public.team_bookings tb where tb.id = team_booking_confirmations.team_booking_id
      )
      OR auth.uid() in (
        select tm.user_id from public.team_members tm
        join public.team_bookings tb on tb.team_id = tm.team_id
        where tb.id = team_booking_confirmations.team_booking_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Member responds to own confirmation" ON public.team_booking_confirmations FOR UPDATE
    USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Client creates confirmations for their team booking" ON public.team_booking_confirmations FOR INSERT
    WITH CHECK (
      auth.uid() in (
        select tb.client_id from public.team_bookings tb where tb.id = team_booking_confirmations.team_booking_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
