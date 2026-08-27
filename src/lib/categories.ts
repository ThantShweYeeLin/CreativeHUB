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
  /** Suggested skill tags shown as quick-add chips when this service is selected. */
  commonSkills: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'photography',
    label: 'Photography',
    specialties: ['Wedding Photography', 'Portrait Photography', 'Event Photography', 'Product Photography', 'Fashion Photography'],
    commonSkills: ['Adobe Lightroom', 'Adobe Photoshop', 'Studio Lighting', 'Natural Light', 'Photo Retouching', 'Drone Photography'],
  },
  {
    id: 'videography',
    label: 'Videography',
    specialties: ['Wedding Film', 'Commercial', 'Music Video', 'Event', 'Documentary'],
    commonSkills: ['Adobe Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve', 'Color Grading', 'Drone Videography', 'Motion Graphics'],
  },
  {
    id: 'makeup',
    label: 'Makeup',
    specialties: ['Bridal Makeup', 'Event Makeup', 'Editorial Makeup', 'Special Effects Makeup'],
    commonSkills: ['Airbrush Makeup', 'Bridal Makeup', 'Special Effects (SFX)', 'Skin Prep', 'Contouring'],
  },
  {
    id: 'hair',
    label: 'Hair Styling',
    specialties: ['Bridal Hair', 'Event Hair', 'Styling', 'Colorist'],
    commonSkills: ['Hair Coloring', 'Updos', 'Extensions', 'Bridal Hair', 'Balayage'],
  },
  {
    id: 'graphic-design',
    label: 'Graphic Design',
    specialties: ['Branding', 'Logo Design', 'Editorial', 'Packaging', 'Social Media'],
    commonSkills: ['Adobe Illustrator', 'Adobe Photoshop', 'Figma', 'Typography', 'Brand Identity'],
  },
  {
    id: 'illustration',
    label: 'Illustration',
    specialties: ['Character Design', 'Editorial Illustration', 'Concept Art', 'Digital Painting'],
    commonSkills: ['Procreate', 'Adobe Illustrator', 'Character Design', 'Digital Painting', 'Storyboarding'],
  },
  {
    id: 'ui-ux',
    label: 'UI/UX Design',
    specialties: ['Web Design', 'App Design', 'Design Systems', 'Prototyping'],
    commonSkills: ['Figma', 'Adobe XD', 'Wireframing', 'Prototyping', 'User Research', 'Design Systems'],
  },
  {
    id: 'fashion',
    label: 'Fashion Design',
    specialties: ['Ready-to-Wear', 'Luxury', 'Couture', 'Streetwear', 'Costume'],
    commonSkills: ['Pattern Making', 'Draping', 'Sewing', 'Fabric Sourcing', 'Fashion Illustration'],
  },
  {
    id: 'modeling',
    label: 'Modeling',
    specialties: ['Fashion Model', 'Commercial Model', 'Event Model', 'Runway'],
    commonSkills: ['Runway Walk', 'Posing', 'Editorial Shoots', 'Commercial Print'],
  },
  {
    id: 'event-services',
    label: 'Event Services',
    specialties: ['Wedding Planning', 'Corporate Events', 'Floral Design', 'Theme Decoration'],
    commonSkills: ['Event Planning', 'Floral Design', 'Vendor Coordination', 'Budget Management'],
  },
  { id: 'other', label: 'Other', specialties: [], commonSkills: [] },
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

/** Suggested skill chips for the given set of selected service labels (custom, non-catalog services yield none). */
export function suggestedSkillsForServices(selectedServiceLabels: string[]): string[] {
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const label of selectedServiceLabels) {
    const group = CATEGORY_GROUPS.find((item) => item.label === label);
    if (!group) continue;
    for (const skill of group.commonSkills) {
      if (!seen.has(skill)) {
        seen.add(skill);
        suggestions.push(skill);
      }
    }
  }

  return suggestions;
}
