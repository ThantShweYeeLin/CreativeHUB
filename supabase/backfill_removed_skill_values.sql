-- One-time data fix: several skill values were removed from
-- src/lib/categories.ts's taxonomy for being techniques rather than
-- bookable services (Contouring, Base Makeup, Hair Curling, Hair
-- Straightening, Cinematography, Venue Styling). New onboarding never
-- suggests them again, but existing freelancer_profiles rows picked
-- before the taxonomy changed still have them stored in `skills`.
--
-- Replacement table (same for seed and real profiles):
--   Contouring          -> Makeup Application
--   Base Makeup         -> Makeup Application
--   Hair Curling        -> Hair Styling
--   Hair Straightening  -> Hair Styling
--   Cinematography      -> Event Videography
--   Venue Styling       -> Event Decoration
-- If the replacement value is already present in that profile's skills,
-- the stale value is just dropped (no duplicate added).
--
-- Run this once against your Supabase project's SQL editor.

-- ===== Seed/demo accounts (@seed.creativehub.test) =====

-- Preecha Suksawat (Makeup Artist)
update public.freelancer_profiles set skills = array['False Lash Application', 'Makeup Application']::text[]
where id = 'c7030a0f-4539-4618-973d-2214e4dc9c0d';

-- Nara Fuangfu (Makeup Artist)
update public.freelancer_profiles set skills = array['Bridal Makeup', 'Eye Makeup', 'Makeup Application']::text[]
where id = '8e2acc77-f7a9-473c-bed8-e07bb2a602d4';

-- Namfon Danai (Makeup Artist)
update public.freelancer_profiles set skills = array['Bridal Makeup', 'Makeup Application', 'False Lash Application']::text[]
where id = '2e9806f2-0a58-4939-b20b-8d52eac29b93';

-- Udom Fuangfu (Hair Stylist)
update public.freelancer_profiles set skills = array['Hair Styling', 'Hair Coloring', 'Braiding']::text[]
where id = '3d738077-15f4-420e-95f2-0ab05dd0b9e9';

-- Kade Wattana (Decorator/Florist)
update public.freelancer_profiles set skills = array['Floral Arrangements', 'Backdrop Design', 'Event Decoration']::text[]
where id = '9dafee94-f8e0-4f4e-81b6-0044de1dc2b1';

-- Jiraporn Fuangfu (Hair Stylist)
update public.freelancer_profiles set skills = array['Bridal Hairstyling', 'Hair Styling', 'Braiding']::text[]
where id = 'b4295a42-135b-4021-b684-64310cfecbb2';

-- Fon Limthong (Hair Stylist)
update public.freelancer_profiles set skills = array['Braiding', 'Updos', 'Hair Styling']::text[]
where id = '583539db-c427-47e8-93e1-e86928cecf0c';

-- Orn Fuangfu (Makeup Artist)
update public.freelancer_profiles set skills = array['Makeup Application', 'Bridal Makeup', 'False Lash Application']::text[]
where id = 'adcde12a-5eb1-4b4e-905d-cfb0766ad09a';

-- ===== Real (non-seed) accounts — flagged for your awareness =====

-- Uri (thantshweyeelin@gmail.com) — Makeup Artist
update public.freelancer_profiles set skills = array['Makeup Application', 'Eye Makeup', 'False Lash Application']::text[]
where id = 'a25f0545-2cd4-4069-aa3c-00d0590becf1';

-- Harry Parker (harryparker@gmail.com) — Videographer
update public.freelancer_profiles set skills = array['Wedding Videography', 'Event Videography']::text[]
where id = '4e3b1a18-8ba8-4d3d-b5c0-0b45dce441da';

-- Mary Jane (maryjane@gmail.com) — Decorator/Florist
update public.freelancer_profiles set skills = array['Floral Arrangements', 'Bridal Bouquets', 'Event Decoration']::text[]
where id = '7b441605-ff12-4491-9ee6-dcfe47feaec5';

-- Ceci (sisi2025htun@gmail.com) — Makeup Artist
update public.freelancer_profiles set skills = array['Eye Makeup', 'Bridal Makeup', 'Makeup Application', 'False Lash Application']::text[]
where id = '055e29be-0dd9-4ab0-82f1-3a4c9ffe06b6';

-- sam smith (samsmith@gmail.com) — Decorator/Florist
update public.freelancer_profiles set skills = array['Event Decoration', 'Table Centerpieces', 'Backdrop Design']::text[]
where id = 'ab80e753-e684-48ff-ae8f-702564c46ffa';

-- Liam Brooks (liam.freelancer@creativehub.test) — account being deleted
-- entirely (see supabase/delete_liam_brooks.sql), so no skills fix needed
-- here; row intentionally omitted.

-- Ava Thompson (ava.freelancer@creativehub.test) — Hair Stylist
update public.freelancer_profiles set skills = array['Updos', 'Hair Styling', 'Hair Coloring']::text[]
where id = 'd736aadc-9dbe-4778-adde-078af8731995';

-- Cherry Zugler (cherryArts@gmail.com) — Hair Stylist
update public.freelancer_profiles set skills = array['Hair Styling', 'Bridal Hairstyling', 'Braiding']::text[]
where id = '310e408a-024d-4e56-89ce-341f71102c5c';
