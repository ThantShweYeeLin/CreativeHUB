// Canonical taxonomy of CreativeHUB's freelancer categories — the ONE
// source of truth for every category picker, filter, and matcher in the
// app (onboarding, Edit Profile, Explore, Advanced Filter, AI Matcher,
// search). freelancer_profiles.title must always be set to exactly one of
// these five labels — no free text, no other values.
//
// server/src/routes/aiMatcher.ts is a separately-built TS project
// (server/tsconfig.json has its own rootDir) and can't import this file
// directly, so it keeps its own copy of this same taxonomy in sync by hand.
export interface FreelancerCategoryDef {
  id: string;
  label: string;
  /** Suggested skill tags shown as quick-add chips for this category. */
  skills: string[];
  /** Suggested style tags — what the AI Matcher searches by within this category. */
  styles: string[];
}

export const FREELANCER_CATEGORIES: FreelancerCategoryDef[] = [
  {
    id: 'photographer',
    label: 'Photographer',
    skills: ['Portrait Photography', 'Wedding Photography', 'Event Photography', 'Product Photography', 'Fashion Photography', 'Lifestyle Photography', 'Photo Editing'],
    styles: ['Cinematic', 'Bright & Airy', 'Moody', 'Vintage', 'Editorial', 'Minimalist', 'Natural', 'Luxury', 'Documentary'],
  },
  {
    id: 'makeup-artist',
    label: 'Makeup Artist',
    skills: ['Makeup Application', 'Bridal Makeup', 'Eye Makeup', 'False Lash Application', 'Contouring', 'Base Makeup', 'Event Makeup'],
    styles: ['Douyin Makeup', 'Soft Glam', 'Natural Glam', 'Bridal Glam', 'Korean-Inspired', 'Chinese-Inspired', 'Glitter Makeup', 'Bold Glam', 'Minimal Makeup'],
  },
  {
    id: 'hair-stylist',
    label: 'Hair Stylist',
    skills: ['Hair Styling', 'Bridal Hairstyling', 'Braiding', 'Hair Curling', 'Hair Straightening', 'Updos', 'Hair Coloring', 'Event Hairstyling'],
    styles: ['Korean-Inspired', 'Elegant', 'Romantic', 'Y2K', 'Natural', 'Glamorous', 'Vintage', 'Modern', 'Bridal'],
  },
  {
    id: 'fashion-designer',
    label: 'Fashion Designer',
    skills: ['Custom Dress Design', 'Bridal Wear', 'Evening Wear', 'Formal Wear', 'Costume Design', 'Alterations & Fitting', 'Fashion Consultation', 'Custom Outfit Design'],
    styles: ['Minimalist', 'Elegant', 'Luxury', 'Vintage', 'Traditional', 'Modern', 'Romantic', 'Avant-Garde', 'Streetwear'],
  },
  {
    id: 'model',
    label: 'Model',
    skills: ['Fashion Modeling', 'Commercial Modeling', 'Product Modeling', 'Editorial Modeling', 'Runway Modeling', 'Event Modeling', 'Beauty Modeling', 'Photoshoot Modeling'],
    styles: ['Editorial', 'Streetwear', 'Elegant', 'High Fashion', 'Commercial', 'Minimalist', 'Luxury', 'Casual', 'Beauty'],
  },
];

export const FREELANCER_CATEGORY_LABELS = FREELANCER_CATEGORIES.map((category) => category.label);

export type FreelancerCategory = (typeof FREELANCER_CATEGORY_LABELS)[number];

export function isFreelancerCategory(value: string | null | undefined): value is FreelancerCategory {
  return !!value && FREELANCER_CATEGORY_LABELS.includes(value as FreelancerCategory);
}

export function getFreelancerCategory(label: string | null | undefined): FreelancerCategoryDef | undefined {
  return FREELANCER_CATEGORIES.find((category) => category.label === label);
}

export const STYLES_BY_CATEGORY: Record<string, string[]> = Object.fromEntries(
  FREELANCER_CATEGORIES.map((category) => [category.label, category.styles])
);

/** Suggested skill chips for a single selected category (unsupported/empty label yields none). */
export function suggestedSkillsForCategory(categoryLabel: string | null | undefined): string[] {
  return getFreelancerCategory(categoryLabel || undefined)?.skills ?? [];
}

/** Suggested style chips for a single selected category. */
export function suggestedStylesForCategory(categoryLabel: string | null | undefined): string[] {
  return getFreelancerCategory(categoryLabel || undefined)?.styles ?? [];
}

// Custom (user-typed, via "+ Other") skills/styles are never written to any
// separate column — a value simply IS custom if it doesn't appear in its
// category's standardized list. This is what keeps the AI Matcher's fixed
// taxonomy (server/src/routes/aiMatcher.ts's TAXONOMY) safe from arbitrary
// user text: the matcher only ever offers standardized styles as an output
// enum, so a custom style can never surface there, while still living on
// the freelancer's profile and being reachable through normal text search.
export function isStandardSkill(categoryLabel: string | null | undefined, skill: string): boolean {
  return suggestedSkillsForCategory(categoryLabel).includes(skill);
}

export function isStandardStyle(categoryLabel: string | null | undefined, style: string): boolean {
  return suggestedStylesForCategory(categoryLabel).includes(style);
}
