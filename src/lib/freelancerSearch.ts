import { CATEGORY_GROUPS } from './categories';

// Common ways people phrase a search that should resolve to one of our
// canonical CATEGORY_GROUPS labels (freelancer_profiles.title is always set
// to one of those labels at onboarding, so this is what lets "photographer"
// find someone whose title is literally "Photography").
const CATEGORY_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: 'Photography', aliases: ['photography', 'photographer', 'photographers', 'photo', 'photos'] },
  { label: 'Videography', aliases: ['videography', 'videographer', 'videographers', 'video', 'film', 'cinematography', 'cinematographer'] },
  { label: 'Makeup', aliases: ['makeup', 'mua', 'beauty'] },
  { label: 'Hair Styling', aliases: ['hair', 'hairstylist', 'hairstyling', 'hairdresser'] },
  { label: 'Graphic Design', aliases: ['design', 'designer', 'graphic', 'branding', 'logo'] },
  { label: 'Illustration', aliases: ['illustration', 'illustrator'] },
  { label: 'UI/UX Design', aliases: ['ui', 'ux', 'ui/ux', 'uiux', 'product design'] },
  { label: 'Fashion Design', aliases: ['fashion'] },
  { label: 'Modeling', aliases: ['model', 'models', 'modeling', 'modelling'] },
  { label: 'Event Services', aliases: ['event', 'events', 'decor', 'decoration', 'planner', 'planning'] },
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

  const specialtySource = category ? CATEGORY_GROUPS.filter((g) => g.label === category) : CATEGORY_GROUPS;
  const specialtyByWord = new Map<string, string>();
  for (const group of specialtySource) {
    for (const specialty of group.specialties) {
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
  description: string | null;
  location: string | null;
  fullName: string | null;
}

/**
 * Scores a freelancer against an interpreted query plus the client's
 * onboarding interests. 0 means "exclude"; higher is more relevant. When the
 * query is empty (browsing, no category selected) everyone passes with a
 * neutral score, nudged up for interest matches so personalization still
 * shapes the default ordering without a search actually filtering anyone out.
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
  const normLocation = (freelancer.location || '').toLowerCase();
  const normDescription = (freelancer.description || '').toLowerCase();
  const normName = (freelancer.fullName || '').toLowerCase();

  const interestBonus = freelancer.title && clientInterests.includes(freelancer.title) ? 1.5 : 0;

  const hasQuery = Boolean(category) || styleTerms.length > 0 || remainingTerms.length > 0;
  if (!hasQuery) {
    return 1 + interestBonus;
  }

  let score = interestBonus;

  if (category) {
    // A detected category (from a pill, or a word like "photographer") is a
    // hard requirement, not just one more signal — "makeup bangkok" must
    // mean Makeup freelancers in Bangkok, not any Bangkok freelancer.
    const normCategory = category.toLowerCase();
    if (normTitle === normCategory) {
      score += 10;
    } else if (normSkills.includes(normCategory) || normStyles.includes(normCategory)) {
      score += 6;
    } else {
      return 0;
    }
  }

  for (const term of styleTerms) {
    const t = term.toLowerCase();
    if (normStyles.includes(t) || normSkills.includes(t) || normTitle.includes(t)) score += 4;
  }

  for (const term of remainingTerms) {
    if (normLocation.includes(term)) score += 3;
    if (
      normSkills.some((s) => s.includes(term)) ||
      normStyles.some((s) => s.includes(term)) ||
      normDescription.includes(term) ||
      normTitle.includes(term) ||
      normName.includes(term)
    ) {
      score += 2;
    }
  }

  return score;
}
