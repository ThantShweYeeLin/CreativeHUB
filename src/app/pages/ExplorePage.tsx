import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, ChevronRight, Star, Sparkles, Heart } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import type { Gender } from '../../lib/database.types';
import { AIImageMatcher, AIImageMatcherResults, type AIMatcherResult } from '../components/AIImageMatcher';
import { SearchFilterPanel, type FilterState } from '../components/SearchFilterPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, normalizeCurrencyCode } from '../../lib/currency';
import { FREELANCER_CATEGORIES, isFreelancerCategory } from '../../lib/categories';
import { interpretSearchQuery, scoreFreelancerMatch } from '../../lib/freelancerSearch';

interface ProfileCardProps {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  image: string;
  gender?: Gender | null;
  location?: string;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
}

function ProfileCard({ id, name, specialty, rating, reviews, image, location, isFavorited, onToggleFavorite }: ProfileCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      className="flex-shrink-0 w-[240px] sm:w-[280px] group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
        <div className="relative h-[280px] sm:h-[320px] overflow-hidden">
          <ImageWithFallback
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite(id);
              }}
              aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-transform hover:scale-110"
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
            </button>
          )}
          <div className={`absolute bottom-4 left-4 right-4 transform transition-all duration-300 ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <button
              onClick={() => navigate(`/profile/${id}`)}
              className="w-full bg-white text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              View Profile
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1">{name}</h3>
          <p className="text-sm text-gray-600 mb-3">{specialty}</p>
          {location && <p className="text-xs text-gray-500 mb-3">{location}</p>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-sm text-gray-900">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
              <span className="text-xs text-gray-500">({reviews})</span>
            </div>
            <button
              onClick={() => navigate(`/profile/${id}`)}
              className="text-sm text-gray-900 font-semibold hover:text-black transition-colors"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CarouselSectionProps {
  title: string;
  profiles: ProfileCardProps[];
  favoritedIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
}

function CarouselSection({ title, profiles, favoritedIds, onToggleFavorite }: CarouselSectionProps) {
  return (
    <div className="mb-12 md:mb-16">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-xl md:text-3xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide">
        {profiles.map((profile, index) => (
          <ProfileCard
            key={profile.id || index}
            {...profile}
            isFavorited={favoritedIds?.has(profile.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

function normalizeText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

/** "Photographer" -> "Photographers", "Makeup Artist" -> "Makeup Artists", etc. — a plain "s" suffix works for all five canonical labels. */
function pluralizeCategory(label: string) {
  return `${label}s`;
}

/** Great-circle distance between two lat/lng points, in kilometers. */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ExplorePage() {
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const navigate = useNavigate();
  const normalizedPreferredCurrency = normalizeCurrencyCode(preferredCurrency, 'THB');
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [freelancers, setFreelancers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [clientInterests, setClientInterests] = useState<string[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [userLocation, setUserLocation] = useState<string | null>(null);
  // "Popular X in Thailand" used to be hardcoded regardless of who was
  // looking, even for viewers whose own country (from signup/onboarding) is
  // known and available right here. `userLocation` is a geocoded
  // "City, Country" string, so the country is its last comma-separated
  // segment; when it's not known yet, drop the suffix rather than guessing
  // a country for someone who may not be anywhere near Thailand.
  const popularSectionSuffix = useMemo(() => {
    if (!userLocation) return '';
    const segments = userLocation.split(',').map((segment) => segment.trim()).filter(Boolean);
    const country = segments[segments.length - 1];
    return country ? ` in ${country}` : '';
  }, [userLocation]);
  const [filters, setFilters] = useState<FilterState>({
    services: [],
    priceRange: [0, 10000],
    locations: [],
    currency: normalizedPreferredCurrency,
    nearMe: null,
    minRating: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIMatcher, setShowAIMatcher] = useState(false);
  const [aiMatcherResults, setAIMatcherResults] = useState<AIMatcherResult[] | null>(null);
  const [aiMatcherNote, setAIMatcherNote] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFreelancers() {
      setIsLoading(true);
      setError(null);

      const response = await DataService.getAllFreelancers(200);

      // Debugging: log raw response to inspect why some names are not returned
      // Use console.log so it's visible in all browser consoles
      // eslint-disable-next-line no-console
      console.log('[ExplorePage] searchQuery=', searchQuery, 'response=', response);

      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load freelancers.');
        setFreelancers([]);
      } else {
        // Merge direct freelancer search and user fallback concurrently for more complete results
        const data = response.data || [];
        if (searchQuery.trim()) {
          try {
            const [fallback] = await Promise.all([DataService.searchUsersFallback(searchQuery.trim())]);
            // eslint-disable-next-line no-console
            console.log('[ExplorePage] fallback=', fallback);
            const fallbackData = (fallback.data || []) as any[];

            const combined = [...data];
            for (const f of fallbackData) {
              const exists = combined.find((c) => (c.user_id && f.user_id && c.user_id === f.user_id) || c.id === f.id);
              if (!exists) combined.push(f);
            }

            // eslint-disable-next-line no-console
            console.log('[ExplorePage] mergedResultsCount=', combined.length);
            setFreelancers(combined);
          } catch (err) {
            setFreelancers(data);
          }
        } else {
          setFreelancers(data);
        }
      }

      setIsLoading(false);
    }

    void loadFreelancers();

    return () => {
      isMounted = false;
    };
  }, []);

  // Personalization: the categories this client said they're interested in
  // during onboarding, used to nudge default ordering (not filter). Also
  // pull which freelancers are already favorited so hearts render correctly.
  useEffect(() => {
    if (!user?.id) {
      setClientInterests([]);
      setFavoritedIds(new Set());
      return;
    }

    let isMounted = true;

    DataService.getUser(user.id).then(({ data }) => {
      if (!isMounted) return;
      if (Array.isArray((data as any)?.client_interests)) {
        setClientInterests((data as any).client_interests);
      }
      setUserLocation((data as any)?.location || null);
    });

    DataService.getUserFavorites(user.id).then(({ data }) => {
      if (!isMounted || !data) return;
      setFavoritedIds(new Set(data.map((favorite: any) => favorite.freelancer_id).filter(Boolean)));
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleToggleFavorite = async (freelancerId: string) => {
    if (!user?.id) {
      navigate('/login');
      return;
    }

    const alreadyFavorited = favoritedIds.has(freelancerId);

    // Optimistic update, reverted on failure.
    setFavoritedIds((current) => {
      const next = new Set(current);
      if (alreadyFavorited) next.delete(freelancerId);
      else next.add(freelancerId);
      return next;
    });

    const { error: toggleError } = alreadyFavorited
      ? await DataService.removeFavorite(user.id, freelancerId)
      : await DataService.addFavorite(user.id, freelancerId);

    if (toggleError) {
      setFavoritedIds((current) => {
        const next = new Set(current);
        if (alreadyFavorited) next.add(freelancerId);
        else next.delete(freelancerId);
        return next;
      });
    }
  };

  useEffect(() => {
    setFilters((current) => {
      if (current.currency === normalizedPreferredCurrency) {
        return current;
      }

      // Keep existing numeric budget intent when currency changes globally.
      const nextMin = Math.round(convertAmount(current.priceRange[0], current.currency, normalizedPreferredCurrency));
      const nextMax = Math.round(convertAmount(current.priceRange[1], current.currency, normalizedPreferredCurrency));

      return {
        ...current,
        currency: normalizedPreferredCurrency,
        priceRange: [Math.min(nextMin, nextMax), Math.max(nextMin, nextMax)],
      };
    });
  }, [normalizedPreferredCurrency]);

  // Autocomplete: fetch suggestions (debounced) from both searchUsers and fallback
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let mounted = true;
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      try {
        const [usersRes, fallbackRes] = await Promise.allSettled([
          DataService.searchUsers(q, { limit: 6 }),
          DataService.searchUsersFallback(q),
        ]);

        const combined: any[] = [];
        if (usersRes.status === 'fulfilled' && usersRes.value?.data) combined.push(...usersRes.value.data);
        if (fallbackRes.status === 'fulfilled' && fallbackRes.value?.data) combined.push(...fallbackRes.value.data);

        const dedupe = new Map<string, any>();
        for (const r of combined) {
          const key = r.user_id || r.users?.id || r.id;
          if (!key) continue;
          if (!dedupe.has(key)) dedupe.set(key, r);
        }

        const list = Array.from(dedupe.values()).slice(0, 6);
        if (mounted) {
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        }

        // Merge freelancer matches into the searchable pool too, not just the
        // suggestions dropdown — otherwise someone findable by name here
        // (e.g. an is_available:false freelancer, excluded from the initial
        // browse-only fetch) still wouldn't appear in the actual search
        // results section below.
        if (mounted && fallbackRes.status === 'fulfilled' && fallbackRes.value?.data) {
          const newFreelancerMatches = (fallbackRes.value.data as any[]).filter((row) => isFreelancerCategory(row.title));
          if (newFreelancerMatches.length > 0) {
            setFreelancers((current) => {
              const existingIds = new Set(current.map((item) => item.user_id || item.users?.id || item.id));
              const toAdd = newFreelancerMatches.filter((row) => !existingIds.has(row.user_id));
              return toAdd.length > 0 ? [...current, ...toAdd] : current;
            });
          }
        }
      } catch (e) {
        if (mounted) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    }, 180);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Click outside to close suggestions
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        suggestionsRef.current &&
        inputRef.current &&
        !suggestionsRef.current.contains(target) &&
        !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Freelancers whose category isn't one of the five supported labels
  // (legacy data, or a profile mid-way through picking a valid category)
  // are excluded from Explore entirely — they still have an account, they
  // just don't surface here until they pick a supported category.
  const profiles = useMemo<ProfileCardProps[]>(() => {
    return freelancers
      .filter((profile) => isFreelancerCategory(profile.title))
      .map((profile) => ({
        id: profile.user_id || profile.users?.id || profile.id,
        name: profile.users?.full_name || profile.title || 'Creative Freelancer',
        specialty: profile.title || profile.skills?.[0] || 'Creative Professional',
        rating: Number(profile.users?.rating || 0),
        reviews: Number(profile.users?.total_reviews || 0),
        image: profile.users?.avatar_url || DEFAULT_AVATAR_URL,
        gender: profile.users?.gender || null,
        location: profile.users?.location || undefined,
      }));
  }, [freelancers]);

  // Unifies the category pill (a hard category filter) with whatever the
  // free-text search implies (service/style/location) into one query the
  // scorer below can rank every freelancer against.
  const interpretedQuery = useMemo(() => {
    const base = interpretSearchQuery(searchQuery);
    return selectedCategory !== 'All' ? { ...base, category: selectedCategory } : base;
  }, [searchQuery, selectedCategory]);

  const filteredProfiles = useMemo(() => {
    const mapById = new Map(
      freelancers.map((item) => [item.user_id || item.users?.id || item.id, item])
    );

    const scored = profiles
      .map((profile) => {
        const source = mapById.get(profile.id);

        const score = scoreFreelancerMatch(
          {
            title: source?.title || null,
            skills: source?.skills || [],
            styles: source?.styles || [],
            description: source?.description || null,
            location: profile.location || null,
            fullName: profile.name || null,
          },
          interpretedQuery,
          clientInterests
        );

        // Advanced Filter's category checkboxes are now the exact five
        // canonical labels, so this is a straight equality check against
        // title — no more fuzzy keyword matching that could cross-match
        // unrelated categories.
        const serviceMatch = filters.services.length === 0 || (!!source?.title && filters.services.includes(source.title));

        const normalizedLocation = normalizeText(profile.location);

        const textLocationMatch =
          filters.locations.length > 0 &&
          filters.locations.some((location) => normalizedLocation.includes(normalizeText(location)));

        const freelancerLat = Number(source?.users?.location_latitude);
        const freelancerLng = Number(source?.users?.location_longitude);
        const nearMeMatch =
          !!filters.nearMe &&
          Number.isFinite(freelancerLat) &&
          Number.isFinite(freelancerLng) &&
          haversineDistanceKm(filters.nearMe.latitude, filters.nearMe.longitude, freelancerLat, freelancerLng) <= filters.nearMe.radiusKm;

        const locationMatch = (filters.locations.length === 0 && !filters.nearMe) || textLocationMatch || nearMeMatch;

        const hourlyRate = Number(source?.hourly_rate);
        const sourceCurrency = normalizeCurrencyCode(source?.users?.preferred_currency || source?.preferred_currency || 'THB', 'THB');
        const [minPrice, maxPrice] = filters.priceRange;
        const defaultMaxForCurrency = Math.round(convertAmount(10000, 'THB', filters.currency));
        const isDefaultPriceFilter = minPrice === 0 && maxPrice === defaultMaxForCurrency;
        const hourlyRateInSelectedCurrency = convertAmount(hourlyRate, sourceCurrency, filters.currency);
        const priceMatch = Number.isFinite(hourlyRate)
          ? hourlyRateInSelectedCurrency >= minPrice && hourlyRateInSelectedCurrency <= maxPrice
          : isDefaultPriceFilter;

        const ratingMatch = filters.minRating === null || profile.rating >= filters.minRating;

        const passes = score > 0 && serviceMatch && locationMatch && priceMatch && ratingMatch;
        return { profile, score, passes };
      })
      .filter((item) => item.passes)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.profile);
  }, [profiles, freelancers, filters, interpretedQuery, clientInterests]);

  // Group by the freelancer's actual category (freelancer_profiles.title,
  // which is always one of the five FREELANCER_CATEGORIES labels — profiles
  // is already filtered to drop anything else, so every entry here has a
  // recognized category and there's no "uncategorized" fallback bucket.
  const categorySections = useMemo(() => {
    const sourceById = new Map(freelancers.map((item) => [item.user_id || item.users?.id || item.id, item]));
    const categoryLabels = FREELANCER_CATEGORIES.map((category) => category.label);
    const labelSet = new Set(categoryLabels);

    const grouped = new Map<string, ProfileCardProps[]>();

    for (const profile of filteredProfiles) {
      const title = sourceById.get(profile.id)?.title;
      if (title && labelSet.has(title)) {
        if (!grouped.has(title)) grouped.set(title, []);
        grouped.get(title)!.push(profile);
      }
    }

    // Categories the client chose as interests at sign-up float to the top,
    // in the order they picked them; the rest of the catalog follows in its
    // canonical order.
    const orderedLabels = [
      ...clientInterests.filter((label) => labelSet.has(label)),
      ...categoryLabels.filter((label) => !clientInterests.includes(label)),
    ];

    return orderedLabels
      .map((label) => ({ title: `Popular ${pluralizeCategory(label)}${popularSectionSuffix}`, profiles: grouped.get(label) || [] }))
      .filter((section) => section.profiles.length > 0);
  }, [filteredProfiles, freelancers, clientInterests, popularSectionSuffix]);

  const hasActiveSearch = searchQuery.trim().length > 0 || selectedCategory !== 'All';

  const activeAdvancedFilterCount = useMemo(() => {
    const defaultMaxForCurrency = Math.round(convertAmount(10000, 'THB', filters.currency));
    const isDefaultPrice = filters.priceRange[0] === 0 && filters.priceRange[1] === defaultMaxForCurrency;
    return filters.services.length + filters.locations.length + (filters.nearMe ? 1 : 0) + (isDefaultPrice ? 0 : 1) + (filters.minRating !== null ? 1 : 0);
  }, [filters]);

  return (
    <>
      {/* Search and AI Matcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 mb-8 md:mb-12">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            ref={inputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            placeholder="Search by name, email, or specialty — e.g. photographer, makeup, wedding"
            className="w-full pl-12 pr-4 py-3 md:py-4 bg-white rounded-2xl shadow-lg border border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden"
            >
              {suggestions.map((s, idx) => {
                // DataService.searchUsers returns flat rows (full_name/email
                // directly on the row); DataService.searchUsersFallback
                // returns freelancer_profiles-shaped rows (name/email nested
                // under `.users`) — a suggestion can be either shape, so
                // every field needs both a flat and a nested fallback.
                const id = s.user_id || s.users?.id || s.id;
                const name = s.users?.full_name || s.full_name || s.title || s.users?.email || s.email || 'Unknown';
                const subtitle = s.users?.email || s.email || s.users?.username || s.title || '';
                const avatar = s.users?.avatar_url || s.avatar_url || DEFAULT_AVATAR_URL;
                const suggestionGender = s.users?.gender || s.gender || null;
                return (
                  <button
                    key={id || idx}
                    onClick={() => {
                      setShowSuggestions(false);
                      navigate(`/profile/${id}`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Avatar src={avatar} alt={name} gender={suggestionGender} sizeClassName="w-8 h-8" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                      {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSearchFilter(true)}
            className="relative flex-1 md:flex-none flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all group border border-gray-200"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm md:text-base text-gray-900">Advanced Filter</div>
              <div className="text-xs text-gray-500 hidden md:block">Refine Your Search</div>
            </div>
            {activeAdvancedFilterCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-900 px-1.5 text-xs font-bold text-white shadow-md">
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowAIMatcher(true)}
            className="flex-1 md:flex-none flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all group border border-gray-200"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm md:text-base text-gray-900">AI Match Finder</div>
              <div className="text-xs text-gray-500 hidden md:block">Describe or upload to match</div>
            </div>
          </button>
        </div>
      </div>

      {/* Category navigation */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-hide md:mb-12">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
            selectedCategory === 'All' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'
          }`}
        >
          All
        </button>
        {FREELANCER_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory((current) => (current === category.label ? 'All' : category.label))}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selectedCategory === category.label ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
        </div>
      )}

      {!isLoading && profiles.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-lg">
          <h2 className="mb-2 text-xl font-bold text-gray-900">No freelancers found</h2>
          <p className="text-gray-600">Available freelancer profiles from the database will appear here.</p>
        </div>
      )}

      {!isLoading && aiMatcherResults && (
        <AIImageMatcherResults
          results={aiMatcherResults}
          note={aiMatcherNote}
          onReset={() => {
            setAIMatcherResults(null);
            setAIMatcherNote(null);
            setShowAIMatcher(true);
          }}
        />
      )}

      {!isLoading && !aiMatcherResults && profiles.length > 0 && filteredProfiles.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-lg">
          <h2 className="mb-2 text-xl font-bold text-gray-900">
            {hasActiveSearch ? 'No matching freelancers' : 'No freelancers match these filters'}
          </h2>
          <p className="text-gray-600">
            {hasActiveSearch
              ? 'Try a different search, or choose another category.'
              : 'Adjust service, location, or price range in Advanced Filter.'}
          </p>
        </div>
      )}

      {!isLoading && !aiMatcherResults && hasActiveSearch && filteredProfiles.length > 0 && (
        <CarouselSection
          title={
            searchQuery.trim()
              ? `Search results for "${searchQuery.trim()}"`
              : `Popular ${pluralizeCategory(selectedCategory)}${popularSectionSuffix}`
          }
          profiles={filteredProfiles}
          favoritedIds={favoritedIds}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Carousel Sections — one per real category, client's chosen interests first */}
      {!isLoading && !hasActiveSearch && categorySections.map((section) => (
        <CarouselSection
          key={section.title}
          title={section.title}
          profiles={section.profiles}
          favoritedIds={favoritedIds}
          onToggleFavorite={handleToggleFavorite}
        />
      ))}

      {showSearchFilter && (
        <SearchFilterPanel
          initialFilters={filters}
          userLocation={userLocation}
          onClose={() => setShowSearchFilter(false)}
          onSearch={(nextFilters) => setFilters(nextFilters)}
        />
      )}
      <AIImageMatcher
        open={showAIMatcher}
        onClose={() => setShowAIMatcher(false)}
        onResults={(results, note) => {
          setAIMatcherResults(results);
          setAIMatcherNote(note ?? null);
        }}
      />
    </>
  );
}
