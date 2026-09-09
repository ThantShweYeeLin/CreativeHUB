// Rule-based / weighted-scoring logic for the Event Matcher. Deliberately
// has no AI/LLM call anywhere in this file — see the feature spec this was
// built from: recommendations come from a fixed base-priority table plus
// small, bounded budget/style adjustments, never from a model.
import { convertAmount } from './currency';
import { EVENT_MATCHER_CATEGORY_LABELS } from './categories';

export const EVENT_TYPES = ['Wedding', 'Birthday Party', 'Proposal', 'Graduation Celebration'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Curated event-level theme options (distinct from the per-category
// suggested styles in categories.ts, which mix in category-specific things
// like "Douyin Makeup" that don't make sense as an overall event theme).
export const EVENT_STYLE_OPTIONS = [
  'Elegant', 'Minimalist', 'Luxury', 'Rustic', 'Bohemian', 'Modern',
  'Vintage', 'Romantic', 'Garden', 'Traditional', 'Glamorous', 'Whimsical',
];

export const EVENT_SETTING_OPTIONS = ['Indoor', 'Outdoor', 'Garden', 'Beach', 'Ballroom', 'Rooftop'];

export type ServiceTier = 'essential' | 'recommended' | 'optional';

export type EventMatcherCategory = (typeof EVENT_MATCHER_CATEGORY_LABELS)[number];

// 0 = not relevant for this event type at all, 1 = optional, 2 = recommended,
// 3 = essential. Kept as a number internally so budget/style adjustments can
// shift a category by a bounded +/-1 step without a chain of if/else.
type TierLevel = 0 | 1 | 2 | 3;

const TIER_LEVEL_TO_NAME: Record<Exclude<TierLevel, 0>, ServiceTier> = {
  1: 'optional',
  2: 'recommended',
  3: 'essential',
};

// Draft base-priority table — which of the 8 fixed categories matter for
// each event type, and at what tier, before any budget/style adjustment.
// This is a first pass; confirm/correct the tiers with the project owner
// before relying on it.
const BASE_PRIORITY_TABLE: Record<EventType, Partial<Record<EventMatcherCategory, TierLevel>>> = {
  Wedding: {
    Photographer: 3,
    Videographer: 2,
    'Makeup Artist': 3,
    'Hair Stylist': 3,
    'Fashion Designer': 2,
    'Decorator/Florist': 3,
    'Cake/Dessert Maker': 2,
    'Musician/Live Entertainment': 2,
  },
  'Birthday Party': {
    Photographer: 2,
    Videographer: 1,
    'Makeup Artist': 1,
    'Hair Stylist': 1,
    'Fashion Designer': 1,
    'Decorator/Florist': 3,
    'Cake/Dessert Maker': 3,
    'Musician/Live Entertainment': 2,
  },
  Proposal: {
    Photographer: 3,
    Videographer: 2,
    'Makeup Artist': 2,
    'Hair Stylist': 1,
    'Fashion Designer': 1,
    'Decorator/Florist': 2,
    'Cake/Dessert Maker': 1,
    'Musician/Live Entertainment': 1,
  },
  'Graduation Celebration': {
    Photographer: 3,
    Videographer: 1,
    'Makeup Artist': 2,
    'Hair Stylist': 2,
    'Fashion Designer': 1,
    'Decorator/Florist': 2,
    'Cake/Dessert Maker': 2,
    'Musician/Live Entertainment': 1,
  },
};

// Below this total budget (normalized to USD so it's currency-agnostic,
// per event type since a "small" wedding budget and a "small" proposal
// budget are very different scales), every Recommended category is
// downgraded one tier to Optional. Essential categories are never touched
// by this rule. Draft thresholds — confirm/correct alongside the base
// priority table above.
const LOW_BUDGET_USD_THRESHOLD: Record<EventType, number> = {
  Wedding: 3000,
  'Birthday Party': 800,
  Proposal: 500,
  'Graduation Celebration': 600,
};

// Styles that make a Fashion Designer/Stylist more relevant than the base
// table alone assumes.
const FASHION_NUDGE_STYLES = new Set(['Luxury', 'Elegant', 'Avant-Garde', 'Glamorous', 'Formal', 'Editorial']);
// Styles/settings that make a Decorator/Florist more relevant.
const DECOR_NUDGE_STYLES = new Set(['Garden', 'Bohemian', 'Rustic', 'Romantic']);
const OUTDOOR_SETTING_PATTERN = /outdoor|garden|beach|park/i;

export interface RecommendCategoriesInput {
  eventType: EventType;
  /** Total event budget, in `currency`. */
  budget: number;
  currency: string;
  styles: string[];
  /** Free-text venue/setting preference, e.g. "Outdoor garden", "Ballroom". */
  setting: string;
}

export interface RecommendedCategories {
  essential: EventMatcherCategory[];
  recommended: EventMatcherCategory[];
  optional: EventMatcherCategory[];
}

function clampTier(level: number): TierLevel {
  return Math.max(0, Math.min(3, level)) as TierLevel;
}

export function recommendCategories(input: RecommendCategoriesInput): RecommendedCategories {
  const base = BASE_PRIORITY_TABLE[input.eventType] || {};
  const budgetUsd = convertAmount(input.budget, input.currency, 'USD');
  const isLowBudget = Number.isFinite(budgetUsd) && budgetUsd < LOW_BUDGET_USD_THRESHOLD[input.eventType];
  const hasFashionNudge = input.styles.some((style) => FASHION_NUDGE_STYLES.has(style));
  const hasDecorNudge = input.styles.some((style) => DECOR_NUDGE_STYLES.has(style)) || OUTDOOR_SETTING_PATTERN.test(input.setting || '');

  const levels = new Map<EventMatcherCategory, TierLevel>();
  for (const category of EVENT_MATCHER_CATEGORY_LABELS) {
    let level = (base[category] ?? 0) as TierLevel;

    // Budget-tier adjustment: only ever pulls Recommended down to Optional —
    // never touches Essential, never removes a category outright.
    if (isLowBudget && level === 2) {
      level = 1;
    }

    // Bounded (+/-1) style/setting nudges.
    if (category === 'Fashion Designer' && hasFashionNudge) {
      level = clampTier(level + 1);
    }
    if (category === 'Decorator/Florist' && hasDecorNudge) {
      level = clampTier(level + 1);
    }

    if (level > 0) {
      levels.set(category, level);
    }
  }

  const result: RecommendedCategories = { essential: [], recommended: [], optional: [] };
  for (const [category, level] of levels) {
    const tier = TIER_LEVEL_TO_NAME[level as Exclude<TierLevel, 0>];
    result[tier].push(category);
  }
  return result;
}

// BUDGET FIT

export interface BudgetLineItem {
  category: string;
  tier: ServiceTier;
  price: number;
}

export interface BudgetFitResult<T extends BudgetLineItem> {
  kept: T[];
  dropped: T[];
  total: number;
  remaining: number;
  fits: boolean;
}

/**
 * Sums selected package prices (all assumed to already be in one common
 * currency) against the total budget. If it doesn't fit, drops Optional
 * items first (cheapest-first within a tier, so the fewest items are cut),
 * then Recommended, and only ever touches Essential items as a last resort
 * so the caller can show that clearly rather than silently dropping them.
 */
export function computeBudgetFit<T extends BudgetLineItem>(items: T[], totalBudget: number): BudgetFitResult<T> {
  const dropOrder: ServiceTier[] = ['optional', 'recommended', 'essential'];
  const kept = [...items];
  const dropped: T[] = [];

  const sumOf = (list: T[]) => list.reduce((sum, item) => sum + item.price, 0);

  for (const tier of dropOrder) {
    if (sumOf(kept) <= totalBudget) break;

    const tierItems = kept.filter((item) => item.tier === tier).sort((a, b) => a.price - b.price);
    for (let i = tierItems.length - 1; i >= 0 && sumOf(kept) > totalBudget; i--) {
      const victim = tierItems[i];
      const index = kept.indexOf(victim);
      if (index !== -1) {
        kept.splice(index, 1);
        dropped.push(victim);
      }
    }
  }

  const total = sumOf(kept);
  return { kept, dropped, total, remaining: totalBudget - total, fits: total <= totalBudget };
}

// LOCATION COVERAGE

export interface LocationPointLike {
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  city?: string | null;
  district?: string | null;
}

// Course-project scale, no per-provider configured service radius is wired
// up anywhere in the app today (freelancer_profiles.service_radius_km is
// unused dead data — providers instead list preferred locations), so this
// is a flat, generous default "do these two points count as the same
// service area" distance rather than a per-provider setting.
const DEFAULT_COVERAGE_RADIUS_KM = 60;

function haversineDistanceKm(a: LocationPointLike, b: LocationPointLike): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

/**
 * Whether a provider's saved locations (freelancer_profiles.locations +
 * studio_locations) cover the event location — never assumes a provider
 * travels anywhere it hasn't listed. Prefers real lat/lng distance; falls
 * back to a loose city/district text match for older rows that were
 * migrated from plain text and have null coordinates (see
 * supabase/locations_to_structured_jsonb.sql).
 */
export function locationCovers(providerLocations: LocationPointLike[], eventLocation: LocationPointLike): boolean {
  if (providerLocations.length === 0) return false;

  return providerLocations.some((providerPoint) => {
    const distanceKm = haversineDistanceKm(providerPoint, eventLocation);
    if (distanceKm !== null) return distanceKm <= DEFAULT_COVERAGE_RADIUS_KM;

    const eventText = `${eventLocation.city || ''} ${eventLocation.district || ''} ${eventLocation.formattedAddress || ''}`.toLowerCase();
    const providerCity = (providerPoint.city || '').toLowerCase();
    const providerDistrict = (providerPoint.district || '').toLowerCase();
    if (!eventText.trim()) return false;
    return (providerCity && eventText.includes(providerCity)) || (providerDistrict && eventText.includes(providerDistrict));
  });
}

// CANDIDATE RANKING

export interface EventMatcherCandidate {
  userId: string;
  freelancerProfileId: string;
  fullName: string;
  styles: string[];
  rating: number;
  totalReviews: number;
  experienceYears: number | null;
  packagePrice: number | null;
  packageCurrency: string;
}

/**
 * Ranks an available, in-area candidate for one category against the
 * client's requested styles/budget — higher is better. Availability and
 * location coverage are hard filters applied before this ever runs (a
 * candidate that fails either is excluded, not scored low).
 */
export function scoreEventCandidate(
  candidate: EventMatcherCandidate,
  input: { styles: string[]; budgetForCategory: number }
): number {
  let score = 0;

  const styleOverlap = candidate.styles.filter((style) => input.styles.includes(style)).length;
  score += styleOverlap * 4;

  if (candidate.packagePrice != null && input.budgetForCategory > 0) {
    const ratio = candidate.packagePrice / input.budgetForCategory;
    if (ratio <= 1) {
      // Reward being close to (not just under) the per-category budget —
      // a package at 90% of budget beats one at 30% of it, all else equal.
      score += ratio * 3;
    } else {
      // Over budget still gets ranked (budget-fit dropping happens later,
      // separately, once a single top match per category is picked) but
      // is penalized in proportion to the overage.
      score -= (ratio - 1) * 3;
    }
  }

  score += Math.min(candidate.rating, 5) * 2;
  score += Math.log10(candidate.totalReviews + 1);
  score += Math.min(candidate.experienceYears ?? 0, 15) * 0.1;

  return score;
}
