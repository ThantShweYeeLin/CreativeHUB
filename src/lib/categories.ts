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
   * Suggested style/genre tags — an aesthetic descriptor of the work
   * itself, comparable against a client's chosen event style/theme (see
   * lib/eventMatcher.ts's scoreEventCandidate). For Musician/Live
   * Entertainment these are music genres (Pop, Jazz, Rock, ...), not
   * performer format — that lives in `performerType` instead, since a
   * performer format (Band, DJ, ...) isn't an aesthetic match signal the
   * way a genre or visual style is.
   */
  styles: string[];
  /**
   * Suggested performer-format tags — only populated for Musician/Live
   * Entertainment. Deliberately excluded from style-overlap scoring;
   * see the `styles` doc comment above.
   */
  performerType?: string[];
}

export const FREELANCER_CATEGORIES: FreelancerCategoryDef[] = [
  {
    id: 'photographer',
    label: 'Photographer',
    skills: ['Portrait Photography', 'Wedding Photography', 'Event Photography', 'Couple Photography', 'Graduation Photography', 'Photo Editing', 'Retouching', 'Studio Photography'],
    styles: ['Romantic', 'Bright & Airy', 'Moody', 'Vintage', 'Editorial', 'Minimalist', 'Natural', 'Luxury', 'Documentary', 'Dramatic', 'Elegant', 'Modern', 'Glamorous', 'Traditional'],
  },
  {
    id: 'videographer',
    label: 'Videographer',
    skills: ['Wedding Videography', 'Event Videography', 'Highlight Video', 'Couple Video', 'Proposal Video', 'Video Editing', 'Short-form Video'],
    styles: ['Cinematic', 'Documentary', 'Vintage', 'Moody', 'Bright & Airy', 'Editorial', 'Minimalist', 'Elegant', 'Luxury', 'Romantic', 'Modern', 'Traditional'],
  },
  {
    id: 'makeup-artist',
    label: 'Makeup Artist',
    skills: ['Makeup Application', 'Bridal Makeup', 'Eye Makeup', 'False Lash Application', 'Event Makeup', 'Photoshoot Makeup', 'Airbrush Makeup'],
    styles: ['Douyin Makeup', 'Soft Glam', 'Natural Glam', 'Bridal Glam', 'Korean-Inspired', 'Chinese-Inspired', 'Glitter Makeup', 'Bold Glam', 'Minimal Makeup', 'Editorial Makeup', 'Smokey Glam', 'Dewy Makeup', 'Elegant', 'Romantic', 'Glamorous', 'Vintage', 'Minimalist'],
  },
  {
    id: 'hair-stylist',
    label: 'Hair Stylist',
    skills: ['Hair Styling', 'Bridal Hairstyling', 'Braiding', 'Updos', 'Blowout', 'Event Hairstyling', 'Hair Extensions Styling'],
    styles: ['Korean-Inspired', 'Elegant', 'Romantic', 'Y2K', 'Natural', 'Glamorous', 'Vintage', 'Modern', 'Bridal', 'Sleek', 'Messy/Textured', 'Soft Waves', 'Bohemian', 'Traditional'],
  },
  {
    id: 'fashion-designer',
    label: 'Fashion Designer',
    skills: ['Custom Dress Design', 'Custom Outfit Design', 'Bridal Wear Design', 'Evening Wear Design', 'Formal Wear Design', 'Costume Design', 'Alterations & Fitting', 'Fashion Consultation', 'Styling', 'Garment Fitting'],
    styles: ['Minimalist', 'Elegant', 'Luxury', 'Vintage', 'Traditional', 'Modern', 'Romantic', 'Avant-Garde', 'Streetwear', 'Classic', 'Glamorous', 'Contemporary', 'Bohemian'],
  },
  {
    id: 'decorator-florist',
    label: 'Decorator',
    // 'Florist' is a suggested skill here (not its own category) — a
    // Decorator's floral work is one specialty among several, same as
    // 'Balloon Decoration' or 'Backdrop Setup'.
    skills: ['Florist', 'Event Decoration', 'Floral Arrangement', 'Backdrop Setup', 'Table Decoration', 'Proposal Setup', 'Wedding Decoration', 'Balloon Decoration', 'Bridal Bouquets'],
    styles: ['Romantic', 'Minimalist', 'Luxury', 'Vintage', 'Modern', 'Elegant', 'Cute', 'Floral', 'Rustic', 'Bohemian', 'Garden', 'Traditional', 'Glamorous', 'Whimsical'],
  },
  {
    id: 'cake-dessert-maker',
    label: 'Cake/Dessert Maker',
    skills: ['Custom Cakes', 'Wedding Cakes', 'Cupcakes', 'Dessert Tables', 'Cake Decorating', 'Sugar Flowers', 'Cake Tasting'],
    styles: ['Elegant', 'Minimalist', 'Rustic', 'Modern', 'Whimsical', 'Luxury', 'Traditional', 'Floral', 'Vintage', 'Romantic', 'Glamorous'],
  },
  {
    id: 'musician-live-entertainment',
    label: 'Musician',
    // 'Live Entertainment' is a suggested skill here (not its own
    // category) — same pattern as 'Florist' under Decorator.
    skills: ['Live Entertainment', 'Live Performance', 'Acoustic Set', 'Wedding Ceremony Music', 'Cover Songs', 'Song Requests', 'Custom Setlists', 'Sound Equipment', 'Vocals/Singing', 'Guitar', 'Piano/Keyboard', 'Violin'],
    styles: ['Pop', 'Acoustic', 'Romantic', 'Jazz', 'Classical', 'R&B', 'Rock'],
    performerType: ['Solo Artist', 'Band', 'Singer/Vocalist', 'Acoustic Duo', 'Instrumentalist', 'DJ'],
  },
];

export const FREELANCER_CATEGORY_LABELS = FREELANCER_CATEGORIES.map((category) => category.label);

// The one category with a performerType list — used to conditionally show
// the performer-format picker in onboarding/Edit Profile and to decide
// whether search should also check performerType (see freelancerSearch.ts).
export const MUSICIAN_CATEGORY_LABEL = 'Musician';

// A freelancer can be "also skilled in" more than one other category (each
// with its own skills/styles/performer-type suggestions and experience
// level) - capped so onboarding doesn't turn into selecting every category.
export const MAX_MINOR_CATEGORIES = 3;

// Historically excluded Model from the Event Matcher while Model was still
// a valid category; Model has since been removed from FREELANCER_CATEGORIES
// entirely (see supabase/remove_model_category.sql), so this is now simply
// every category — kept as its own export since Event Matcher call sites
// already depend on this name.
export const EVENT_MATCHER_CATEGORY_LABELS = FREELANCER_CATEGORY_LABELS as readonly string[];

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

/** Suggested performer-format chips — non-empty only for Musician. */
export function suggestedPerformerTypesForCategory(categoryLabel: string | null | undefined): string[] {
  return getFreelancerCategory(categoryLabel || undefined)?.performerType ?? [];
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
