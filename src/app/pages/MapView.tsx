import { Sparkles, MapPin as MapPinIcon, Layers, Navigation, Users, Camera, Palette, User, X, Filter } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { DataService } from '../../lib/dataService';
import { FreelancerMapProfile, normalizeFreelancer } from '../../lib/freelanceMapper';
type PositionedFreelancer = FreelancerMapProfile & {
  position: { x: number; y: number };
};

function getFreelancerPositions(freelancers: FreelancerMapProfile[]): PositionedFreelancer[] {
  const freelancersWithCoordinates = freelancers.filter(
    (freelancer) => freelancer.latitude !== null && freelancer.longitude !== null
  );
  const latitudes = freelancersWithCoordinates.map((freelancer) => freelancer.latitude as number);
  const longitudes = freelancersWithCoordinates.map((freelancer) => freelancer.longitude as number);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  return freelancers.map((freelancer, index) => {
    const hasCoordinates = freelancer.latitude !== null && freelancer.longitude !== null;
    const fallbackX = 20 + ((index * 17) % 60);
    const fallbackY = 25 + ((index * 23) % 50);

    return {
      ...freelancer,
      position: {
        x: hasCoordinates ? 10 + (((freelancer.longitude as number) - minLng) / lngRange) * 80 : fallbackX,
        y: hasCoordinates ? 90 - (((freelancer.latitude as number) - minLat) / latRange) * 80 : fallbackY,
      },
    };
  });
}

interface MapMarkerProps {
  freelancer: PositionedFreelancer;
  isSelected: boolean;
  onClick: () => void;
}

