import { X, Sparkles, DollarSign } from 'lucide-react';
import { useState } from 'react';

interface SearchFilterPanelProps {
  onClose: () => void;
  onSearch: (filters: FilterState) => void;
}

interface FilterState {
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

export function SearchFilterPanel({ onClose, onSearch }: SearchFilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    services: [],
    priceRange: [1000, 5000],
    locations: []
  });

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
              <div className="relative pt-6">
                {/* Range slider */}
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.priceRange[0]}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: [parseInt(e.target.value), prev.priceRange[1]]
                  }))}
                  className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                  style={{ zIndex: filters.priceRange[0] > filters.priceRange[1] ? 2 : 1 }}
                />
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.priceRange[1]}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: [prev.priceRange[0], parseInt(e.target.value)]
                  }))}
                  className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-gray-900"
                  style={{ zIndex: filters.priceRange[1] < filters.priceRange[0] ? 2 : 1 }}
                />
              </div>

              {/* Price display */}
              <div className="flex items-center justify-between gap-4 mt-12">
                <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 rounded-xl border-2 border-gray-200">
                  <DollarSign className="w-5 h-5 text-gray-900" />
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Min</div>
                    <div className="text-xl font-bold text-gray-900">{filters.priceRange[0].toLocaleString()}</div>
                  </div>
                </div>
                <div className="w-12 h-0.5 bg-gray-300" />
                <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 rounded-xl border-2 border-gray-200">
                  <DollarSign className="w-5 h-5 text-gray-900" />
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Max</div>
                    <div className="text-xl font-bold text-gray-900">{filters.priceRange[1].toLocaleString()}</div>
                  </div>
                </div>
              </div>
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
            onClick={() => setFilters({ services: [], priceRange: [1000, 5000], locations: [] })}
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
