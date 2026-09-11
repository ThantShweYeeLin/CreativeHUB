-- Adds a per-skill experience level (both major and minor) on top of
-- freelancer_skills. Run this once against your Supabase project's SQL
-- editor, after freelancer_skills.sql.

alter table public.freelancer_skills
  add column if not exists experience_level text
    check (experience_level in ('Beginner', 'Intermediate', 'Professional', 'Expert'));