function MapMarker({ freelancer, isSelected, onClick }: MapMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
      style={{
        left: `${freelancer.position.x}%`,
        top: `${freelancer.position.y}%`
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isSelected && (
        <div className="absolute inset-0 -m-4">
          <div className="w-24 h-24 rounded-full bg-gray-500/30 animate-ping" />
        </div>
      )}

      <div className={`relative transition-all duration-300 ${isSelected ? 'scale-125' : isHovered ? 'scale-110' : ''}`}>
        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden ring-2 md:ring-4 ring-white shadow-2xl bg-white">
          <ImageWithFallback
            src={freelancer.profileImage}
            alt={freelancer.fullName}
            className="w-full h-full object-cover"
          />
        </div>

        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap transition-all ${
          isSelected
            ? 'bg-gradient-to-r from-gray-900 to-black text-white'
            : 'bg-white text-gray-700 shadow-md'
        }`}>
          {freelancer.profession.split(' ')[0]}
        </div>
      </div>

      {(isHovered || isSelected) && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 w-72 pointer-events-none animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl overflow-visible border-2 border-gray-100">
            <div className="h-20 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative rounded-t-2xl">
              <ImageWithFallback
                src={freelancer.coverImage}
                alt={`${freelancer.fullName} cover`}
                className="absolute inset-0 w-full h-full object-cover rounded-t-2xl"
              />
              <div className="absolute inset-0 bg-black/20 rounded-t-2xl" />
            </div>
            <div className="p-5 pt-0 relative">
              <div className="absolute -top-10 left-5">
                <div className="w-20 h-20 rounded-xl overflow-hidden ring-4 ring-white shadow-xl bg-white">
                  <ImageWithFallback
                    src={freelancer.profileImage}
                    alt={freelancer.fullName}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="pt-12">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{freelancer.fullName}</h3>
                    <p className="text-sm text-gray-600 mb-2">{freelancer.profession}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <MapPinIcon className="w-3.5 h-3.5 text-gray-900" />
                  <span className="font-medium">{freelancer.location}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    <span className="font-semibold text-gray-900">{freelancer.rating}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Layers className="w-4 h-4" />
                    <span>{freelancer.totalProjects} projects</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MapViewProps {
  onViewProfile?: (freelancerId: string) => void;
}

export function MapView({ onViewProfile }: MapViewProps) {
  const navigate = useNavigate();
  const [freelancers, setFreelancers] = useState<FreelancerMapProfile[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterPosition, setFilterPosition] = useState({ x: 20, y: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; elemX: number; elemY: number } | null>(null);

  const categoryIcons = {
    all: Users,
    photographers: Camera,
    'makeup artists': Palette,
    models: User,
  };

  const positionedFreelancers = useMemo(() => getFreelancerPositions(freelancers), [freelancers]);
  const filteredFreelancers = positionedFreelancers.filter((f) => {
    if (filterCategory === 'all') return true;
    const profession = f.profession.toLowerCase();
    if (filterCategory === 'photographers') return profession.includes('photographer');
    if (filterCategory === 'makeup artists') return profession.includes('makeup');
    if (filterCategory === 'models') return profession.includes('model');
    return profession.includes(filterCategory);
  });
  const selectedFreelancer = positionedFreelancers.find((freelancer) => freelancer.id === selectedMarkerId);

  const getCategoryCount = (category: string) => {
    if (category === 'all') return positionedFreelancers.length;

    return positionedFreelancers.filter((freelancer) => {
      const profession = freelancer.profession.toLowerCase();
      if (category === 'photographers') return profession.includes('photographer');
      if (category === 'makeup artists') return profession.includes('makeup');
      if (category === 'models') return profession.includes('model');
      return profession.includes(category);
    }).length;
  };

  const handleViewProfile = (freelancerId: string) => {
    if (onViewProfile) {
      onViewProfile(freelancerId);
      return;
    }

    navigate(`/profile/${freelancerId}`);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadFreelancers() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await DataService.getAllFreelancers();

      if (!isMounted) return;

      if (error) {
        setErrorMessage(error.message || 'Failed to load freelancers.');
        setFreelancers([]);
        setSelectedMarkerId(null);
        setIsLoading(false);
        return;
      }

      const normalizedFreelancers = (data ?? [])
        .map(normalizeFreelancer)
        .filter((freelancer) => freelancer.id && freelancer.latitude !== null && freelancer.longitude !== null);

      setFreelancers(normalizedFreelancers);
      setSelectedMarkerId((currentId) => {
        if (currentId && normalizedFreelancers.some((freelancer) => freelancer.id === currentId)) {
          return currentId;
        }

        return normalizedFreelancers[0]?.id ?? null;
      });
      setIsLoading(false);
    }

    loadFreelancers();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      elemX: filterPosition.x,
      elemY: filterPosition.y
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    setFilterPosition({
      x: dragRef.current.elemX + deltaX,
      y: dragRef.current.elemY + deltaY
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  // Add mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="space-y-6 md:space-y-8">
    <div className="relative h-[400px] md:h-[calc(100vh-200px)]">
      {/* Main Map Container */}
      <div className="absolute inset-0 bg-gray-100 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
        {/* Map Background with Streets Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100">
          {/* Street Grid Pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-30">
            <defs>
              <pattern id="street-grid" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <line x1="0" y1="50" x2="100" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="0" y1="25" x2="100" y2="25" stroke="#cbd5e1" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="#cbd5e1" strokeWidth="0.5" />
                <line x1="25" y1="0" x2="25" y2="100" stroke="#cbd5e1" strokeWidth="0.5" />
                <line x1="75" y1="0" x2="75" y2="100" stroke="#cbd5e1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#street-grid)" />
          </svg>

          {/* Neighborhoods/Districts - Subtle Color Zones */}
          <div className="absolute top-0 left-0 w-1/3 h-2/5 bg-gray-200/10 rounded-br-[100px]" />
          <div className="absolute top-0 right-0 w-2/5 h-1/3 bg-gray-200/10 rounded-bl-[120px]" />
          <div className="absolute bottom-0 left-0 w-2/5 h-2/5 bg-gray-200/10 rounded-tr-[110px]" />
          <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-gray-200/10 rounded-tl-[90px]" />

          {/* Accent Elements - Parks/Landmarks */}
          <div className="absolute top-1/4 left-1/4 w-24 h-24 bg-green-300/20 rounded-full blur-xl" />
          <div className="absolute bottom-1/3 right-1/4 w-32 h-32 bg-emerald-300/20 rounded-full blur-xl" />
        </div>

        {/* Top Info Bar */}
        <div className="absolute top-3 md:top-6 left-0 right-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-0 px-3 md:px-6">
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg px-3 md:px-5 py-2 md:py-3 flex items-center gap-2 md:gap-3 border border-gray-200">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg md:rounded-xl flex items-center justify-center">
              <Navigation className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Location</p>
              <p className="text-sm md:text-base font-bold text-gray-900">Bangkok, Thailand</p>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg px-3 md:px-5 py-2 md:py-3 flex items-center gap-2 md:gap-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Available Now</p>
                <p className="text-sm md:text-base font-bold text-gray-900">{filteredFreelancers.length} Freelancers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Freelancer Markers */}
        <div className="absolute inset-0">
          {filteredFreelancers.map((freelancer) => (
            <MapMarker
              key={freelancer.id}
              freelancer={freelancer}
              isSelected={selectedMarkerId === freelancer.id}
              onClick={() => setSelectedMarkerId(freelancer.id)}
            />
          ))}
        </div>

        {(isLoading || errorMessage || (!isLoading && !errorMessage && filteredFreelancers.length === 0)) && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 flex justify-center pointer-events-none">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl border border-gray-200 px-5 py-4 text-center max-w-sm">
              {isLoading ? (
                <>
                  <div className="mx-auto mb-3 h-8 w-8 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
                  <p className="font-semibold text-gray-900">Loading freelancers...</p>
                </>
              ) : errorMessage ? (
                <>
                  <p className="font-semibold text-gray-900">Unable to load freelancers</p>
                  <p className="text-sm text-gray-600 mt-1">{errorMessage}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">No freelancers found</p>
                  <p className="text-sm text-gray-600 mt-1">Try another category or add freelancer coordinates in the database.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Draggable Filter Button */}
      <div
        className="absolute z-30 cursor-move hidden md:block"
        style={{ left: `${filterPosition.x}px`, top: `${filterPosition.y}px` }}
        onMouseDown={handleMouseDown}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) {
              setShowFilterModal(true);
            }
          }}
          className="w-16 h-16 bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-all group border-4 border-white"
        >
          <Filter className="w-7 h-7 text-white" />
          {filterCategory !== 'all' && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-xs font-bold text-white">1</span>
            </div>
          )}
        </button>
        <p className="text-center text-xs font-semibold text-gray-700 mt-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow">
          Drag me!
        </p>
      </div>

      {/* Mobile Filter Button */}
      <button
        onClick={() => setShowFilterModal(true)}
        className="md:hidden absolute top-20 right-3 z-30 w-14 h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl shadow-2xl flex items-center justify-center border-2 border-white"
      >
        <Filter className="w-6 h-6 text-white" />
        {filterCategory !== 'all' && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-xs font-bold text-white">1</span>
          </div>
        )}
      </button>

      {/* Filter Modal */}
      {showFilterModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowFilterModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-w-lg w-full animate-fadeIn max-h-[85vh] md:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-3xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center">
                      <Filter className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Filter Freelancers</h3>
                      <p className="text-sm text-gray-600">Select a category to filter</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFilterModal(false)}
                    className="p-2 hover:bg-white rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Filter Options */}
              <div className="p-4 md:p-6 space-y-2 md:space-y-3 overflow-y-auto flex-1">
                {Object.entries(categoryIcons).map(([category, Icon]) => {
                  const isActive = filterCategory === category;
                  const count = getCategoryCount(category);

                  return (
                    <button
                      key={category}
                      onClick={() => {
                        setFilterCategory(category);
                        setShowFilterModal(false);
                      }}
                      className={`w-full flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-xl scale-[1.02]'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:scale-[1.01]'
                      }`}
                    >
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center ${
                        isActive ? 'bg-white/20' : 'bg-gray-100'
                      }`}>
                        <Icon className={`w-5 h-5 md:w-6 md:h-6 ${isActive ? 'text-white' : 'text-gray-900'}`} />
                      </div>
                      <span className="capitalize flex-1 text-left text-base md:text-lg">{category}</span>
                      <div className={`px-2.5 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold ${
                        isActive ? 'bg-white/20' : 'bg-gray-100 text-black'
                      }`}>
                        {count}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-gray-50 rounded-b-3xl flex-shrink-0">
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setShowFilterModal(false);
                  }}
                  className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-white text-gray-700 rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selected Freelancer Action Card */}
      {selectedFreelancer && (
        <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-30 animate-fadeIn w-[calc(100%-2rem)] md:w-auto">
          <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-5 border-2 border-gray-500">
            <div className="mb-2 md:mb-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Selected Freelancer</p>
              <p className="font-bold text-gray-900 text-base md:text-lg">{selectedFreelancer.fullName}</p>
            </div>
            <button
              onClick={() => handleViewProfile(selectedFreelancer.id)}
              className="w-full flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
              <span>View Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* Zoom Controls - Desktop Only */}
      <div className="hidden md:flex absolute bottom-6 right-6 flex-col gap-2 z-20">
        <button className="w-12 h-12 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-200 flex items-center justify-center hover:scale-110 group">
          <span className="text-2xl font-bold text-gray-600 group-hover:text-gray-900">+</span>
        </button>
        <button className="w-12 h-12 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-200 flex items-center justify-center hover:scale-110 group">
          <span className="text-2xl font-bold text-gray-600 group-hover:text-gray-900">−</span>
        </button>
        <button className="w-12 h-12 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-200 flex items-center justify-center hover:scale-110 group mt-2">
          <Navigation className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
        </button>
      </div>
    </div>

    {/* Freelancers Near You Section */}
    <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-200 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 mb-4 md:mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">Freelancers Near You</h2>
          <p className="text-sm md:text-base text-gray-600">Top-rated professionals in your area</p>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 self-start md:self-auto">
          <p className="text-sm font-semibold text-gray-900">{filteredFreelancers.length} nearby</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredFreelancers.map((freelancer) => (
          <div
            key={freelancer.id}
            onClick={() => handleViewProfile(freelancer.id)}
            className="group cursor-pointer bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-5 border-2 border-gray-200 hover:border-gray-300 transition-all hover:shadow-xl"
          >
            <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden ring-2 ring-white shadow-lg flex-shrink-0">
                <ImageWithFallback
                  src={freelancer.profileImage}
                  alt={freelancer.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base md:text-lg mb-1 truncate group-hover:text-gray-900 transition-colors">
                  {freelancer.fullName}
                </h3>
                <p className="text-xs md:text-sm text-gray-600 mb-2 truncate">{freelancer.profession}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPinIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span>{freelancer.location}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500 text-sm">★</span>
                  <span className="font-semibold text-sm text-gray-900">{freelancer.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-sm">{freelancer.totalProjects}</span>
                </div>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-gray-900 to-black text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all">
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}