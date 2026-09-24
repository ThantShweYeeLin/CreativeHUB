import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2,
  ChevronLeft,
  Gem,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  List,
  MapPin,
  Megaphone,
  Minus,
  PackageX,
  PartyPopper,
  Plus,
  Search,
  Sparkles,
  Sun,
  TreePine,
  Trash2,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { TagSelector } from '../../components/common/TagSelector';
import { LeafletLocationPicker, type LocationPoint } from '../../components/common/LeafletLocationPicker';
import { LeafletLocationPreview } from '../../components/common/LeafletLocationPreview';
import { Calendar } from '../components/ui/calendar';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { EVENT_MATCHER_CATEGORY_LABELS } from '../../lib/categories';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { SUPPORTED_CURRENCIES, appendBudgetMeta, type BudgetMeta } from '../../lib/requestBudget';
import { appendScheduleMeta, formatTimeLabel, generateTimeSlots } from '../../lib/requestSchedule';
import { appendLocationMeta } from '../../lib/requestLocation';
import { isFreelancerFreeOnDate } from '../../lib/availability';
import { chipClass, FIELD_LABEL_CLASS, INPUT_CONTAINER_CLASS } from '../../lib/formFieldStyles';
import {
  EVENT_SETTING_OPTIONS,
  EVENT_STYLE_OPTIONS,
  EVENT_TYPES,
  computeBudgetFit,
  locationCovers,
  recommendCategories,
  scoreEventCandidate,
  type BudgetLineItem,
  type EventMatcherCandidate,
  type EventType,
  type LocationPointLike,
  type RecommendedCategories,
  type ServiceTier,
} from '../../lib/eventMatcher';

interface EventMatcherPageProps {
  onBack: () => void;
}

type WizardStep = 'input' | 'recommendations' | 'plan';

interface RankedCandidate extends EventMatcherCandidate {
  avatarUrl: string | null;
  serviceName: string;
  score: number;
  isPremium: boolean;
}

interface CategoryMatch {
  category: string;
  tier: ServiceTier;
  candidates: RankedCandidate[];
  // null = no freelancer assigned to this service (either none were found,
  // or the user cleared their selection) — the service still stays in the
  // plan so it can be filled in later, or left open for Premium freelancers
  // to apply to if the plan is opened up.
  selectedIndex: number | null;
}

interface PlanLineItem extends BudgetLineItem {
  userId: string;
  fullName: string;
}

const TIER_LABEL: Record<ServiceTier, string> = { essential: 'Essential', recommended: 'Recommended', optional: 'Optional' };
const TIER_ORDER: ServiceTier[] = ['essential', 'recommended', 'optional'];

const EVENT_TYPE_ICONS: Record<EventType, LucideIcon> = {
  Wedding: Heart,
  'Birthday Party': PartyPopper,
  Proposal: Gem,
  'Graduation Celebration': GraduationCap,
};

const VENUE_SETTING_ICONS: Record<string, LucideIcon> = {
  Indoor: Home,
  Outdoor: Sun,
  Garden: TreePine,
  Beach: Waves,
  Ballroom: Landmark,
  Rooftop: Building2,
};

// Placeholder quick-fill amounts (THB) — swap for real usage data later.
const BUDGET_QUICK_AMOUNTS = [15000, 35000, 50000, 75000, 120000];

// Full-day range in 30-minute steps — used for both the overall event
// time and each matched category's own arrival-time picker.
const EVENT_TIME_SLOTS = generateTimeSlots('06:00', '23:30');

