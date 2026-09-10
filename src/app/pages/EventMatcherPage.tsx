import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2,
  ChevronLeft,
  Gem,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  MapPin,
  PartyPopper,
  RefreshCw,
  Sparkles,
  Sun,
  TreePine,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
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
import { appendScheduleMeta } from '../../lib/requestSchedule';
import { appendLocationMeta } from '../../lib/requestLocation';
import { isFreelancerFreeOnDate } from '../../lib/availability';
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
}

interface CategoryMatch {
  category: string;
  tier: ServiceTier;
  candidates: RankedCandidate[];
  selectedIndex: number;
}

interface PlanLineItem extends BudgetLineItem {
  userId: string;
  fullName: string;
}

const TIER_LABEL: Record<ServiceTier, string> = { essential: 'Essential', recommended: 'Recommended', optional: 'Optional' };
const TIER_BADGE_CLASS: Record<ServiceTier, string> = {
  essential: 'bg-gray-900 text-white',
  recommended: 'bg-gray-200 text-gray-800',
  optional: 'bg-gray-100 text-gray-500',
};

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

export function EventMatcherPage({ onBack }: EventMatcherPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();

  const [step, setStep] = useState<WizardStep>('input');

  // Event input
  const [eventType, setEventType] = useState<EventType | ''>('');
  const [date, setDate] = useState('');
  const [budget, setBudget] = useState(String(BUDGET_QUICK_AMOUNTS[2]));
  const [currency, setCurrency] = useState(normalizeCurrencyCode(preferredCurrency));
  const [styles, setStyles] = useState<string[]>([]);
  const [setting, setSetting] = useState('');
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Recommendations
  const [recommended, setRecommended] = useState<RecommendedCategories | null>(null);
  const [categoryTier, setCategoryTier] = useState<Map<string, ServiceTier>>(new Map());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Matching / plan
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [categoryMatches, setCategoryMatches] = useState<CategoryMatch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayDateString = new Date().toISOString().slice(0, 10);
  const todayDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const budgetNumber = Number(budget) || 0;

  const handleLocationPicked = (point: LocationPoint) => {
    setLocation(point);
    setIsLocationPickerOpen(false);
  };

  const handleGetRecommendations = () => {
    setInputError(null);

    if (!eventType) return setInputError('Choose an event type.');
    if (!date) return setInputError('Choose an event date.');
    if (date < todayDateString) return setInputError('Choose a date that hasn\'t passed yet.');
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

  const handleFindEventTeam = async () => {
    if (!location) return;
    const confirmedCategories = Array.from(selectedCategories);
    if (confirmedCategories.length === 0) {
      setMatchError('Select at least one service.');
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setStep('plan');

    const eventLocation: LocationPointLike = {
      latitude: location.latitude,
      longitude: location.longitude,
      formattedAddress: location.formattedAddress,
      city: location.city ?? null,
      district: location.district ?? null,
    };
    const budgetForCategory = budgetNumber / confirmedCategories.length;

    const results = await Promise.all(
      confirmedCategories.map(async (category): Promise<CategoryMatch> => {
        const tier = categoryTier.get(category) || 'optional';
        const { data } = await DataService.getEventMatcherCandidates(category, date);
        const { profiles, blockedDates, bookings, services } = data;

        const blockedByProfile = new Map<string, Array<{ blocked_date: string }>>();
        for (const row of blockedDates as any[]) {
          const list = blockedByProfile.get(row.freelancer_id) || [];
          list.push(row);
          blockedByProfile.set(row.freelancer_id, list);
        }
        const bookingsByUser = new Map<string, any[]>();
        for (const row of bookings as any[]) {
          const list = bookingsByUser.get(row.freelancer_id) || [];
          list.push(row);
          bookingsByUser.set(row.freelancer_id, list);
        }
        const servicesByProfile = new Map<string, any[]>();
        for (const row of services as any[]) {
          const list = servicesByProfile.get(row.freelancer_id) || [];
          list.push(row);
          servicesByProfile.set(row.freelancer_id, list);
        }

        const candidates: RankedCandidate[] = [];
        for (const profile of profiles as any[]) {
          const isFree = isFreelancerFreeOnDate(bookingsByUser.get(profile.user_id) || [], blockedByProfile.get(profile.id) || [], date);
          if (!isFree) continue;

          const providerLocations: LocationPointLike[] = [
            ...(Array.isArray(profile.locations) ? profile.locations : []),
            ...(Array.isArray(profile.studio_locations) ? profile.studio_locations : []),
          ];
          if (!locationCovers(providerLocations, eventLocation)) continue;

          const profileServices = (servicesByProfile.get(profile.id) || []).filter((service) => service.starting_price != null);
          // Most freelancers in this app have only ever set the older
          // hourly_rate field and never added a Services-tab package
          // (that tab is a newer addition) — fall back to hourly_rate so
          // those freelancers are still matchable, rather than requiring
          // everyone to have filled in the newer packages feature.
          let packagePrice: number | null = null;
          let serviceName = category;
          if (profileServices.length > 0) {
            const cheapest = [...profileServices].sort((a, b) => Number(a.starting_price) - Number(b.starting_price))[0];
            // freelancer_services.starting_price is stored in THB app-wide
            // (see FreelancerProfile.tsx's package pricing display).
            packagePrice = convertAmount(Number(cheapest.starting_price), 'THB', currency);
            serviceName = cheapest.name || category;
          } else if (profile.hourly_rate != null) {
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
          };
          candidate.score = scoreEventCandidate(candidate, { styles, budgetForCategory });
          candidates.push(candidate);
        }

        candidates.sort((a, b) => b.score - a.score);
        return { category, tier, candidates: candidates.slice(0, 5), selectedIndex: 0 };
      })
    );

    setCategoryMatches(results);
    setIsMatching(false);
  };

  const replaceCandidate = (category: string) => {
    setCategoryMatches((current) =>
      current.map((match) =>
        match.category === category && match.candidates.length > 0
          ? { ...match, selectedIndex: (match.selectedIndex + 1) % match.candidates.length }
          : match
      )
    );
  };

  const budgetFit = useMemo(() => {
    const items: PlanLineItem[] = categoryMatches
      .filter((match) => match.candidates.length > 0)
      .map((match) => {
        const candidate = match.candidates[match.selectedIndex];
        return { category: match.category, tier: match.tier, price: candidate.packagePrice as number, userId: candidate.userId, fullName: candidate.fullName };
      });
    return computeBudgetFit(items, budgetNumber);
  }, [categoryMatches, budgetNumber]);

  const isDropped = (category: string) => budgetFit.dropped.some((item) => item.category === category);

  const handleSendRequests = async () => {
    if (!user?.id || !location || !eventType) return;
    if (budgetFit.kept.length === 0) {
      setSubmitError('No matched providers to send requests to.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const perRecipient: Record<string, { projectName: string; budget: number; description: string }> = {};
    for (const item of budgetFit.kept) {
      const budgetMeta: BudgetMeta = { currency, min: item.price, max: item.price };
      // No specific time is collected by the Event Matcher — noon is a
      // neutral placeholder so the event date still carries through to the
      // booking created if this request is accepted (see acceptRequest.ts).
      const description = appendLocationMeta(
        appendScheduleMeta(
          appendBudgetMeta(`Matched by CreativeHUB's Event Matcher for a ${eventType}.`, budgetMeta),
          { date, time: '12:00' }
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
    navigate('/requests');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20">
      {isLocationPickerOpen && (
        <LeafletLocationPicker initialPoint={location} onCancel={() => setIsLocationPickerOpen(false)} onConfirm={handleLocationPicked} />
      )}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <button
            onClick={() => (step === 'input' ? onBack() : setStep(step === 'plan' ? 'recommendations' : 'input'))}
            className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gray-900 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Matcher</h1>
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
              <label className="mb-2 block text-sm font-semibold text-gray-900">Event type</label>
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
                        isSelected ? 'border-2 border-gray-900' : 'border border-gray-200 hover:border-gray-400'
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
              <label className="mb-2 block text-sm font-semibold text-gray-900">Event date</label>
              <div className="flex justify-center rounded-2xl border border-gray-200 bg-white">
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
              <label className="mb-2 block text-sm font-semibold text-gray-900">Total budget</label>
              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 focus-within:ring-2 focus-within:ring-gray-900">
                <select
                  value={currency}
                  onChange={(event) => setCurrency(normalizeCurrencyCode(event.target.value))}
                  className="flex-shrink-0 rounded-lg bg-gray-50 px-2 py-1 text-sm font-semibold text-gray-600 focus:outline-none"
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
                      className={`rounded-full px-3.5 py-1.5 text-xs transition-all ${
                        isSelected ? 'border-2 border-gray-900 font-bold text-gray-900' : 'border border-gray-200 font-medium text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {formatCurrencyAmount(amount, currency)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-gray-900">Style / theme</p>
              <p className="mb-3 text-xs text-gray-500">Pick everything that fits — this shapes which categories and providers we suggest.</p>
              <TagSelector suggestions={EVENT_STYLE_OPTIONS} selected={styles} onChange={setStyles} otherPlaceholder="e.g. Tropical" variant="moodboard" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Venue / setting</label>
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
                        isSelected ? 'border-2 border-gray-900' : 'border border-gray-200 hover:border-gray-400'
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
              <label className="mb-2 block text-sm font-semibold text-gray-900">Location</label>
              <button
                type="button"
                onClick={() => setIsLocationPickerOpen(true)}
                className={`w-full overflow-hidden rounded-2xl bg-white text-left transition-all ${
                  location ? 'border-2 border-gray-900' : 'border border-gray-200 hover:border-gray-400'
                }`}
              >
                {location ? (
                  <div className="h-36 w-full">
                    <LeafletLocationPreview latitude={location.latitude} longitude={location.longitude} title={location.formattedAddress} interactive={false} />
                  </div>
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-gray-50">
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
              className="w-full rounded-xl bg-gray-900 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-black"
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
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-400"
                      >
                        <span className="font-medium text-gray-900">{category}</span>
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(category)}
                          onChange={() => toggleCategory(category)}
                          className="h-5 w-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
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
                          selectedCategories.has(category) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
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
              className="w-full rounded-xl bg-gray-900 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-black"
            >
              Find My Event Team
            </button>
          </div>
        )}

        {step === 'plan' && (
          <div className="space-y-6">
            {isMatching && (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
                <p className="text-sm text-gray-600">Matching you with real providers...</p>
              </div>
            )}

            {!isMatching && (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
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

                <div className="space-y-3">
                  {categoryMatches.map((match) => {
                    const candidate = match.candidates[match.selectedIndex];
                    const dropped = isDropped(match.category);

                    return (
                      <div
                        key={match.category}
                        className={`rounded-2xl border bg-white p-4 shadow-lg ${dropped ? 'border-amber-300 opacity-60' : 'border-gray-200'}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-bold text-gray-900">{match.category}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE_CLASS[match.tier]}`}>{TIER_LABEL[match.tier]}</span>
                        </div>

                        {!candidate ? (
                          <p className="text-sm text-gray-500">No providers available for this service yet.</p>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Avatar src={candidate.avatarUrl || DEFAULT_AVATAR_URL} alt={candidate.fullName} sizeClassName="w-12 h-12" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-gray-900">{candidate.fullName}</p>
                              <p className="text-xs text-gray-500">
                                {candidate.serviceName} · {formatCurrencyAmount(candidate.packagePrice || 0, currency)}
                                {candidate.rating > 0 && ` · ★ ${candidate.rating.toFixed(1)}`}
                              </p>
                              {dropped && <p className="mt-1 text-xs font-semibold text-amber-700">Dropped — over budget</p>}
                            </div>
                            {match.candidates.length > 1 && (
                              <button
                                type="button"
                                onClick={() => replaceCandidate(match.category)}
                                title="Show another provider"
                                className="flex-shrink-0 rounded-full border border-gray-200 p-2 text-gray-600 hover:border-gray-400 hover:text-gray-900"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || budgetFit.kept.length === 0}
                  onClick={handleSendRequests}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users className="h-4 w-4" />
                  {isSubmitting ? 'Sending requests...' : 'Send Requests to My Event Team'}
                </button>
                <p className="text-center text-xs text-gray-400">
                  This sends booking requests through your normal Requests flow — nothing is booked automatically.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
