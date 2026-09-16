import { FREELANCER_CATEGORIES } from './categories';

// Common ways people phrase a search that should resolve to one of our
// canonical FREELANCER_CATEGORIES labels (freelancer_profiles.title is
// always set to exactly one of those labels, so this is what lets
// "photographer" or "mua" find someone whose title is literally
// "Photographer" / "Makeup Artist").
const CATEGORY_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: 'Photographer', aliases: ['photography', 'photographer', 'photographers', 'photo', 'photos'] },
  { label: 'Makeup Artist', aliases: ['makeup', 'makeup artist', 'mua', 'beauty'] },
  { label: 'Hair Stylist', aliases: ['hair', 'hairstylist', 'hair stylist', 'hairstyling', 'hairdresser'] },
  { label: 'Fashion Designer', aliases: ['fashion', 'fashion designer', 'designer', 'design'] },
  { label: 'Videographer', aliases: ['video', 'videography', 'videographer', 'videographers', 'cinematographer', 'cinematography'] },
  { label: 'Decorator/Florist', aliases: ['decorator', 'decorators', 'decoration', 'decor', 'florist', 'florists', 'flowers', 'floral', 'styling'] },
  { label: 'Cake/Dessert Maker', aliases: ['cake', 'cakes', 'dessert', 'desserts', 'bakery', 'baker', 'pastry'] },
  { label: 'Musician/Live Entertainment', aliases: ['dj', 'djs', 'musician', 'musicians', 'music', 'band', 'live band', 'entertainment', 'entertainer'] },
];

const STOPWORDS = new Set(['a', 'an', 'the', 'in', 'at', 'for', 'with', 'and', 'or', 'of', 'near', 'me']);

export interface InterpretedQuery {
  category: string | null;
  styleTerms: string[];
  remainingTerms: string[];
}

const EMPTY_QUERY: InterpretedQuery = { category: null, styleTerms: [], remainingTerms: [] };

/**
 * Turns a free-text search into Service / Style / Location-ish parts:
 * "wedding photographer" -> category=Photography, styleTerms=[Wedding Photography]
 * "makeup Bangkok"       -> category=Makeup, remainingTerms=[bangkok] (matched against location)
 * "cinematic"            -> no category; remainingTerms=[cinematic] (matched against free-text skills/styles)
 */
export function interpretSearchQuery(query: string): InterpretedQuery {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOPWORDS.has(w));

  if (words.length === 0) return EMPTY_QUERY;

  let category: string | null = null;
  const consumed = new Set<number>();

  outer: for (let i = 0; i < words.length; i++) {
    for (let span = 2; span >= 1; span--) {
      if (i + span > words.length) continue;
      const phrase = words.slice(i, i + span).join(' ');
      const match = CATEGORY_ALIASES.find((entry) => entry.aliases.includes(phrase));
      if (match) {
        category = match.label;
        for (let k = i; k < i + span; k++) consumed.add(k);
        break outer;
      }
    }
  }

  const specialtySource = category ? FREELANCER_CATEGORIES.filter((g) => g.label === category) : FREELANCER_CATEGORIES;
  const specialtyByWord = new Map<string, string>();
  for (const group of specialtySource) {
    for (const specialty of group.styles) {
      const lower = specialty.toLowerCase();
      specialtyByWord.set(lower, specialty);
      for (const w of lower.split(/\s+/)) {
        if (!specialtyByWord.has(w)) specialtyByWord.set(w, specialty);
      }
    }
  }

  const styleTerms: string[] = [];
  const remainingTerms: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (consumed.has(i)) continue;
    const word = words[i];
    const specialty = specialtyByWord.get(word);
    if (specialty) {
      if (!styleTerms.includes(specialty)) styleTerms.push(specialty);
    } else {
      remainingTerms.push(word);
    }
  }

  return { category, styleTerms, remainingTerms };
}

export interface FreelancerSearchable {
  title: string | null;
  skills: string[];
  styles: string[];
  /** Secondary capabilities beyond the major skill/title — see freelancer_skills. */
  minorSkills?: string[];
  /**
   * Musician/Live Entertainment only — performer format (Band, DJ, ...).
   * Kept out of `styles` (see categories.ts's performerType doc) since it's
   * not an aesthetic match signal, but still needs to be searchable —
   * checked alongside styles/skills below so "DJ" or "solo artist" still
   * finds the right providers.
   */
  performerType?: string[];
  description: string | null;
  location: string | null;
  fullName: string | null;
  /** 0-5 average rating — used to rank "just browsing" results by quality. */
  rating?: number;
  /** Total review count — a high rating from a handful of reviews shouldn't outrank a slightly lower one backed by dozens. */
  totalReviews?: number;
}

