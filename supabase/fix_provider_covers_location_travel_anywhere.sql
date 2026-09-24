-- Bug: Premium freelancers who bought Premium and are eligible in every
-- other way (category, availability, account status, no date conflict)
-- were invisible to every single Open Group Request, because
-- provider_covers_location() (freelancer_premium.sql) never matched the
-- "Open to travel anywhere" preset a freelancer can pick in onboarding/Edit
-- Profile (StepServiceLocations.tsx's TRAVEL_ANYWHERE) - that preset is
-- stored as a location entry with no coordinates and no city/district, so
-- every check in the old function body skipped it as "not enough info to
-- match". src/lib/eventMatcher.ts's locationCovers() - this function's own
-- doc comment calls it "the same coverage rule" - was already fixed to
-- recognize this preset as the deliberate wildcard it's meant to be; this
-- migration just ports that same fix here. A freelancer with a genuinely
-- empty locations array (never having added any location at all, preset or
-- real) is still correctly excluded - only the explicit "anywhere" choice
-- now works.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create or replace function public.provider_covers_location(
  p_locations jsonb, p_lat double precision, p_lng double precision, p_event_text text
)
returns boolean
language plpgsql
immutable
as $$
declare
  pt jsonb;
  pt_lat double precision;
  pt_lng double precision;
  dist double precision;
  txt text := lower(coalesce(p_event_text, ''));
  v_city text;
  v_district text;
begin
  if p_locations is null or jsonb_typeof(p_locations) <> 'array' then
    return false;
  end if;
  for pt in select * from jsonb_array_elements(p_locations) loop
    if trim(coalesce(pt->>'formattedAddress', '')) = 'Open to travel anywhere' then
      return true;
    end if;
    pt_lat := nullif(pt->>'latitude', '')::double precision;
    pt_lng := nullif(pt->>'longitude', '')::double precision;
    if pt_lat is not null and pt_lng is not null and p_lat is not null and p_lng is not null then
      dist := 2 * 6371 * asin(sqrt(
        power(sin(radians(p_lat - pt_lat) / 2), 2)
        + cos(radians(pt_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - pt_lng) / 2), 2)
      ));
      if dist <= 60 then return true; end if;
    elsif txt <> '' then
      v_city := lower(coalesce(pt->>'city', ''));
      v_district := lower(coalesce(pt->>'district', ''));
      if (v_city <> '' and position(v_city in txt) > 0) or (v_district <> '' and position(v_district in txt) > 0) then
        return true;
      end if;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.provider_covers_location(jsonb, double precision, double precision, text) from public, anon;
grant execute on function public.provider_covers_location(jsonb, double precision, double precision, text) to authenticated;
