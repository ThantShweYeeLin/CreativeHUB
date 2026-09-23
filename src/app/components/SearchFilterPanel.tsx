import { X, Sparkles, MapPin, LocateFixed, Loader2, ChevronLeft, SlidersHorizontal, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrencyAmount, getCurrencySymbol } from '../../lib/currency';
import { FREELANCER_CATEGORY_LABELS } from '../../lib/categories';
import { chipClass, CHIP_BASE_CLASS, CHIP_SELECTED_CLASS, FIELD_LABEL_CLASS, INPUT_CONTAINER_CLASS } from '../../lib/formFieldStyles';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { LeafletLocationPreview } from '../../components/common/LeafletLocationPreview';

interface SearchFilterPanelProps {
  onClose: () => void;
  onSearch: (filters: FilterState) => void;
  initialFilters?: FilterState;
  /** The signed-in client's own profile location, if set — surfaced as a one-click suggested chip. */
  userLocation?: string | null;
  /**
   * Called (in addition to onSearch) when "Clear All" is pressed - resets
   * anything the caller owns outside this panel's own FilterState, e.g.
   * Explore's separate category pill row, which isn't part of FilterState
   * and would otherwise survive a "Clear All" untouched (including through
   * a later back-navigation, since it's persisted in the URL).
   */
  onClearAll?: () => void;
}

export interface FilterState {
  services: string[];
  priceRange: [number, number];
  locations: string[];
  currency: string;
  /** Set when "Near Me" is active — filters to freelancers within radiusKm of this point. */
  nearMe: { latitude: number; longitude: number; radiusKm: number } | null;
  /** Minimum average rating (e.g. 4.5), or null for no rating filter. */
  minRating: number | null;
}

export const RATING_FILTER_OPTIONS = [4.5, 4, 3.5, 3];

const serviceOptions = FREELANCER_CATEGORY_LABELS;

const locationOptions = [
  'Bangkok',
  'Chiang Mai',
  'Pattaya',
  'Phuket',
  'Nakhon Ratchasima',
  'Khon Kaen',
  'Udon Thani',
];

const NEAR_ME_RADIUS_OPTIONS_KM = [10, 25, 50, 100];

const PRICE_MIN = 0;
const PRICE_MAX = 100000;
const PRICE_STEP = 100;

const DEFAULT_CURRENCY = 'THB';

const budgetPresetsBaseThb: Array<{ key: string; range: [number, number]; type: 'any' | 'under' | 'range' | 'over' }> = [
  { key: 'any', range: [0, 10000], type: 'any' },
  { key: 'under', range: [0, 2000], type: 'under' },
  { key: 'mid', range: [2000, 5000], type: 'range' },
  { key: 'high', range: [5000, 8000], type: 'range' },
  { key: 'over', range: [8000, 10000], type: 'over' },
];

// Filtering is always done in THB, regardless of the viewer's own preferred
// display currency (account setting or location-guessed) — that currency
// is just for how prices are SHOWN elsewhere in the app; letting it also
// change what "under ฿2,000" means here made the filter's own budget
// presets silently drift depending on who was searching.
const DEFAULT_PRICE_RANGE: [number, number] = [PRICE_MIN, 10000];

