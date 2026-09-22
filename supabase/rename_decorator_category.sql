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

update public.freelancer_profiles set title = 'Decorators' where title = 'Decorator/Florist';

update public.skills set name = 'Decorators' where name = 'Decorator/Florist';

insert into public.skills (name, category)
select 'Florist', 'Events'
where not exists (select 1 from public.skills where name = 'Florist');
