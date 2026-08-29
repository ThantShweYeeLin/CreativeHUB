-- Adds structured country/city fields to public.users, collected at signup
-- via CountrySelect/CitySelect. These are the general/base-location fields
-- ("where the user is based") — distinct from freelancer-specific studio
-- location and preferred service locations on freelancer_profiles, and
-- distinct from the existing geocoded location/location_latitude/
-- location_longitude/location_place_id columns, which stay as the derived
-- map point (used for map/distance features) rather than being replaced.
--
-- Run this once against your Supabase project's SQL editor.

alter table public.users
  add column if not exists country text,
  add column if not exists country_code text,
  add column if not exists city text;
