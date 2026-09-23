-- Renames the "Decorator/Florist" freelancer category to "Decorators" and
-- makes "Florist" a skill under it instead of its own category, matching
-- src/lib/categories.ts / src/lib/skillsTaxonomy.ts.
--
-- No schema change — just a label rename on existing rows plus one new
-- skills row. Existing freelancer_skills rows that reference the renamed
-- skill keep referencing the same id, so anyone who had picked
-- "Decorator/Florist" (major or minor) now shows "Decorators" automatically.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.
--
-- Note: the live project's rows were actually titled plain 'Decorator' (not
-- 'Decorator/Florist' as this file originally assumed), so the first version
-- of this migration silently matched zero rows. Both old labels are handled
-- here so this stays correct regardless of which one a given environment has.

update public.freelancer_profiles set title = 'Decorators' where title in ('Decorator/Florist', 'Decorator');

update public.skills set name = 'Decorators' where name in ('Decorator/Florist', 'Decorator');

insert into public.skills (name, category)
select 'Florist', 'Events'
where not exists (select 1 from public.skills where name = 'Florist');
