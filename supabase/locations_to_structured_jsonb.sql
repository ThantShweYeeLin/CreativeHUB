-- Upgrades public.freelancer_profiles "locations" and "studio_locations"
-- from plain text[] (address label only) to structured jsonb, so each saved
-- location carries { formattedAddress, latitude, longitude, city, district,
-- placeId } picked from the Leaflet/OpenStreetMap location picker instead
-- of just a typed string. Field names match components/common/
-- LeafletLocationPicker.tsx's LocationPoint type exactly, so the app can
-- read/write these jsonb rows with no field-mapping layer.
--
-- Converts via add-a-new-column -> copy data -> drop old -> rename, rather
-- than "alter column ... type jsonb using (...)", because Postgres forbids
-- a subquery (needed here to jsonb_agg over unnest(<column>)) inside an
-- ALTER COLUMN TYPE USING expression ("cannot use subquery in transform
-- expression").
--
-- Safe to run whether or not add_studio_field.sql (the earlier text[]
-- version of studio_name/studio_locations) was already applied, and safe to
-- re-run if it partially failed before — every step checks current state
-- first.
--
-- Run this once against your Supabase project's SQL editor.

do $$
begin
  -- studio_name: plain text, no conversion needed.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'freelancer_profiles' and column_name = 'studio_name'
  ) then
    alter table public.freelancer_profiles add column studio_name text;
  end if;

  -- studio_locations: text[] -> jsonb.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'freelancer_profiles'
      and column_name = 'studio_locations' and data_type = 'ARRAY'
  ) then
    alter table public.freelancer_profiles add column studio_locations_jsonb jsonb;
    update public.freelancer_profiles
      set studio_locations_jsonb = coalesce(
        (select jsonb_agg(jsonb_build_object(
           'formattedAddress', loc, 'latitude', null, 'longitude', null, 'city', null, 'district', null, 'placeId', null
         )) from unnest(studio_locations) as loc),
        '[]'::jsonb
      );
    alter table public.freelancer_profiles drop column studio_locations;
    alter table public.freelancer_profiles rename column studio_locations_jsonb to studio_locations;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'freelancer_profiles' and column_name = 'studio_locations'
  ) then
    alter table public.freelancer_profiles add column studio_locations jsonb;
  end if;
  alter table public.freelancer_profiles alter column studio_locations set default '[]'::jsonb;
  update public.freelancer_profiles set studio_locations = '[]'::jsonb where studio_locations is null;

  -- locations: text[] -> jsonb.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'freelancer_profiles'
      and column_name = 'locations' and data_type = 'ARRAY'
  ) then
    alter table public.freelancer_profiles add column locations_jsonb jsonb;
    update public.freelancer_profiles
      set locations_jsonb = coalesce(
        (select jsonb_agg(jsonb_build_object(
           'formattedAddress', loc, 'latitude', null, 'longitude', null, 'city', null, 'district', null, 'placeId', null
         )) from unnest(locations) as loc),
        '[]'::jsonb
      );
    alter table public.freelancer_profiles drop column locations;
    alter table public.freelancer_profiles rename column locations_jsonb to locations;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'freelancer_profiles' and column_name = 'locations'
  ) then
    alter table public.freelancer_profiles add column locations jsonb;
  end if;
  alter table public.freelancer_profiles alter column locations set default '[]'::jsonb;
  update public.freelancer_profiles set locations = '[]'::jsonb where locations is null;
end $$;
