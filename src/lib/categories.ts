// Canonical taxonomy of CreativeHUB's freelancer categories — the ONE
// source of truth for every category picker, filter, and matcher in the
// app (onboarding, Edit Profile, Explore, Advanced Filter, Event Matcher,
// search). freelancer_profiles.title must always be set to exactly one of
// these labels — no free text, no other values.
export interface FreelancerCategoryDef {
  id: string;
  label: string;
  /** Suggested skill tags shown as quick-add chips for this category. */
  skills: string[];
  /**
   * Suggested style tags — what search/matching filters by within this
   * category. For Musician/Live Entertainment these are performer
   * subtypes (Solo Artist, Band, DJ, ...) rather than visual styles, reusing
   * the same field since the UI/matching treatment is identical.
   */
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
    id: 'videographer',
    label: 'Videographer',
    skills: ['Wedding Videography', 'Event Videography', 'Highlight Reels', 'Drone Videography', 'Cinematography', 'Video Editing', 'Live Streaming'],
    styles: ['Cinematic', 'Documentary', 'Vintage', 'Moody', 'Bright & Airy', 'Editorial', 'Minimalist'],
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
    id: 'decorator-florist',
    label: 'Decorator/Florist',
    skills: ['Event Decoration', 'Floral Arrangements', 'Bridal Bouquets', 'Backdrop Design', 'Balloon Styling', 'Table Centerpieces', 'Venue Styling'],
    styles: ['Minimalist', 'Elegant', 'Luxury', 'Rustic', 'Romantic', 'Modern', 'Bohemian', 'Traditional', 'Garden'],
  },
  {
    id: 'cake-dessert-maker',
    label: 'Cake/Dessert Maker',
    skills: ['Custom Cakes', 'Wedding Cakes', 'Cupcakes', 'Dessert Tables', 'Cake Decorating', 'Sugar Flowers', 'Cake Tasting'],
    styles: ['Elegant', 'Minimalist', 'Rustic', 'Modern', 'Whimsical', 'Luxury', 'Traditional'],
  },
  {
    id: 'musician-live-entertainment',
    label: 'Musician/Live Entertainment',
    skills: ['Live Performance', 'Wedding Ceremony Music', 'Reception Entertainment', 'MC Hosting', 'Sound Equipment', 'Song Requests', 'Custom Setlists'],
    styles: ['Solo Artist', 'Band', 'Singer/Vocalist', 'Acoustic Duo', 'Instrumentalist', 'DJ'],
  },
  {
    id: 'model',
    label: 'Model',
    skills: ['Fashion Modeling', 'Commercial Modeling', 'Product Modeling', 'Editorial Modeling', 'Runway Modeling', 'Event Modeling', 'Beauty Modeling', 'Photoshoot Modeling'],
    styles: ['Editorial', 'Streetwear', 'Elegant', 'High Fashion', 'Commercial', 'Minimalist', 'Luxury', 'Casual', 'Beauty'],
  },
];

export const FREELANCER_CATEGORY_LABELS = FREELANCER_CATEGORIES.map((category) => category.label);

// The fixed 8 categories the Event Matcher is ever allowed to recommend or
// match against (everything above except Model, which the event-planning
// flow has no use for). Order here is what every Event Matcher UI list
// follows.
export const EVENT_MATCHER_CATEGORY_LABELS = FREELANCER_CATEGORY_LABELS.filter(
  (label) => label !== 'Model'
) as readonly string[];

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
// category's standardized list, while still living on the freelancer's
// profile and being reachable through normal text search.
export function isStandardSkill(categoryLabel: string | null | undefined, skill: string): boolean {
  return suggestedSkillsForCategory(categoryLabel).includes(skill);
}

export function isStandardStyle(categoryLabel: string | null | undefined, style: string): boolean {
  return suggestedStylesForCategory(categoryLabel).includes(style);
}
