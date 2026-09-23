// Per-skill experience level — set independently for the major skill and
// for each minor skill (see freelancer_skills.experience_level), so "I'm an
// Expert Photographer but only Beginner at Makeup Artist" is representable.
// Optional everywhere it's used; nothing forces a freelancer to rate a skill.
export const SKILL_EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Professional', 'Expert'] as const;
export type SkillExperienceLevel = (typeof SKILL_EXPERIENCE_LEVELS)[number];

export function isSkillExperienceLevel(value: unknown): value is SkillExperienceLevel {
  return typeof value === 'string' && (SKILL_EXPERIENCE_LEVELS as readonly string[]).includes(value);
}
