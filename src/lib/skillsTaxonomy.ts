// Controlled taxonomy for MINOR skills (a freelancer's additional
// capabilities beyond their major skill/category). This is a static mirror
// of the `skills` table seeded by supabase/freelancer_skills.sql — kept as
// a plain TS list (same pattern as src/lib/categories.ts's major-skill
// list) so the picker UI doesn't need a round trip just to render
// checkboxes. Skill names here must match `skills.name` exactly.
export interface SkillGroup {
  category: string;
  skills: string[];
}

export const MINOR_SKILL_GROUPS: SkillGroup[] = [
  {
    category: 'Photography',
    skills: ['Photographer', 'Portrait Photographer', 'Wedding Photographer', 'Product Photographer', 'Fashion Photographer', 'Event Photographer', 'Food Photographer', 'Photo Editor'],
  },
  {
    category: 'Videography',
    skills: ['Videographer', 'Cinematographer', 'Video Editor', 'Motion Graphics'],
  },
  {
    category: 'Design',
    skills: ['Graphic Designer', 'UI Designer', 'UX Designer', 'Brand Designer', 'Illustrator', '3D Designer', 'Motion Designer'],
  },
  {
    category: 'Beauty',
    skills: ['Makeup Artist', 'Hair Stylist', 'Nail Artist', 'Beauty Specialist'],
  },
  {
    category: 'Fashion',
    skills: ['Fashion Stylist', 'Fashion Designer', 'Costume Designer'],
  },
  {
    category: 'Writing',
    skills: ['Copywriter', 'Content Writer', 'Scriptwriter'],
  },
  {
    category: 'Audio',
    skills: ['Music Producer', 'Sound Designer', 'Audio Engineer'],
  },
  {
    category: 'Events',
    skills: ['Decorator / Florist', 'Cake / Dessert', 'DJ / Musician'],
  },
];

export const MAX_MINOR_SKILLS = 5;

export const ALL_MINOR_SKILLS = MINOR_SKILL_GROUPS.flatMap((group) => group.skills);

export function isKnownMinorSkill(name: string): boolean {
  return ALL_MINOR_SKILLS.includes(name);
}

// Per-skill experience level — set independently for the major skill and
// for each minor skill (see freelancer_skills.experience_level), so "I'm an
// Expert Photographer but only Beginner at Makeup Artist" is representable.
// Optional everywhere it's used; nothing forces a freelancer to rate a skill.
export const SKILL_EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Professional', 'Expert'] as const;
export type SkillExperienceLevel = (typeof SKILL_EXPERIENCE_LEVELS)[number];

export function isSkillExperienceLevel(value: unknown): value is SkillExperienceLevel {
  return typeof value === 'string' && (SKILL_EXPERIENCE_LEVELS as readonly string[]).includes(value);
}
