import { X, Sparkles, MapPin, LocateFixed, Loader2, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, getCurrencySymbol, normalizeCurrencyCode, SUPPORTED_CURRENCIES } from '../../lib/currency';
import { FREELANCER_CATEGORY_LABELS } from '../../lib/categories';
import { chipClass, CHIP_BASE_CLASS, CHIP_SELECTED_CLASS, FIELD_LABEL_CLASS, INPUT_CONTAINER_CLASS } from '../../lib/formFieldStyles';

interface SearchFilterPanelProps {
  onClose: () => void;
  onSearch: (filters: FilterState) => void;
  initialFilters?: FilterState;
  /** The signed-in client's own profile location, if set — surfaced as a one-click suggested chip. */
  userLocation?: string | null;
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

function defaultRangeForCurrency(currencyCode: string): [number, number] {
  const max = Math.round(convertAmount(10000, DEFAULT_CURRENCY, currencyCode));
  return [PRICE_MIN, Math.max(PRICE_MIN, max)];
}

export function SearchFilterPanel({ onClose, onSearch, initialFilters, userLocation }: SearchFilterPanelProps) {
  const { currency: preferredCurrency, setCurrency } = useCurrency();
  const normalizedPreferredCurrency = normalizeCurrencyCode(preferredCurrency, DEFAULT_CURRENCY);
  const [filters, setFilters] = useState<FilterState>({
    services: initialFilters?.services || [],
    priceRange: initialFilters?.priceRange || defaultRangeForCurrency(normalizedPreferredCurrency),
    locations: initialFilters?.locations || [],
    currency: normalizeCurrencyCode(initialFilters?.currency || normalizedPreferredCurrency, DEFAULT_CURRENCY),
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
        currency: normalizeCurrencyCode(initialFilters.currency || normalizedPreferredCurrency, DEFAULT_CURRENCY),
        nearMe: initialFilters.nearMe || null,
        minRating: initialFilters.minRating ?? null,
      });
      return;
    }

