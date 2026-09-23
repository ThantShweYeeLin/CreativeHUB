-- Renames the "Decorators" freelancer category back to "Decorator" and
-- "Musicians" back to "Musician" - a single freelancer's own specialty badge
-- ("Primary Specialty: Decorators") read oddly as a plural noun. Matches
-- src/lib/categories.ts's FREELANCER_CATEGORIES labels; "Florist" and "Live
-- Entertainment" stay as skills under them, unaffected.
--
-- No schema change - just a label rename on existing rows. Existing
-- freelancer_skills rows that reference the renamed skill keep referencing
-- the same id, so anyone who had picked "Decorators"/"Musicians" (major or
-- minor) now shows "Decorator"/"Musician" automatically.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

update public.freelancer_profiles set title = 'Decorator' where title = 'Decorators';
update public.freelancer_profiles set title = 'Musician' where title = 'Musicians';

update public.freelancer_profiles set minor_category = 'Decorator' where minor_category = 'Decorators';
update public.freelancer_profiles set minor_category = 'Musician' where minor_category = 'Musicians';

update public.freelancer_profiles
  set minor_categories = array_replace(array_replace(minor_categories, 'Decorators', 'Decorator'), 'Musicians', 'Musician')
  where 'Decorators' = any(minor_categories) or 'Musicians' = any(minor_categories);

update public.skills set name = 'Decorator' where name = 'Decorators';
update public.skills set name = 'Musician' where name = 'Musicians';
