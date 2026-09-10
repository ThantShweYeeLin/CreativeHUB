-- One-time data fix: a handful of test freelancer_profiles rows (Decorator/
-- Florist and one Hair Stylist) have empty skills/styles arrays, which the
-- Event Matcher relies on for style-overlap ranking (see scoreEventCandidate
-- in src/lib/eventMatcher.ts) — an empty styles array means that candidate
-- can never score above a zero-overlap baseline no matter what the client
-- picks. Values below are drawn from each category's own suggested list in
-- src/lib/categories.ts, varied per row so the matcher's ranking actually
-- differentiates between these providers instead of tying everyone. Safe to
-- run once; each row only updates if it's currently empty, so re-running is
-- a no-op.
--
-- Run this once against your Supabase project's SQL editor.

update public.freelancer_profiles set
  skills = array['Event Decoration', 'Floral Arrangements', 'Table Centerpieces'],
  styles = array['Elegant', 'Romantic']
where id = 'f8469381-5e6d-4ff9-a654-2fd6ce2633d8' and skills = array[]::text[];

update public.freelancer_profiles set
  skills = array['Balloon Styling', 'Backdrop Design', 'Event Decoration'],
  styles = array['Modern', 'Minimalist']
where id = 'edb98e68-a61b-48a7-814d-3d127f6a7ae6' and skills = array[]::text[];

update public.freelancer_profiles set
  skills = array['Floral Arrangements', 'Bridal Bouquets', 'Venue Styling'],
  styles = array['Romantic', 'Garden', 'Traditional']
where id = '7b441605-ff12-4491-9ee6-dcfe47feaec5' and skills = array[]::text[];

update public.freelancer_profiles set
  skills = array['Venue Styling', 'Table Centerpieces', 'Backdrop Design'],
  styles = array['Luxury', 'Elegant']
where id = 'ab80e753-e684-48ff-ae8f-702564c46ffa' and skills = array[]::text[];

update public.freelancer_profiles set
  skills = array['Event Decoration', 'Balloon Styling', 'Table Centerpieces'],
  styles = array['Modern', 'Minimalist', 'Bohemian']
where id = '5fce91ac-b00e-4634-becf-f0f12aea83cf' and skills = array[]::text[];

update public.freelancer_profiles set
  skills = array['Floral Arrangements', 'Backdrop Design', 'Venue Styling'],
  styles = array['Bohemian', 'Rustic', 'Garden']
where id = '9dafee94-f8e0-4f4e-81b6-0044de1dc2b1' and skills = array[]::text[];

update public.freelancer_profiles set
  skills = array['Bridal Bouquets', 'Table Centerpieces', 'Event Decoration'],
  styles = array['Traditional', 'Elegant']
where id = '2165a335-f292-4ba6-acac-959df0b96e89' and skills = array[]::text[];

-- Miyako Kiko (Hair Stylist) already has custom styles set
-- (["Bridal Hair","Colorist"]) — only skills is empty here.
update public.freelancer_profiles set
  skills = array['Hair Coloring', 'Bridal Hairstyling', 'Hair Styling']
where id = 'ced6edbc-e865-415f-a501-a129168c55fc' and skills = array[]::text[];
