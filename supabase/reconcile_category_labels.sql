-- Reconciles freelancer category labels after merging two branches that
-- independently added the same wedding-vendor categories under different
-- names: this branch's "Decorator / Florist" / "Cake / Dessert" /
-- "DJ / Musician" (spaced) vs. the canonical "Decorator/Florist" /
-- "Cake/Dessert Maker" / "Musician/Live Entertainment" labels that came in
-- from origin/main's Event Matcher work (src/lib/categories.ts). The
-- canonical (no-space) labels won; this brings the already-seeded `skills`
-- rows and any freelancer_profiles.title already set to the old spaced
-- labels in line with them. Run once, after freelancer_skills.sql and
-- remove_model_category.sql.

update public.skills set name = 'Decorator/Florist' where name = 'Decorator / Florist';
update public.skills set name = 'Cake/Dessert Maker' where name = 'Cake / Dessert';
update public.skills set name = 'Musician/Live Entertainment' where name = 'DJ / Musician';

update public.freelancer_profiles set title = 'Decorator/Florist' where title = 'Decorator / Florist';
update public.freelancer_profiles set title = 'Cake/Dessert Maker' where title = 'Cake / Dessert';
update public.freelancer_profiles set title = 'Musician/Live Entertainment' where title = 'DJ / Musician';