// Diminishing returns on review count (log scale) so going from 1 to 10
// reviews matters a lot more than going from 100 to 109 — a handful of great
// reviews shouldn't be drowned out by one freelancer who simply has more
// volume. Capped implicitly by the log curve rather than a hard ceiling.
function qualityScore(rating?: number, totalReviews?: number): number {
  const safeRating = Number.isFinite(rating) ? (rating as number) : 0;
  const safeReviews = Number.isFinite(totalReviews) ? (totalReviews as number) : 0;
  if (safeReviews <= 0) return 0;
  return safeRating * Math.log10(safeReviews + 1);
}

/**
 * Scores a freelancer against an interpreted query plus the client's
 * onboarding interests. 0 means "exclude"; higher is more relevant. When the
 * query is empty (browsing, no category selected) everyone still passes, but
 * the ranking is driven by review quality (rating x review volume) rather
 * than an arbitrary/insertion order — so a well-reviewed, frequently-booked
 * freelancer surfaces above a brand-new profile with zero reviews in
 * "Popular" sections. Interest matches still nudge the order on top of that.
 */
export function scoreFreelancerMatch(
  freelancer: FreelancerSearchable,
  interpreted: InterpretedQuery,
  clientInterests: string[] = []
): number {
  const { category, styleTerms, remainingTerms } = interpreted;
  const normTitle = (freelancer.title || '').toLowerCase();
  const normSkills = (freelancer.skills || []).map((s) => s.toLowerCase());
  const normStyles = (freelancer.styles || []).map((s) => s.toLowerCase());
  const normMinorSkills = (freelancer.minorSkills || []).map((s) => s.toLowerCase());
  const normPerformerType = (freelancer.performerType || []).map((s) => s.toLowerCase());
  const normLocation = (freelancer.location || '').toLowerCase();
  const normDescription = (freelancer.description || '').toLowerCase();
  const normName = (freelancer.fullName || '').toLowerCase();

  const interestBonus = freelancer.title && clientInterests.includes(freelancer.title) ? 1.5 : 0;
  const quality = qualityScore(freelancer.rating, freelancer.totalReviews);

  const hasQuery = Boolean(category) || styleTerms.length > 0 || remainingTerms.length > 0;
  if (!hasQuery) {
    return 1 + interestBonus + quality;
  }

  // Actively searching: relevance (below) stays the primary signal, so
  // quality only breaks ties between similarly-relevant results instead of
  // being able to outrank a much better keyword/category match.
  let score = interestBonus + quality * 0.2;

  if (category) {
    // A detected category (from a pill, or a word like "photographer") is a
    // hard requirement, not just one more signal — "makeup bangkok" must
    // mean Makeup freelancers in Bangkok, not any Bangkok freelancer.
    // Three tiers, not a binary match/exclude: an exact major-skill (title)
    // match ranks highest, a minor-skill match still surfaces the
    // freelancer but ranks below anyone whose major skill matches, and a
    // plain skills/styles tag mention ranks lowest of the three. Nobody is
    // excluded just for having the category as a minor skill instead of major.
    const normCategory = category.toLowerCase();
    if (normTitle === normCategory) {
      score += 10;
    } else if (normMinorSkills.includes(normCategory)) {
      score += 6;
    } else if (normSkills.includes(normCategory) || normStyles.includes(normCategory)) {
      score += 4;
    } else {
      return 0;
    }
  }

  for (const term of styleTerms) {
    const t = term.toLowerCase();
    if (normStyles.includes(t) || normSkills.includes(t) || normPerformerType.includes(t) || normTitle.includes(t)) score += 4;
  }

  for (const term of remainingTerms) {
    if (normLocation.includes(term)) score += 3;
    if (
      normSkills.some((s) => s.includes(term)) ||
      normStyles.some((s) => s.includes(term)) ||
      normPerformerType.some((s) => s.includes(term)) ||
      normDescription.includes(term) ||
      normTitle.includes(term) ||
      normName.includes(term)
    ) {
      score += 2;
    }
  }

  return score;
}
