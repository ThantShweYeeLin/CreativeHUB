// Canonical taxonomy of freelancer categories and their per-category
// specialties. This is the single source of truth for sign-up/onboarding
// category pickers (freelancer services, client interests). The AI Matcher
// (server/src/routes/aiMatcher.ts) does NOT read this file — it builds its
// own taxonomy live from freelancer_profiles.title/styles — so as long as
// onboarding keeps writing title = one category label and styles = chosen
// specialty labels, this file is free to change shape independently.
export interface CategoryGroup {
  id: string;
  label: string;
  specialties: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'photography', label: 'Photography', specialties: ['Wedding Photography', 'Portrait Photography', 'Event Photography', 'Product Photography', 'Fashion Photography'] },
  { id: 'videography', label: 'Videography', specialties: ['Wedding Film', 'Commercial', 'Music Video', 'Event', 'Documentary'] },
  { id: 'makeup', label: 'Makeup', specialties: ['Bridal Makeup', 'Event Makeup', 'Editorial Makeup', 'Special Effects Makeup'] },
  { id: 'hair', label: 'Hair Styling', specialties: ['Bridal Hair', 'Event Hair', 'Styling', 'Colorist'] },
  { id: 'graphic-design', label: 'Graphic Design', specialties: ['Branding', 'Logo Design', 'Editorial', 'Packaging', 'Social Media'] },
  { id: 'illustration', label: 'Illustration', specialties: ['Character Design', 'Editorial Illustration', 'Concept Art', 'Digital Painting'] },
  { id: 'ui-ux', label: 'UI/UX Design', specialties: ['Web Design', 'App Design', 'Design Systems', 'Prototyping'] },
  { id: 'fashion', label: 'Fashion Design', specialties: ['Ready-to-Wear', 'Luxury', 'Couture', 'Streetwear', 'Costume'] },
  { id: 'modeling', label: 'Modeling', specialties: ['Fashion Model', 'Commercial Model', 'Event Model', 'Runway'] },
  { id: 'event-services', label: 'Event Services', specialties: ['Wedding Planning', 'Corporate Events', 'Floral Design', 'Theme Decoration'] },
  { id: 'other', label: 'Other', specialties: [] },
];

// Back-compat flat exports for any code (or future code) that only needs a
// simple list of category labels rather than the grouped/nested shape.
export const CATEGORIES = CATEGORY_GROUPS.map((group) => group.label);

export type Category = (typeof CATEGORIES)[number];

export const STYLES_BY_CATEGORY: Record<string, string[]> = Object.fromEntries(
  CATEGORY_GROUPS.map((group) => [group.label, group.specialties])
);

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value);
}
