-- Lets each user control how their profile location is represented on maps.
-- Existing rows default to the privacy-preserving approximate mode.
alter table public.users
  add column if not exists location_visibility text;

update public.users
set location_visibility = 'approximate'
where location_visibility is null;

alter table public.users
  alter column location_visibility set default 'approximate',
  alter column location_visibility set not null;

alter table public.users
  drop constraint if exists users_location_visibility_check;

alter table public.users
  add constraint users_location_visibility_check
  check (location_visibility in ('hidden', 'approximate', 'public'));

grant select (location_visibility) on public.users to anon, authenticated;
