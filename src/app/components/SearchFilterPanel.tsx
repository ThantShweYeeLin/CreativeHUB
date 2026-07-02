import { X, Sparkles, DollarSign } from 'lucide-react';
import { useState } from 'react';

interface SearchFilterPanelProps {
  onClose: () => void;
  onSearch: (filters: FilterState) => void;
}

export interface FilterState {
  services: string[];
  priceRange: [number, number];
  locations: string[];
}

const serviceOptions = [
  'Photography',
  'Fashion & Styling',
  'Videography',
  'Graphic Design',
  'Makeup & Beauty',
  'Wedding Planning',
  'Others'
];

const locationOptions = [
  'Bangkok',
  'Chiang Mai',
  'Pattaya',
  'Phuket',
  'Nakhon Ratchasima',
  'Khon Kaen',
  'Udon Thani',
  'Others'
];

const PRICE_MIN = 0;
const PRICE_MAX = 10000;
const PRICE_STEP = 100;

const budgetPresets: Array<{ label: string; range: [number, number] }> = [
  { label: 'Any Budget', range: [0, 10000] },
  { label: 'Under 2,000', range: [0, 2000] },
  { label: '2,000 - 5,000', range: [2000, 5000] },
  { label: '5,000 - 8,000', range: [5000, 8000] },
  { label: '8,000+', range: [8000, 10000] },
];

export function SearchFilterPanel({ onClose, onSearch }: SearchFilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    services: [],
    priceRange: [PRICE_MIN, PRICE_MAX],
    locations: []
  });

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

  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl flex items-center justify-between z-10">
          <h2 className="text-3xl font-bold text-gray-900">Advanced Filters</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Types of Services */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Types of Services</h3>
            <div className="flex flex-wrap gap-3">
              {serviceOptions.map((service) => {
                const isSelected = filters.services.includes(service);
                return (
                  <button
                    key={service}
                    onClick={() => toggleService(service)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {service}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Price Range (THB)</h3>
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {budgetPresets.map((preset) => {
                  const isActive =
                    filters.priceRange[0] === preset.range[0] &&
                    filters.priceRange[1] === preset.range[1];
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setFilters((prev) => ({ ...prev, priceRange: preset.range }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Price display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-xl border-2 border-gray-200">
                  <DollarSign className="w-5 h-5 text-gray-900" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 font-medium">Min</div>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={filters.priceRange[0]}
                      onChange={(e) => setMinPrice(Number(e.target.value || PRICE_MIN))}
                      className="w-full bg-transparent text-xl font-bold text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-xl border-2 border-gray-200">
                  <DollarSign className="w-5 h-5 text-gray-900" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 font-medium">Max</div>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={filters.priceRange[1]}
                      onChange={(e) => setMaxPrice(Number(e.target.value || PRICE_MAX))}
                      className="w-full bg-transparent text-xl font-bold text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Tip: Choose a preset for quick filtering, or type your exact minimum and maximum budget.
              </p>
            </div>
          </div>

          {/* Preferred Locations */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Preferred Location</h3>
            <div className="flex flex-wrap gap-3">
              {locationOptions.map((location) => {
                const isSelected = filters.locations.includes(location);
                return (
                  <button
                    key={location}
                    onClick={() => toggleLocation(location)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {location}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 rounded-b-3xl flex items-center justify-between">
          <button
            onClick={() => setFilters({ services: [], priceRange: [PRICE_MIN, PRICE_MAX], locations: [] })}
            className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
    </div>
  );
}