export function SearchFilterPanel({ onClose, onSearch, initialFilters, userLocation, onClearAll }: SearchFilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    services: initialFilters?.services || [],
    priceRange: initialFilters?.priceRange || DEFAULT_PRICE_RANGE,
    locations: initialFilters?.locations || [],
    currency: DEFAULT_CURRENCY,
    nearMe: initialFilters?.nearMe || null,
    minRating: initialFilters?.minRating ?? null,
  });

  // A location typed into "Other" is just another entry in filters.locations
  // (matching already works by substring, so no separate filtering path is
  // needed) — this only tracks which one, if any, came from that free-text
  // box so the input can show/hide and stay in sync with it.
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherLocationDraft, setOtherLocationDraft] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // This panel renders as a fixed full-screen overlay on top of Explore,
  // which stays mounted underneath it (unlike Event Matcher, a route whose
  // previous page fully unmounts) — without this, Explore's own taller-
  // than-viewport content keeps the document scrollable behind the overlay,
  // showing a scrollbar even though the panel's own content fits. Same
  // iOS-safe lock PostDetailModal uses: `overflow: hidden` alone doesn't
  // stop touch-scrolling on iOS Safari, so the body is pinned in place too.
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (initialFilters) {
      setFilters({
        services: initialFilters.services,
        priceRange: initialFilters.priceRange,
        locations: initialFilters.locations,
        currency: DEFAULT_CURRENCY,
        nearMe: initialFilters.nearMe || null,
        minRating: initialFilters.minRating ?? null,
      });
    }
  }, [initialFilters]);

  const budgetPresets = useMemo(
    () =>
      budgetPresetsBaseThb.map((preset) => {
        const label = (() => {
          if (preset.type === 'any') return 'Any Budget';
          if (preset.type === 'under') return `Under ${formatCurrencyAmount(preset.range[1], DEFAULT_CURRENCY)}`;
          if (preset.type === 'over') return `${formatCurrencyAmount(preset.range[0], DEFAULT_CURRENCY)}+`;
          return `${formatCurrencyAmount(preset.range[0], DEFAULT_CURRENCY)} - ${formatCurrencyAmount(preset.range[1], DEFAULT_CURRENCY)}`;
        })();

        return { key: preset.key, label, range: preset.range };
      }),
    []
  );

  const currencySymbol = getCurrencySymbol(DEFAULT_CURRENCY);

  const setMinPrice = (value: number) => {
    const safeMin = Math.max(PRICE_MIN, Math.min(value, filters.priceRange[1]));
    setFilters((prev) => ({
      ...prev,
      priceRange: [safeMin, prev.priceRange[1]],
    }));
  };

  const setMaxPrice = (value: number) => {
    const safeMax = Math.min(PRICE_MAX, Math.max(value, filters.priceRange[0]));
    setFilters((prev) => ({
      ...prev,
      priceRange: [prev.priceRange[0], safeMax],
    }));
  };

  const toggleService = (service: string) => {
    setFilters(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const toggleLocation = (location: string) => {
    setFilters(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(l => l !== location)
        : [...prev.locations, location]
    }));
  };

  const applyOtherLocation = () => {
    const value = otherLocationDraft.trim();
    if (!value) return;
    setFilters((prev) => (prev.locations.some((l) => l.toLowerCase() === value.toLowerCase()) ? prev : { ...prev, locations: [...prev.locations, value] }));
    setOtherLocationDraft('');
    setShowOtherInput(false);
  };

  const toggleNearMe = () => {
    if (filters.nearMe) {
      setFilters((prev) => ({ ...prev, nearMe: null }));
      setLocateError(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocateError('Geolocation is not available in this browser.');
      return;
    }

    setLocateError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setFilters((prev) => ({
          ...prev,
          nearMe: { latitude: position.coords.latitude, longitude: position.coords.longitude, radiusKm: 50 },
        }));
      },
      (geoError) => {
        setIsLocating(false);
        setLocateError(geoError.code === geoError.PERMISSION_DENIED ? 'Location permission denied.' : 'Unable to get your location.');
      },
      { timeout: 10000 }
    );
  };

  const setNearMeRadius = (radiusKm: number) => {
    setFilters((prev) => (prev.nearMe ? { ...prev, nearMe: { ...prev.nearMe, radiusKm } } : prev));
  };

  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };

  const handleClearAll = () => {
    const cleared: FilterState = {
      services: [],
      priceRange: DEFAULT_PRICE_RANGE,
      locations: [],
      currency: DEFAULT_CURRENCY,
      nearMe: null,
      minRating: null,
    };
    // setFilters(cleared) alone wouldn't be visible to onSearch below until
    // the next render — pass `cleared` directly so Clear All both resets and
    // applies in one tap instead of needing a separate Apply Filters click.
    setFilters(cleared);
    setShowOtherInput(false);
    setOtherLocationDraft('');
    setLocateError(null);
    onSearch(cleared);
    onClearAll?.();
    onClose();
  };

  return createPortal(
    // Portaled to document.body — ExplorePage wraps its whole page in a
    // `relative z-10` div, which (like any positioned element with an
    // explicit z-index) establishes its own stacking context. That traps
    // this panel's z-[1300] inside it, so no matter how high a z-index is
    // set here, it only ever competed within that wrapper's own slot in the
    // page — which sits BELOW MainLayout's header (z-[1200], a sibling
    // entirely outside that wrapper, with its own explicit stacking level).
    // The result was exactly what showed up: the header still visible on
    // top, this panel's own back button and title scrolled out of view
    // underneath it. Escaping via a portal makes z-[1300] actually get
    // compared against z-[1200] at the document root, where it wins.
    <div className="fixed inset-0 z-[1300] overflow-y-auto bg-white">
      {/* Same light-blue gradient + drifting orbs treatment as Event
          Assistant and every other full-page route, instead of this
          panel's own flat gray gradient. min-h-full (not min-h-screen) so
          the backdrop still covers content taller than one viewport, since
          this relative wrapper's height comes from its content, not the
          viewport, inside this already-scrollable fixed container. */}
      <div className="relative min-h-full">
        <PageBackdrop />
        <div className="relative z-10">
      <div className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <button
            onClick={onClose}
            className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Advanced Filters</h2>
              <p className="text-sm text-gray-600">Narrow results down to providers that fit what you need.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-6">
          {/* Types of Services — card grid matching Event Assistant's
              Venue/Setting layout, text-only (no icon) per feedback that
              the per-category icons read as emoji-like clutter. */}
          <div>
            <h3 className={`${FIELD_LABEL_CLASS} mb-2`}>Types of Services</h3>
            <div className="grid grid-cols-3 gap-3">
              {serviceOptions.map((service) => {
                const isSelected = filters.services.includes(service);
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={`flex items-center justify-center rounded-2xl bg-white p-4 text-center transition-all ${
                      isSelected ? 'border-2 border-sky-500' : 'border border-sky-100 hover:border-sky-300'
                    }`}
                  >
                    <span className={`text-xs leading-tight ${isSelected ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                      {service}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Rating */}
          <div>
            <h3 className={`${FIELD_LABEL_CLASS} mb-2`}>Minimum Rating</h3>
            {/* Equal-width flex row (flex-1 each) instead of left-clustered
                flex-wrap, so the 5 chips together span the same full width
                as the page's other content boxes (Types of Services grid,
                Price Range inputs) rather than bunching on the left with
                empty space to the right. */}
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, minRating: null }))}
                className={chipClass(filters.minRating === null, 'flex-1 text-center')}
              >
                Any
              </button>
              {RATING_FILTER_OPTIONS.map((rating) => {
                const isSelected = filters.minRating === rating;
                return (
                  <button
                    key={rating}
                    onClick={() => setFilters((prev) => ({ ...prev, minRating: rating }))}
                    className={chipClass(isSelected, 'flex-1 flex items-center justify-center gap-1')}
                  >
                    {/* Same star icon/color used for ratings everywhere else
                        in the app (see ExplorePage's provider cards). */}
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {rating}+
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className={`${FIELD_LABEL_CLASS} mb-1`}>Price Range ({(filters.currency || 'THB').toUpperCase()})</h3>
            <p className="mb-3 text-xs text-gray-500">
              Choose a preset for quick filtering, or type your exact minimum and maximum budget.
            </p>
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {budgetPresets.map((preset) => {
                  const isActive =
                    filters.priceRange[0] === preset.range[0] &&
                    filters.priceRange[1] === preset.range[1];
                  return (
                    <button
                      key={preset.key}
                      onClick={() => setFilters((prev) => ({ ...prev, priceRange: preset.range }))}
                      className={chipClass(isActive)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Price display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`flex items-center gap-3 ${INPUT_CONTAINER_CLASS}`}>
                  <span className="w-7 text-lg font-bold text-gray-900">{currencySymbol}</span>
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 font-medium">Min</div>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={filters.priceRange[0]}
                      onChange={(e) => setMinPrice(Number(e.target.value || PRICE_MIN))}
                      className="w-full border-none bg-transparent text-2xl font-bold text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className={`flex items-center gap-3 ${INPUT_CONTAINER_CLASS}`}>
                  <span className="w-7 text-lg font-bold text-gray-900">{currencySymbol}</span>
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 font-medium">Max</div>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={filters.priceRange[1]}
                      onChange={(e) => setMaxPrice(Number(e.target.value || PRICE_MAX))}
                      className="w-full border-none bg-transparent text-2xl font-bold text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preferred Locations */}
          <div>
            <h3 className={`${FIELD_LABEL_CLASS} mb-2`}>Preferred Location</h3>

            {/* Embedded location preview — same bordered-card pattern as
                Event Assistant's Location field (map preview + resolved
                address line below, in one card). "Near Me" is the only
                filter concept here with actual coordinates to preview, so
                it's what this card previews; the map only renders once
                Near Me is active — a MapPin placeholder fills the space
                otherwise. "Use my area" and the city chips stay as their
                own quick-select chips below, unchanged. */}
            <button
              type="button"
              onClick={toggleNearMe}
              disabled={isLocating}
              className={`mb-3 w-full overflow-hidden rounded-2xl bg-white text-left transition-all disabled:opacity-70 ${
                filters.nearMe ? 'border-2 border-sky-500' : 'border border-sky-100 hover:border-sky-300'
              }`}
            >
              {filters.nearMe ? (
                <div className="h-36 w-full">
                  <LeafletLocationPreview
                    latitude={filters.nearMe.latitude}
                    longitude={filters.nearMe.longitude}
                    title="Your area"
                    interactive={false}
                  />
                </div>
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-sky-50">
                  {isLocating ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : <MapPin className="h-6 w-6 text-gray-400" />}
                </div>
              )}
              <div className="flex items-center gap-2 p-4">
                <LocateFixed className="h-4 w-4 flex-shrink-0 text-gray-500" />
                <span className={filters.nearMe ? 'text-sm font-bold text-gray-900' : 'text-sm text-gray-400'}>
                  {isLocating ? 'Locating...' : filters.nearMe ? `Near me — within ${filters.nearMe.radiusKm} km` : 'Use my current location'}
                </span>
              </div>
            </button>

            {filters.nearMe && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50/50 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">Within</span>
                {NEAR_ME_RADIUS_OPTIONS_KM.map((km) => (
                  <button
                    key={km}
                    onClick={() => setNearMeRadius(km)}
                    className={chipClass(filters.nearMe?.radiusKm === km)}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            )}

            {locateError && <p className="mb-3 text-sm text-red-600">{locateError}</p>}

            {/* "Use my area" chip removed — redundant with the GPS "Near
                Me" card above now that both offered an "auto-fill my
                location" path; the card stays as the single option. */}

            <div className="flex flex-wrap gap-3">
              {locationOptions.map((location) => {
                const isSelected = filters.locations.includes(location);
                return (
                  <button
                    key={location}
                    onClick={() => toggleLocation(location)}
                    className={chipClass(isSelected)}
                  >
                    {location}
                  </button>
                );
              })}

              {filters.locations
                .filter((location) => !locationOptions.includes(location) && location.toLowerCase() !== (userLocation || '').toLowerCase())
                .map((location) => (
                  <button
                    key={location}
                    onClick={() => toggleLocation(location)}
                    className={`${CHIP_BASE_CLASS} ${CHIP_SELECTED_CLASS} flex items-center gap-1.5`}
                  >
                    {location} <X className="h-3.5 w-3.5" />
                  </button>
                ))}

              {!showOtherInput ? (
                <button
                  onClick={() => setShowOtherInput(true)}
                  className={`${CHIP_BASE_CLASS} border-2 border-dashed border-sky-200 font-medium text-gray-600 hover:border-sky-400 hover:bg-sky-50`}
                >
                  + Other
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={otherLocationDraft}
                    onChange={(event) => setOtherLocationDraft(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && applyOtherLocation()}
                    placeholder="e.g. Krabi"
                    className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-sky-400"
                  />
                  <button onClick={applyOtherLocation} className="rounded-xl border-2 border-sky-400 px-4 py-2.5 text-sm font-semibold text-sky-600 hover:bg-gradient-to-r hover:from-sky-500 hover:to-blue-600 hover:text-white hover:border-transparent">
                    Add
                  </button>
                  <button onClick={() => { setShowOtherInput(false); setOtherLocationDraft(''); }} className="p-2 text-gray-400 hover:text-gray-900">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between border-t border-sky-100 pt-6">
          <button
            onClick={handleClearAll}
            className="rounded-xl border border-sky-200 bg-white px-6 py-3.5 font-semibold text-gray-700 transition-colors hover:bg-sky-50"
          >
            Clear All
          </button>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