function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatEventDate(value: string): string {
  const parsed = parseDateInputValue(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Builds a ranked-candidate list from one fetched profile set (either the
// Premium-only response or the no-Premium-filter "any" one) - date
// availability, location coverage, having a set price, and scoring are
// identical either way; only which freelancers were fetched (and the
// isPremium tag applied here) differs.
function buildRankedCandidates(
  profiles: any[],
  blockedDates: any[],
  bookings: any[],
  category: string,
  date: string,
  eventLocation: LocationPointLike,
  currency: string,
  styles: string[],
  budgetForCategory: number,
  isPremium: boolean
): RankedCandidate[] {
  const blockedByProfile = new Map<string, Array<{ blocked_date: string }>>();
  for (const row of blockedDates) {
    const list = blockedByProfile.get(row.freelancer_id) || [];
    list.push(row);
    blockedByProfile.set(row.freelancer_id, list);
  }
  const bookingsByUser = new Map<string, any[]>();
  for (const row of bookings) {
    const list = bookingsByUser.get(row.freelancer_id) || [];
    list.push(row);
    bookingsByUser.set(row.freelancer_id, list);
  }

  const candidates: RankedCandidate[] = [];
  for (const profile of profiles) {
    const isFree = isFreelancerFreeOnDate(bookingsByUser.get(profile.user_id) || [], blockedByProfile.get(profile.id) || [], date);
    if (!isFree) continue;

    const providerLocations: LocationPointLike[] = [
      ...(Array.isArray(profile.locations) ? profile.locations : []),
      ...(Array.isArray(profile.studio_locations) ? profile.studio_locations : []),
    ];
    if (!locationCovers(providerLocations, eventLocation)) continue;

    let packagePrice: number | null = null;
    let serviceName = category;
    if (profile.hourly_rate != null) {
      const rateCurrency = normalizeCurrencyCode(profile.users?.preferred_currency, 'THB');
      packagePrice = convertAmount(Number(profile.hourly_rate), rateCurrency, currency);
      serviceName = 'Hourly rate';
    }
    if (packagePrice == null) continue;

    const candidate: RankedCandidate = {
      userId: profile.user_id,
      freelancerProfileId: profile.id,
      fullName: profile.users?.full_name || 'Freelancer',
      avatarUrl: profile.users?.avatar_url || null,
      styles: Array.isArray(profile.styles) ? profile.styles : [],
      rating: Number(profile.users?.rating) || 0,
      totalReviews: Number(profile.users?.total_reviews) || 0,
      experienceYears: profile.experience_years ?? null,
      packagePrice,
      packageCurrency: currency,
      serviceName,
      score: 0,
      isPremium,
    };
    candidate.score = scoreEventCandidate(candidate, { styles, budgetForCategory });
    candidates.push(candidate);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// Restores an in-progress plan after navigating away (e.g. tapping a
// matched freelancer's avatar to view their profile) and back - without
// this, EventMatcherPage is plain component state that fully resets on
// every remount, silently discarding whatever the client had already
// built. sessionStorage (not localStorage) so a truly new browser session
// starts clean; cleared once the plan is actually acted on (sent, or
// opened to Premium freelancers to apply).
const DRAFT_STORAGE_KEY = 'creativehub.eventMatcher.draft';
// Bumped whenever a change would make an old cached draft behave
// differently than a fresh match would (e.g. the picker's candidate cap) -
// otherwise a draft saved before such a change keeps replaying its old
// results indefinitely, since resuming never re-fetches on its own.
const DRAFT_SCHEMA_VERSION = 2;

interface EventMatcherDraft {
  version: number;
  step: WizardStep;
  eventType: EventType | '';
  date: string;
  eventTime: string;
  budget: string;
  currency: string;
  styles: string[];
  setting: string;
  location: LocationPoint | null;
  recommended: RecommendedCategories | null;
  categoryTierEntries: Array<[string, ServiceTier]>;
  selectedCategories: string[];
  categoryMatches: CategoryMatch[];
  categoryTimes: Record<string, string>;
  categoryOffers: Record<string, number>;
}

function loadEventMatcherDraft(): EventMatcherDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EventMatcherDraft;
    return parsed.version === DRAFT_SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function clearEventMatcherDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function EventMatcherPage({ onBack }: EventMatcherPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();

  // Parsed once per mount (including a fresh mount after navigating back
  // from a profile page) - every initial state below reads from this same
  // snapshot instead of each re-parsing sessionStorage independently.
  const draft = useMemo(() => loadEventMatcherDraft(), []);

  const [step, setStep] = useState<WizardStep>(draft?.step || 'input');

  // Event input
  const [eventType, setEventType] = useState<EventType | ''>(draft?.eventType || '');
  const [date, setDate] = useState(draft?.date || '');
  const [eventTime, setEventTime] = useState(draft?.eventTime || '12:00');
  const [budget, setBudget] = useState(draft?.budget || String(BUDGET_QUICK_AMOUNTS[2]));
  const [currency, setCurrency] = useState(draft?.currency || normalizeCurrencyCode(preferredCurrency));
  const [styles, setStyles] = useState<string[]>(draft?.styles || []);
  const [setting, setSetting] = useState(draft?.setting || '');
  const [location, setLocation] = useState<LocationPoint | null>(draft?.location || null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Recommendations
  const [recommended, setRecommended] = useState<RecommendedCategories | null>(draft?.recommended || null);
  const [categoryTier, setCategoryTier] = useState<Map<string, ServiceTier>>(new Map(draft?.categoryTierEntries || []));
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(draft?.selectedCategories || []));

  // Matching / plan
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [categoryMatches, setCategoryMatches] = useState<CategoryMatch[]>(draft?.categoryMatches || []);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // Per-category arrival time — defaults to eventTime when matching runs,
  // but each provider may need to be there at a different time (e.g. the
  // makeup artist arrives hours before the ceremony itself).
  const [categoryTimes, setCategoryTimes] = useState<Record<string, string>>(draft?.categoryTimes || {});
  // What the client is offering to pay for each service - set as soon as a
  // category is matched (defaulting to the top candidate's rate, or an
  // even budget share if nobody matched at all) and freely editable from
  // there, independent of which candidate is selected or whether anyone is
  // selected at all - a category with no one picked can still carry a
  // price, since it may go out as an open request with no assigned
  // freelancer. Never auto-changed when switching candidates or clearing
  // one; only the client's own typing changes it (see setOfferAmount).
  const [categoryOffers, setCategoryOffers] = useState<Record<string, number>>(draft?.categoryOffers || {});
  // Filters the expanded "choose a freelancer" list by name - reset
  // whenever a different category's list is opened.
  const [candidateSearch, setCandidateSearch] = useState('');
  const [addingCategories, setAddingCategories] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayDateString = new Date().toISOString().slice(0, 10);
  const todayDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const budgetNumber = Number(budget) || 0;

  // Persists the whole in-progress plan on every change so it survives a
  // navigation away and back (see loadEventMatcherDraft above).
  useEffect(() => {
    const toSave: EventMatcherDraft = {
      version: DRAFT_SCHEMA_VERSION,
      step,
      eventType,
      date,
      eventTime,
      budget,
      currency,
      styles,
      setting,
      location,
      recommended,
      categoryTierEntries: Array.from(categoryTier.entries()),
      selectedCategories: Array.from(selectedCategories),
      categoryMatches,
      categoryTimes,
      categoryOffers,
    };
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      /* ignore */
    }
  }, [step, eventType, date, eventTime, budget, currency, styles, setting, location, recommended, categoryTier, selectedCategories, categoryMatches, categoryTimes, categoryOffers]);

  const handleLocationPicked = (point: LocationPoint) => {
    setLocation(point);
    setIsLocationPickerOpen(false);
  };

  const handleGetRecommendations = () => {
    setInputError(null);

    if (!eventType) return setInputError('Choose an event type.');
    if (!date) return setInputError('Choose an event date.');
    if (date < todayDateString) return setInputError('Choose a date that hasn\'t passed yet.');
    if (!eventTime) return setInputError('Choose an event time.');
    if (budgetNumber <= 0) return setInputError('Enter your total budget.');
    if (!location) return setInputError('Choose the event location.');

    const rec = recommendCategories({ eventType, budget: budgetNumber, currency, styles, setting });
    const tierMap = new Map<string, ServiceTier>();
    for (const category of rec.essential) tierMap.set(category, 'essential');
    for (const category of rec.recommended) tierMap.set(category, 'recommended');
    for (const category of rec.optional) tierMap.set(category, 'optional');

    setRecommended(rec);
    setCategoryTier(tierMap);
    setSelectedCategories(new Set([...rec.essential, ...rec.recommended]));
    setStep('recommendations');
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setCategoryTier((current) => {
      if (current.has(category)) return current;
      const next = new Map(current);
      next.set(category, 'optional');
      return next;
    });
  };

  // Fetches and ranks candidates for one category - shared by the initial
  // "Find My Event Team" match and by adding a service after the fact from
  // the plan step. Always fetches both the Premium-only set and the
  // no-Premium-filter "any" set, then merges Premium candidates first
  // (by score) followed by free candidates (also by score, and only those
  // not already counted as Premium) - so Premium freelancers are always
  // recommended first, and free ones only fill in the rest of the list
  // when there aren't enough (or any) Premium options, rather than either
  // showing Premium-only or free-only depending on which fetch happened
  // to run.
  const matchCategory = async (category: string, tier: ServiceTier, categoryCount: number): Promise<CategoryMatch> => {
    if (!location) return { category, tier, candidates: [], selectedIndex: 0 };

    const eventLocation: LocationPointLike = {
      latitude: location.latitude,
      longitude: location.longitude,
      formattedAddress: location.formattedAddress,
      city: location.city ?? null,
      district: location.district ?? null,
    };
    const budgetForCategory = budgetNumber / Math.max(1, categoryCount);

    const [premiumResponse, anyResponse] = await Promise.all([
      DataService.getEventMatcherCandidates(category, date),
      DataService.getEventMatcherCandidatesAny(category, date),
    ]);

    const premiumCandidates = buildRankedCandidates(
      premiumResponse.data.profiles as any[],
      premiumResponse.data.blockedDates,
      premiumResponse.data.bookings,
      category,
      date,
      eventLocation,
      currency,
      styles,
      budgetForCategory,
      true
    );
    const premiumIds = new Set(premiumCandidates.map((c) => c.userId));

    const freeCandidates = buildRankedCandidates(
      (anyResponse.data.profiles as any[]).filter((profile) => !premiumIds.has(profile.user_id)),
      anyResponse.data.blockedDates,
      anyResponse.data.bookings,
      category,
      date,
      eventLocation,
      currency,
      styles,
      budgetForCategory,
      false
    );

    // Premium first, free only filling in what's left - capped at 3 so the
    // picker stays a short, real "who should I pick" choice instead of a
    // long list to scroll.
    const ranked = [...premiumCandidates, ...freeCandidates].slice(0, 3);
    return { category, tier, candidates: ranked, selectedIndex: ranked.length > 0 ? 0 : null };
  };

  const handleFindEventTeam = async () => {
    if (!location) return;
    const confirmedCategories = Array.from(selectedCategories);
    if (confirmedCategories.length === 0) {
      setMatchError('Select at least one service.');
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setExpandedCategory(null);
    setCategoryTimes(Object.fromEntries(confirmedCategories.map((category) => [category, eventTime])));
    setStep('plan');

    const results = await Promise.all(
      confirmedCategories.map((category) => matchCategory(category, categoryTier.get(category) || 'optional', confirmedCategories.length))
    );

    setCategoryMatches(results);
    setIsMatching(false);
  };

  // Adds a service to an already-matched plan (from the plan step itself),
  // fetching and ranking its candidates the same way the initial match did.
  const addCategoryToPlan = async (category: string) => {
    if (!location || addingCategories.has(category)) return;
    setAddingCategories((current) => new Set(current).add(category));
    setCategoryTimes((current) => (current[category] ? current : { ...current, [category]: eventTime }));
    const tier = categoryTier.get(category) || 'optional';
    const match = await matchCategory(category, tier, categoryMatches.length + 1);
    setCategoryMatches((current) => [...current.filter((existing) => existing.category !== category), match]);
    setSelectedCategories((current) => new Set(current).add(category));
    setCategoryTier((current) => (current.has(category) ? current : new Map(current).set(category, tier)));
    setAddingCategories((current) => {
      const next = new Set(current);
      next.delete(category);
      return next;
    });
  };

  const selectCandidate = (category: string, index: number) => {
    setCategoryMatches((current) =>
      current.map((match) => (match.category === category ? { ...match, selectedIndex: index } : match))
    );
    setExpandedCategory(null);
  };

  // Clears the freelancer assigned to a service without dropping the
  // service itself — the card goes back to an empty state where the user
  // can pick a different candidate from the same ranked list, or leave it
  // empty (it's then skipped when sending direct requests, but still open
  // for Premium freelancers to apply to if the plan is posted).
  const clearSelection = (category: string) => {
    setCategoryMatches((current) =>
      current.map((match) => (match.category === category ? { ...match, selectedIndex: null } : match))
    );
    setExpandedCategory(null);
  };

  // Drops a service from the plan entirely — not just its currently
  // matched freelancer. Also unchecks it in selectedCategories so it
  // stays dropped if the user goes back to the recommendations step,
  // and so it's excluded from the open-to-Premium-freelancers request too.
  const removeCategory = (category: string) => {
    setCategoryMatches((current) => current.filter((match) => match.category !== category));
    setSelectedCategories((current) => {
      const next = new Set(current);
      next.delete(category);
      return next;
    });
    setCategoryOffers((current) => {
      if (!(category in current)) return current;
      const next = { ...current };
      delete next[category];
      return next;
    });
    setExpandedCategory((current) => (current === category ? null : current));
  };

  const sortedCategoryMatches = useMemo(
    () => [...categoryMatches].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)),
    [categoryMatches]
  );

  // Fills in a starting offer for any category that doesn't have one yet
  // (a fresh match, or a newly added service) - the top candidate's own
  // rate if one was found, else an even share of the total budget so an
  // empty card still starts from something reasonable. Never overwrites a
  // category that already has a value, so the client's own typing (or a
  // value restored from the draft) is never clobbered by a re-match.
  useEffect(() => {
    if (categoryMatches.length === 0) return;
    setCategoryOffers((current) => {
      let changed = false;
      const next = { ...current };
      for (const match of categoryMatches) {
        if (next[match.category] !== undefined) continue;
        const candidate = match.selectedIndex !== null ? match.candidates[match.selectedIndex] : undefined;
        next[match.category] = candidate?.packagePrice ?? Math.max(1, Math.round(budgetNumber / categoryMatches.length));
        changed = true;
      }
      return changed ? next : current;
    });
  }, [categoryMatches, budgetNumber]);

  const getOfferPrice = (category: string): number => categoryOffers[category] ?? 0;

  // The client can type any offer, including one below the freelancer's
  // listed rate - it's caught and shown as an error instead of silently
  // clamped, so they can see exactly which freelancer needs a higher offer
  // rather than have their typed number quietly overwritten. (See
  // belowMinimumCategories/handleSendRequests below for where that's
  // actually enforced.)
  const setOfferAmount = (category: string, amount: number) => {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    setCategoryOffers((current) => ({ ...current, [category]: safeAmount }));
  };

  // A search left over from a different category's list shouldn't hide
  // everyone the next time a (possibly different) list opens.
  useEffect(() => {
    setCandidateSearch('');
  }, [expandedCategory]);

  const budgetFit = useMemo(() => {
    const items: PlanLineItem[] = categoryMatches
      .filter((match) => match.selectedIndex !== null && match.candidates[match.selectedIndex])
      .map((match) => {
        const candidate = match.candidates[match.selectedIndex as number];
        const price = categoryOffers[match.category] ?? (candidate.packagePrice as number);
        return { category: match.category, tier: match.tier, price, userId: candidate.userId, fullName: candidate.fullName };
      });
    return computeBudgetFit(items, budgetNumber);
  }, [categoryMatches, budgetNumber, categoryOffers]);

  // Every category whose currently-typed offer undercuts that freelancer's
  // own listed rate - shown as a per-card error, and blocks sending
  // requests entirely until fixed (see handleSendRequests). Only applies
  // when someone is actually selected — an empty card has no minimum to
  // undercut.
  const belowMinimumCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const match of categoryMatches) {
      if (match.selectedIndex === null) continue;
      const candidate = match.candidates[match.selectedIndex];
      if (!candidate) continue;
      if (getOfferPrice(match.category) < (candidate.packagePrice ?? 0)) {
        categories.add(match.category);
      }
    }
    return categories;
  }, [categoryMatches, categoryOffers]);

  const isDropped = (category: string) => budgetFit.dropped.some((item) => item.category === category);

  // Opens this same plan to Premium freelancers who fit (category, area,
  // date): they're notified once and can apply from their dashboard; the
  // applications land in My Requests for the client to review.
  const handlePostOpenRequest = async () => {
    if (!location || !eventType || !date) return;
    const categories = Array.from(selectedCategories);
    if (categories.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    const fallbackPerRoleBudget = Math.max(1, Math.round(budgetNumber / categories.length));
    const { error } = await DataService.createGroupOpportunity({
      title: `${eventType} team`,
      description: [styles.length ? `Style: ${styles.join(', ')}.` : null, setting ? `Setting: ${setting}.` : null].filter(Boolean).join(' ') || undefined,
      eventDate: date,
      startTime: eventTime,
      locationCity: location.city || location.district || null,
      locationText: location.formattedAddress,
      latitude: location.latitude,
      longitude: location.longitude,
      // Each role's own offer, set (and editable) right on its card in the
      // plan below - not an even split of the total budget, so a freelancer
      // browsing this opportunity sees the actual price the client chose
      // for that specific service.
      roles: categories.map((category) => ({
        category,
        budget: Math.max(1, Math.round(categoryOffers[category] ?? fallbackPerRoleBudget)),
        currency,
        styles,
      })),
    });
    setIsSubmitting(false);

    if (error) {
      setSubmitError((error as any).message || 'Unable to post your request.');
      return;
    }
    clearEventMatcherDraft();
    navigate('/requests');
  };

  const handleSendRequests = async () => {
    if (!user?.id || !location || !eventType) return;
    if (budgetFit.kept.length === 0) {
      setSubmitError('No matched providers to send requests to.');
      return;
    }
    if (belowMinimumCategories.size > 0) {
      setSubmitError('One or more offers are below the freelancer\'s minimum rate — fix them before sending requests.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const perRecipient: Record<string, { projectName: string; budget: number; description: string }> = {};
    for (const item of budgetFit.kept) {
      const budgetMeta: BudgetMeta = { currency, min: item.price, max: item.price };
      const description = appendLocationMeta(
        appendScheduleMeta(
          appendBudgetMeta(`Matched by CreativeHUB's Event Assistant for a ${eventType}.`, budgetMeta),
          { date, time: categoryTimes[item.category] || eventTime }
        ),
        location.formattedAddress
      );
      perRecipient[item.userId] = { projectName: `${eventType} — ${item.category}`, budget: item.price, description };
    }

    const recipientIds = budgetFit.kept.map((item) => item.userId);
    const first = perRecipient[recipientIds[0]];

    const { error } = await DataService.createBookingRequests({
      clientId: user.id,
      recipientIds,
      projectName: first.projectName,
      budget: first.budget,
      description: first.description,
      perRecipient,
    });

    setIsSubmitting(false);

    if (error) {
      setSubmitError((error as any).message || 'Unable to send requests.');
      return;
    }

    await DataService.notifyEventMatcherPlanSent(user.id, recipientIds.length);
    clearEventMatcherDraft();
    navigate('/requests');
  };

  return (
    <div className="relative min-h-screen pb-20">
      <PageBackdrop />
      <div className="relative z-10">
      {isLocationPickerOpen && (
        <LeafletLocationPicker initialPoint={location} onCancel={() => setIsLocationPickerOpen(false)} onConfirm={handleLocationPicked} />
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-sky-100">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <button
            onClick={() => (step === 'input' ? onBack() : setStep(step === 'plan' ? 'recommendations' : 'input'))}
            className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Assistant</h1>
              <p className="text-sm text-gray-600">Plan your event and get matched with real providers within your budget.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {step === 'input' && (
          <div className="space-y-6">
            {inputError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{inputError}</div>}

            <div>
              <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Event type</label>
              <div className="grid grid-cols-2 gap-3">
                {EVENT_TYPES.map((type) => {
                  const Icon = EVENT_TYPE_ICONS[type];
                  const isSelected = eventType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEventType(type)}
                      className={`flex flex-row items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left transition-all ${
                        isSelected ? 'border-2 border-sky-500' : 'border border-sky-100 hover:border-sky-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0 text-gray-700" />
                      <span className={`text-xs leading-tight ${isSelected ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Event date</label>
              <div className="flex justify-center rounded-2xl border border-sky-100 bg-white">
                <Calendar
                  mode="single"
                  selected={parseDateInputValue(date)}
                  onSelect={(selectedDate) => setDate(selectedDate ? toDateInputValue(selectedDate) : '')}
                  disabled={{ before: todayDate }}
                  defaultMonth={parseDateInputValue(date) || todayDate}
                />
              </div>
            </div>

            <div>
              <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Event time</label>
              <p className="mb-2 text-xs text-gray-500">When your event itself starts — each matched provider's arrival time can be set separately later.</p>
              <select
                value={eventTime}
                onChange={(event) => setEventTime(event.target.value)}
                className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-sky-400"
              >
                {EVENT_TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Total budget</label>
              <div className={`flex items-center gap-2 ${INPUT_CONTAINER_CLASS}`}>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(normalizeCurrencyCode(event.target.value))}
                  className="flex-shrink-0 rounded-lg bg-sky-50 px-2 py-1 text-sm font-semibold text-gray-600 focus:outline-none"
                >
                  {SUPPORTED_CURRENCIES.map((item) => (
                    <option key={item.code} value={item.code}>{item.code}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="50,000"
                  className="w-full border-none bg-transparent text-2xl font-bold text-gray-900 focus:outline-none"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {BUDGET_QUICK_AMOUNTS.map((amount) => {
                  const isSelected = budgetNumber === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setBudget(String(amount))}
                      className={chipClass(isSelected)}
                    >
                      {formatCurrencyAmount(amount, currency)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className={`mb-1 ${FIELD_LABEL_CLASS}`}>Style / theme</p>
              <p className="mb-3 text-xs text-gray-500">Pick everything that fits — this shapes which categories and providers we suggest.</p>
              <TagSelector suggestions={EVENT_STYLE_OPTIONS} selected={styles} onChange={setStyles} otherPlaceholder="e.g. Tropical" variant="moodboard" />
            </div>

            <div>
              <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Venue / setting</label>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {EVENT_SETTING_OPTIONS.map((option) => {
                  const Icon = VENUE_SETTING_ICONS[option];
                  const isSelected = setting === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetting((current) => (current === option ? '' : option))}
                      className={`flex w-[92px] flex-shrink-0 flex-col items-center gap-2 rounded-2xl bg-white p-4 transition-all ${
                        isSelected ? 'border-2 border-sky-500' : 'border border-sky-100 hover:border-sky-300'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-gray-700" />
                      <span className={`text-xs ${isSelected ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Location</label>
              <button
                type="button"
                onClick={() => setIsLocationPickerOpen(true)}
                className={`w-full overflow-hidden rounded-2xl bg-white text-left transition-all ${
                  location ? 'border-2 border-sky-500' : 'border border-sky-100 hover:border-sky-300'
                }`}
              >
                {location ? (
                  <div className="h-36 w-full">
                    <LeafletLocationPreview latitude={location.latitude} longitude={location.longitude} title={location.formattedAddress} interactive={false} />
                  </div>
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-sky-50">
                    <MapPin className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div className="flex items-center gap-2 p-4">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-gray-500" />
                  <span className={location ? 'text-sm font-bold text-gray-900' : 'text-sm text-gray-400'}>
                    {location?.formattedAddress || 'Choose the event location on the map'}
                  </span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={handleGetRecommendations}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3.5 font-semibold text-white transition-colors hover:shadow-lg"
            >
              Get Recommendations
            </button>
          </div>
        )}

        {step === 'recommendations' && recommended && (
          <div className="space-y-6">
            {matchError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{matchError}</div>}
            <p className="text-sm text-gray-600">
              Based on your {eventType?.toLowerCase()}, here's what we'd suggest. Uncheck anything you don't need, or add a service manually
              below.
            </p>

            {(['essential', 'recommended', 'optional'] as ServiceTier[]).map((tier) => {
              const categoriesForTier = recommended[tier];
              if (categoriesForTier.length === 0) return null;
              return (
                <div key={tier}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">{TIER_LABEL[tier]}</h3>
                  <div className="space-y-2">
                    {categoriesForTier.map((category) => (
                      <label
                        key={category}
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-sky-100 bg-white px-4 py-3 hover:border-sky-300"
                      >
                        <span className="font-medium text-gray-900">{category}</span>
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(category)}
                          onChange={() => toggleCategory(category)}
                          className="h-5 w-5 rounded border-sky-300 text-sky-600 focus:ring-sky-400"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {(() => {
              const remaining = EVENT_MATCHER_CATEGORY_LABELS.filter((category) => !categoryTier.has(category));
              if (remaining.length === 0) return null;
              return (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Add another service</h3>
                  <div className="flex flex-wrap gap-2">
                    {remaining.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                          selectedCategories.has(category) ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'border-sky-100 bg-white text-gray-700 hover:border-sky-300'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={handleFindEventTeam}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3.5 font-semibold text-white transition-colors hover:shadow-lg"
            >
              Find My Event Team
            </button>
          </div>
        )}

        {step === 'plan' && (
          <div className="space-y-6">
            {isMatching && (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
                <p className="text-sm text-gray-600">Matching you with real providers...</p>
              </div>
            )}

            {!isMatching && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Your {eventType} Plan</h2>
                  <p className="mt-1 truncate text-sm text-gray-600">
                    {[`${formatEventDate(date)} at ${formatTimeLabel(eventTime)}`, location?.city || location?.formattedAddress, styles.length > 0 ? styles.join(', ') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">Total budget</span>
                    <span className="font-bold text-gray-900">{formatCurrencyAmount(budgetNumber, currency)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">Plan total</span>
                    <span className="font-bold text-gray-900">{formatCurrencyAmount(budgetFit.total, currency)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">Remaining</span>
                    <span className={`font-bold ${budgetFit.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrencyAmount(budgetFit.remaining, currency)}
                    </span>
                  </div>
                </div>

                {budgetFit.dropped.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-semibold">Dropped to fit your budget:</p>
                    <p>{budgetFit.dropped.map((item) => item.category).join(', ')}. Raise your budget or swap a package to bring these back.</p>
                  </div>
                )}

                {submitError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

                <div className="space-y-4">
                  {sortedCategoryMatches.map((match) => {
                    const candidate = match.selectedIndex !== null ? match.candidates[match.selectedIndex] : undefined;
                    const hasOptions = match.candidates.length > 0;
                    const dropped = isDropped(match.category);
                    const isExpanded = expandedCategory === match.category;
                    const isBelowMinimum = belowMinimumCategories.has(match.category);
                    const cardClass = candidate
                      ? `relative rounded-2xl border bg-white p-4 shadow-lg ${
                          isBelowMinimum ? 'border-red-300' : dropped ? 'border-amber-300 opacity-60' : 'border-sky-100'
                        }`
                      : 'relative rounded-2xl border-2 border-dashed border-sky-200 bg-white/60 p-4';

                    return (
                      <div key={match.category}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                          <p className="text-xs font-semibold text-gray-500">
                            {match.category} · {TIER_LABEL[match.tier]}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeCategory(match.category)}
                            title="Remove this service"
                            aria-label="Remove this service"
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-red-100 text-red-500 hover:border-red-300 hover:bg-red-50"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className={cardClass}>
                          {candidate ? (
                            <>
                              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                                {hasOptions && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedCategory((current) => (current === match.category ? null : match.category))}
                                    title="See all options"
                                    aria-label="See all options"
                                    aria-expanded={isExpanded}
                                    className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-sky-100 text-gray-600 hover:border-sky-300 hover:text-gray-900"
                                  >
                                    <List className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => clearSelection(match.category)}
                                  title="Remove this freelancer"
                                  aria-label="Remove this freelancer"
                                  className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-red-100 text-red-500 hover:border-red-300 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="flex items-center gap-3 pr-20">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/profile/${candidate.userId}`)}
                                  title={`View ${candidate.fullName}'s profile`}
                                  className="flex-shrink-0 rounded-full"
                                >
                                  <Avatar src={candidate.avatarUrl || DEFAULT_AVATAR_URL} alt={candidate.fullName} sizeClassName="w-12 h-12" />
                                </button>
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/profile/${candidate.userId}`)}
                                    className="truncate text-left font-semibold text-gray-900 hover:underline"
                                  >
                                    {candidate.fullName}
                                  </button>
                                  <p className="text-xs text-gray-500">
                                    {candidate.serviceName}
                                    {candidate.rating > 0 && ` · ★ ${candidate.rating.toFixed(1)}`}
                                  </p>
                                  {dropped && <p className="mt-1 text-xs font-semibold text-amber-700">Dropped — over budget</p>}
                                </div>
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-2">
                                <label htmlFor={`time-${match.category}`} className="text-xs font-semibold text-gray-600">
                                  Arrival time
                                </label>
                                <select
                                  id={`time-${match.category}`}
                                  value={categoryTimes[match.category] || eventTime}
                                  onChange={(event) =>
                                    setCategoryTimes((current) => ({ ...current, [match.category]: event.target.value }))
                                  }
                                  className="rounded-lg border border-sky-100 bg-sky-50/50 px-2 py-1.5 text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-sky-400"
                                >
                                  {EVENT_TIME_SLOTS.map((slot) => (
                                    <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : hasOptions ? (
                            <div className="flex flex-col items-center gap-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedCategory((current) => (current === match.category ? null : match.category))}
                                title="Choose a freelancer"
                                aria-label="Choose a freelancer"
                                aria-expanded={isExpanded}
                                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 text-sky-600 hover:bg-sky-50"
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                              <p className="text-sm text-gray-500">
                                No freelancer selected. Choose one, or leave it open for Premium freelancers to apply.
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 py-2 text-center">
                              <PackageX className="h-6 w-6 text-gray-400" />
                              <p className="text-sm text-gray-500">No providers available for this service yet.</p>
                              <p className="text-xs text-gray-400">
                                Left open — Premium freelancers can still apply here if you open this plan.
                              </p>
                            </div>
                          )}

                          {/* The offer is always settable, whether or not anyone is
                              selected - an empty service can still go out with a
                              price attached when the plan is opened to Premium
                              freelancers (see handlePostOpenRequest). */}
                          <div className={`flex items-center justify-between gap-2 ${candidate ? 'mt-3 border-t border-gray-100 pt-3' : 'mt-3'}`}>
                            <label htmlFor={`offer-${match.category}`} className="text-xs font-semibold text-gray-600">
                              Your offer
                              {candidate && (
                                <span className="font-normal text-gray-400"> (min {formatCurrencyAmount(candidate.packagePrice || 0, currency)})</span>
                              )}
                            </label>
                            <div
                              className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                                isBelowMinimum ? 'border-red-300 bg-red-50' : 'border-sky-100 bg-sky-50/50'
                              }`}
                            >
                              <span className={`text-xs font-semibold ${isBelowMinimum ? 'text-red-600' : 'text-gray-500'}`}>{currency}</span>
                              <input
                                id={`offer-${match.category}`}
                                type="number"
                                min={candidate?.packagePrice ?? 0}
                                step={50}
                                value={getOfferPrice(match.category)}
                                onChange={(event) => setOfferAmount(match.category, Number(event.target.value))}
                                aria-invalid={isBelowMinimum}
                                className={`w-20 bg-transparent text-right text-xs font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                  isBelowMinimum ? 'text-red-700' : 'text-gray-900'
                                }`}
                              />
                            </div>
                          </div>
                          {isBelowMinimum && candidate && (
                            <p className="mt-1 text-right text-[11px] font-semibold text-red-600">
                              Below {candidate.fullName}'s minimum rate — raise your offer to at least {formatCurrencyAmount(candidate.packagePrice || 0, currency)}.
                            </p>
                          )}

                          {isExpanded && hasOptions && (
                            <div className={`space-y-2 ${candidate ? 'mt-3 border-t border-gray-100 pt-3' : 'mt-2'}`}>
                              {match.candidates.length > 1 && (
                                <div className="relative mb-1">
                                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                  <input
                                    type="text"
                                    value={candidateSearch}
                                    onChange={(event) => setCandidateSearch(event.target.value)}
                                    placeholder="Search by name..."
                                    className="w-full rounded-lg border border-sky-100 bg-sky-50/40 py-1.5 pl-8 pr-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-sky-400"
                                  />
                                </div>
                              )}
                              {(() => {
                                const filtered = match.candidates
                                  .map((option, index) => ({ option, index }))
                                  .filter(({ option }) => option.fullName.toLowerCase().includes(candidateSearch.trim().toLowerCase()));

                                if (filtered.length === 0) {
                                  return <p className="py-2 text-center text-xs text-gray-400">No freelancers match "{candidateSearch}".</p>;
                                }

                                return filtered.map(({ option, index }) => {
                                  const isSelected = index === match.selectedIndex;
                                  return (
                                    <div key={option.userId} className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/profile/${option.userId}`)}
                                        title={`View ${option.fullName}'s profile`}
                                        className="flex-shrink-0 rounded-full"
                                      >
                                        <Avatar src={option.avatarUrl || DEFAULT_AVATAR_URL} alt={option.fullName} sizeClassName="w-9 h-9" />
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/profile/${option.userId}`)}
                                          className="truncate text-left text-sm font-semibold text-gray-900 hover:underline"
                                        >
                                          {option.fullName}
                                        </button>
                                        <p className="text-xs text-gray-500">
                                          {option.serviceName} · {formatCurrencyAmount(option.packagePrice || 0, currency)}
                                          {option.rating > 0 && ` · ★ ${option.rating.toFixed(1)}`}
                                        </p>
                                      </div>
                                      {isSelected ? (
                                        <span className="flex-shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-gray-500">
                                          Selected
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => selectCandidate(match.category, index)}
                                          className="flex-shrink-0 rounded-full border-2 border-sky-400 px-3 py-1.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-gradient-to-r hover:from-sky-500 hover:to-blue-600 hover:text-white hover:border-transparent"
                                        >
                                          Select
                                        </button>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const availableToAdd = EVENT_MATCHER_CATEGORY_LABELS.filter(
                    (category) => !categoryMatches.some((match) => match.category === category)
                  );
                  if (availableToAdd.length === 0) return null;
                  return (
                    <div>
                      <p className="mb-2 px-1 text-xs font-semibold text-gray-500">Add another service</p>
                      <div className="flex flex-wrap gap-2">
                        {availableToAdd.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => void addCategoryToPlan(category)}
                            disabled={addingCategories.has(category)}
                            className="rounded-full border-2 border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {addingCategories.has(category) ? 'Adding...' : `+ ${category}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {belowMinimumCategories.size > 0 && (
                  <p className="text-center text-xs font-semibold text-red-600">
                    Fix the offer{belowMinimumCategories.size > 1 ? 's' : ''} below minimum on{' '}
                    {Array.from(belowMinimumCategories).join(', ')} before sending requests.
                  </p>
                )}
                <button
                  type="button"
                  disabled={isSubmitting || budgetFit.kept.length === 0 || belowMinimumCategories.size > 0}
                  onClick={handleSendRequests}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3.5 font-semibold text-white transition-colors hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users className="h-4 w-4" />
                  {isSubmitting ? 'Sending requests...' : 'Send Requests to My Event Team'}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePostOpenRequest()}
                  disabled={isSubmitting}
                  className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3.5 text-center transition-colors hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-sky-700">
                    <Megaphone className="h-4 w-4" />
                    Or open this plan to Premium freelancers to apply
                  </span>
                  <span className="text-xs font-medium text-sky-600">
                    Matching Premium freelancers get notified and can apply themselves — no need to pick one yourself
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