    setFilters((prev) => ({
      ...prev,
      currency: normalizeCurrencyCode(prev.currency || normalizedPreferredCurrency, DEFAULT_CURRENCY),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters, normalizedPreferredCurrency]);

  const budgetPresets = useMemo(() => {
    const selectedCurrency = normalizeCurrencyCode(filters.currency, DEFAULT_CURRENCY);

    return budgetPresetsBaseThb.map((preset) => {
      const convertedRange: [number, number] = [
        Math.round(convertAmount(preset.range[0], DEFAULT_CURRENCY, selectedCurrency)),
        Math.round(convertAmount(preset.range[1], DEFAULT_CURRENCY, selectedCurrency)),
      ];

      const label = (() => {
        if (preset.type === 'any') return 'Any Budget';
        if (preset.type === 'under') return `Under ${formatCurrencyAmount(convertedRange[1], selectedCurrency)}`;
        if (preset.type === 'over') return `${formatCurrencyAmount(convertedRange[0], selectedCurrency)}+`;
        return `${formatCurrencyAmount(convertedRange[0], selectedCurrency)} - ${formatCurrencyAmount(convertedRange[1], selectedCurrency)}`;
      })();

      return {
        key: preset.key,
        label,
        range: convertedRange,
      };
    });
  }, [filters.currency]);

  const currencySymbol = getCurrencySymbol(filters.currency);

  const setMinPrice = (value: number) => {
    const safeMin = Math.max(PRICE_MIN, Math.min(value, filters.priceRange[1]));
    setFilters((prev) => ({
      ...prev,
      priceRange: [safeMin, prev.priceRange[1]],
    }));
  };

  const handleCurrencyChange = (value: string) => {
    const nextCurrency = normalizeCurrencyCode(value, DEFAULT_CURRENCY);

    setFilters((prev) => {
      const currentCurrency = normalizeCurrencyCode(prev.currency, DEFAULT_CURRENCY);
      const nextMin = Math.max(PRICE_MIN, Math.round(convertAmount(prev.priceRange[0], currentCurrency, nextCurrency)));
      const nextMax = Math.min(PRICE_MAX, Math.round(convertAmount(prev.priceRange[1], currentCurrency, nextCurrency)));

      return {
        ...prev,
        currency: nextCurrency,
        priceRange: [Math.min(nextMin, nextMax), Math.max(nextMin, nextMax)],
      };
    });
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
    void setCurrency(filters.currency, true);
    onSearch(filters);
    onClose();
  };

  return (
    // Above the global top nav / mobile bottom nav (z-[1200], see MainLayout
    // and MobileBottomNav) — otherwise this panel's own header renders
    // underneath the persistent nav bar instead of replacing it.
    <div className="fixed inset-0 z-[1300] overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <button
            onClick={onClose}
            className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gray-900 text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Advanced Filters</h2>
              <p className="text-sm text-gray-600">Narrow results down to providers that fit what you need.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="space-y-6">
          {/* Types of Services */}
          <div>
            <h3 className={`${FIELD_LABEL_CLASS} mb-2`}>Types of Services</h3>
            <div className="flex flex-wrap gap-3">
              {serviceOptions.map((service) => {
                const isSelected = filters.services.includes(service);
                return (
                  <button
                    key={service}
                    onClick={() => toggleService(service)}
                    className={chipClass(isSelected)}
                  >
                    {service}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Rating */}
          <div>
            <h3 className={`${FIELD_LABEL_CLASS} mb-2`}>Minimum Rating</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, minRating: null }))}
                className={chipClass(filters.minRating === null)}
              >
                Any
              </button>
              {RATING_FILTER_OPTIONS.map((rating) => {
                const isSelected = filters.minRating === rating;
                return (
                  <button
                    key={rating}
                    onClick={() => setFilters((prev) => ({ ...prev, minRating: rating }))}
                    className={chipClass(isSelected)}
                  >
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
              <div>
                <label className={`mb-2 block ${FIELD_LABEL_CLASS}`}>Currency</label>
                <select
                  value={filters.currency}
                  onChange={(event) => handleCurrencyChange(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {SUPPORTED_CURRENCIES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} - {item.symbol} {item.label}
                    </option>
                  ))}
                </select>
              </div>

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

            <div className="mb-3 flex flex-wrap gap-3">
              <button
                onClick={toggleNearMe}
                disabled={isLocating}
                className={chipClass(Boolean(filters.nearMe), 'flex items-center gap-2 disabled:opacity-70')}
              >
                {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                {isLocating ? 'Locating...' : 'Near Me'}
              </button>

              {userLocation && (() => {
                const isSelected = filters.locations.some((l) => l.toLowerCase() === userLocation.toLowerCase());
                return (
                  <button
                    onClick={() => toggleLocation(userLocation)}
                    className={`${CHIP_BASE_CLASS} flex items-center gap-2 ${
                      isSelected
                        ? CHIP_SELECTED_CLASS
                        : 'border-2 border-dashed border-gray-300 bg-white font-medium text-gray-600 hover:border-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <MapPin className="h-4 w-4" /> Use my area: {userLocation}
                  </button>
                );
              })()}
            </div>

            {filters.nearMe && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
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
                  className={`${CHIP_BASE_CLASS} border-2 border-dashed border-gray-300 font-medium text-gray-600 hover:border-gray-500 hover:bg-gray-50`}
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
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-gray-900"
                  />
                  <button onClick={applyOtherLocation} className="rounded-xl border-2 border-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white">
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
        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
          <button
            onClick={() => {
              setFilters({
                services: [],
                priceRange: defaultRangeForCurrency(normalizedPreferredCurrency),
                locations: [],
                currency: normalizedPreferredCurrency,
                nearMe: null,
                minRating: null,
              });
              setShowOtherInput(false);
              setOtherLocationDraft('');
              setLocateError(null);
            }}
            className="rounded-xl px-6 py-3.5 font-semibold text-gray-700 transition-colors hover:bg-gray-100"
          >
            Clear All
          </button>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-black"
          >
            <Sparkles className="w-5 h-5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
    </div>
  );
}
