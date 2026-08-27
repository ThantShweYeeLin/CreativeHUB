// Canonical list of freelancer categories and their per-category styles.
// This is the single source of truth for both the "Become a Freelancer" form
// and the AI Matcher — the AI is only ever allowed to pick values from here.
export const CATEGORIES = [
  'Photographer',
  'Videographer',
  'Graphic Designer',
  'Makeup Artist',
  'Hair Stylist',
  'Fashion Designer',
  'Model',
  'Event Decoration',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STYLES_BY_CATEGORY: Record<Category, string[]> = {
  Photographer: ['Wedding', 'Portrait', 'Fashion', 'Food', 'Commercial'],
  Videographer: ['Wedding Film', 'Commercial', 'Music Video', 'Event', 'Documentary'],
  'Graphic Designer': ['Branding', 'Editorial', 'Packaging', 'Social Media', 'Illustration'],
  'Makeup Artist': ['Bridal', 'Editorial', 'Special Effects', 'Runway', 'Beauty'],
  'Hair Stylist': ['Bridal', 'Runway', 'Colorist', 'Editorial', 'Studio'],
  'Fashion Designer': ['Ready-to-Wear', 'Luxury', 'Couture', 'Streetwear', 'Costume'],
  Model: ['Runway', 'Editorial', 'E-commerce', 'Commercial', 'Beauty'],
  'Event Decoration': ['Weddings', 'Corporate', 'Floral', 'Theme', 'Luxury Setup'],
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
