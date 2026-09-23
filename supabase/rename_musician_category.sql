-- Renames the "Musician/Live Entertainment" freelancer category to
-- "Musicians" and makes "Live Entertainment" a skill under it instead of
-- being bundled into the category name — matches src/lib/categories.ts /
-- src/lib/skillsTaxonomy.ts, same pattern as rename_decorator_category.sql.
--
-- No schema change — just a label rename on existing rows plus one new
-- skills row. Existing freelancer_skills rows that reference the renamed
-- skill keep referencing the same id, so anyone who had picked
-- "Musician/Live Entertainment" (major or minor) now shows "Musicians"
-- automatically.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

update public.freelancer_profiles set title = 'Musicians' where title = 'Musician/Live Entertainment';

update public.skills set name = 'Musicians' where name = 'Musician/Live Entertainment';

insert into public.skills (name, category)
select 'Live Entertainment', 'Events'
where not exists (select 1 from public.skills where name = 'Live Entertainment');
