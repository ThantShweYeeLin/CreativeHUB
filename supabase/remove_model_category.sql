-- Removes "Model" as a supported freelancer category/skill. Run this once
-- against your Supabase project's SQL editor, after freelancer_skills.sql
-- and freelancer_skills_experience_level.sql.
--
-- Every freelancer currently set to Model is reassigned to
-- Decorator / Florist (chosen when this was run) — their category-scoped
-- skill/style tags and per-skill experience level are cleared since a
-- Modeling specialty ("Runway Modeling", "High Fashion" style, "Expert")
-- doesn't carry over to a different category, and their AI embedding is
-- flagged for regeneration so the AI Matcher picks up the new category next
-- time they save their profile.

-- 1. Reassign the freelancer_profiles row itself.
update public.freelancer_profiles
set title = 'Decorator / Florist',
    skills = '{}',
    styles = '{}',
    embedding_status = 'pending'
where title = 'Model';

-- 2. Defensive: if a freelancer somehow already has both a Model row and a
--    Decorator / Florist row, drop the now-redundant Model row instead of
--    violating freelancer_skills' unique(freelancer_id, skill_id).
delete from public.freelancer_skills fs
using public.skills model_skill, public.skills target_skill
where fs.skill_id = model_skill.id
  and model_skill.name = 'Model'
  and target_skill.name = 'Decorator / Florist'
  and exists (
    select 1 from public.freelancer_skills other
    where other.freelancer_id = fs.freelancer_id and other.skill_id = target_skill.id
  );

-- 3. Move every remaining freelancer_skills row (major or minor) off the
--    Model skill onto Decorator / Florist, clearing its experience level.
update public.freelancer_skills
set skill_id = (select id from public.skills where name = 'Decorator / Florist'),
    experience_level = null
where skill_id = (select id from public.skills where name = 'Model');

-- 4. Soft-delete the Model skill itself so it can no longer be picked as a
--    major or minor skill going forward, without breaking the
--    freelancer_skills FK for any historical reference (none should remain
--    after step 3, but this keeps deactivation — not deletion — as the
--    reversible option per the project's existing skill-management convention).
update public.skills set is_active = false where name = 'Model';
