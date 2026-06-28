import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { LatLngExpression, divIcon } from 'leaflet';
import { Filter, Layers, Navigation, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { FreelancerMapProfile, normalizeFreelancer } from '../../lib/freelanceMapper';
import { geocodeAddress } from '../../lib/osmGeocoding';

type Availability = 'available' | 'busy' | 'unavailable';
type BudgetBand = 'all' | 'under-100' | '100-300' | '300-500' | '500-plus';

interface MapViewProps {
  onViewProfile?: (freelancerId: string) => void;
}

const professionFilters = [
  'Photographer',
  'Makeup Artist',
  'Hair Stylist',
  'Designer',
  'Model',
  'Videographer',
] as const;

const availabilityFilters: { key: Availability; label: string; dot: string }[] = [
  { key: 'available', label: 'Available', dot: '🟢' },
  { key: 'busy', label: 'Busy', dot: '🟡' },
  { key: 'unavailable', label: 'Unavailable', dot: '🔴' },
];

const distanceFilters = [5, 10, 25, 50] as const;

function professionLabel(value: string): (typeof professionFilters)[number] | null {
  const text = value.toLowerCase();
  if (text.includes('photographer')) return 'Photographer';
  if (text.includes('makeup')) return 'Makeup Artist';
  if (text.includes('hair')) return 'Hair Stylist';
  if (text.includes('design')) return 'Designer';
  if (text.includes('model')) return 'Model';
  if (text.includes('video')) return 'Videographer';
  return null;
}

function detectProfession(freelancer: FreelancerMapProfile): (typeof professionFilters)[number] | null {
  const combined = `${freelancer.profession} ${(freelancer.skills || []).join(' ')}`;
  return professionLabel(combined);
}

function availabilityStatus(freelancer: FreelancerMapProfile): Availability {
  const text = freelancer.availability.join(' ').toLowerCase();
  if (text.includes('busy')) return 'busy';
  if (text.includes('unavailable') || !freelancer.isAvailable) return 'unavailable';
  return 'available';
}

function professionVisual(freelancer: FreelancerMapProfile) {
  const label = detectProfession(freelancer);
  switch (label) {
    case 'Photographer':
      return { accent: '#0ea5e9', glyph: 'PH' };
    case 'Makeup Artist':
      return { accent: '#db2777', glyph: 'MU' };
    case 'Hair Stylist':
      return { accent: '#f59e0b', glyph: 'HR' };
    case 'Designer':
      return { accent: '#7c3aed', glyph: 'DS' };
    case 'Model':
      return { accent: '#14b8a6', glyph: 'MD' };
    case 'Videographer':
      return { accent: '#ef4444', glyph: 'VD' };
    default:
      return { accent: '#475569', glyph: 'CR' };
  }
}

function statusColor(status: Availability) {
  if (status === 'available') return '#16a34a';
  if (status === 'busy') return '#ca8a04';
  return '#dc2626';
}

function freelancerMarkerIcon(freelancer: FreelancerMapProfile) {
  const status = availabilityStatus(freelancer);
  const color = statusColor(status);
  const visual = professionVisual(freelancer);

  return divIcon({
    className: '',
    html: `
      <svg width="38" height="48" viewBox="0 0 38 48" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 6px 10px rgba(0,0,0,.28));">
        <path d="M19 46C19 46 34 31.8 34 20.4C34 12.14 27.06 5.4 19 5.4C10.94 5.4 4 12.14 4 20.4C4 31.8 19 46 19 46Z" fill="#111827" stroke="${color}" stroke-width="3"/>
        <circle cx="19" cy="20" r="8.4" fill="${visual.accent}"/>
        <text x="19" y="23" text-anchor="middle" font-size="6.4" font-weight="700" fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, sans-serif">${visual.glyph}</text>
      </svg>
    `,
    iconSize: [38, 48],
    iconAnchor: [19, 46],
  });
}

const clientMarkerIcon = divIcon({
  className: '',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#2563eb;color:#ffffff;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.35);font-size:14px;font-weight:700;">
      YOU
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function inBudgetBand(hourlyRate: number | undefined, band: BudgetBand) {
  if (band === 'all') return true;
  if (!Number.isFinite(hourlyRate)) return false;
  const amount = Number(hourlyRate);
  if (band === 'under-100') return amount < 100;
  if (band === '100-300') return amount >= 100 && amount <= 300;
  if (band === '300-500') return amount > 300 && amount <= 500;
  return amount > 500;
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

export function MapView({ onViewProfile }: MapViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [freelancers, setFreelancers] = useState<FreelancerMapProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProfessions, setSelectedProfessions] = useState<string[]>([...professionFilters]);
  const [selectedAvailability, setSelectedAvailability] = useState<Availability[]>(['available', 'busy', 'unavailable']);
  const [budgetBand, setBudgetBand] = useState<BudgetBand>('all');
  const [distanceLimitKm, setDistanceLimitKm] = useState<number | null>(null);
  const [clientLocation, setClientLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const handleViewProfile = (freelancerId: string) => {
    const targetId = freelancers.find((item) => item.id === freelancerId)?.userId || freelancerId;

    if (onViewProfile) {
      onViewProfile(targetId);
      return;
    }

    navigate(`/profile/${targetId}`);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      const [freelancerResponse, userResponse] = await Promise.all([
        DataService.getAllFreelancers(200),
        user?.id ? DataService.getUser(user.id) : Promise.resolve({ data: null, error: null }),
      ]);

      if (!isMounted) return;

      if (freelancerResponse.error) {
        setErrorMessage(freelancerResponse.error.message || 'Failed to load freelancers.');
        setFreelancers([]);
        setSelectedId(null);
        setIsLoading(false);
        return;
      }

      let normalized = (freelancerResponse.data || [])
        .map(normalizeFreelancer)
        .filter((freelancer) => freelancer.id && freelancer.latitude !== null && freelancer.longitude !== null);

      if (normalized.length === 0) {
        const missingCoordinates = (freelancerResponse.data || [])
          .map(normalizeFreelancer)
          .filter((freelancer) => freelancer.id && (freelancer.latitude === null || freelancer.longitude === null) && freelancer.location);

        const resolved = await Promise.all(
          missingCoordinates.slice(0, 30).map(async (freelancer) => {
            const geocoded = await geocodeAddress(freelancer.location || '');
            if (!geocoded) {
              return freelancer;
            }

            return {
              ...freelancer,
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
              location: geocoded.formattedAddress || freelancer.location,
            };
          })
        );

        normalized = resolved.filter((freelancer) => freelancer.latitude !== null && freelancer.longitude !== null);
      }

      setFreelancers(normalized);
      setSelectedId(normalized[0]?.id || null);

      const userLat = toFiniteNumber(userResponse.data?.location_latitude);
      const userLng = toFiniteNumber(userResponse.data?.location_longitude);

      if (userLat !== null && userLng !== null) {
        setClientLocation({
          lat: userLat,
          lng: userLng,
          label: userResponse.data.location || 'Your location',
        });
      } else {
        const userLocationText = userResponse.data?.location || '';
        if (userLocationText) {
          const geocodedUserLocation = await geocodeAddress(userLocationText);
          if (geocodedUserLocation) {
            setClientLocation({
              lat: geocodedUserLocation.latitude,
              lng: geocodedUserLocation.longitude,
              label: geocodedUserLocation.formattedAddress,
            });
          } else {
            setClientLocation(null);
          }
        } else {
          setClientLocation(null);
        }
      }

      setIsLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const filteredFreelancers = useMemo(() => {
    const allProfessionsSelected = selectedProfessions.length === professionFilters.length;

    return freelancers.filter((freelancer) => {
      const profession = detectProfession(freelancer);
      const status = availabilityStatus(freelancer);

      if (!profession && !allProfessionsSelected) {
        return false;
      }

      if (profession && !selectedProfessions.includes(profession)) {
        return false;
      }

      if (!selectedAvailability.includes(status)) {
        return false;
      }

      if (!inBudgetBand(freelancer.hourlyRate, budgetBand)) {
        return false;
      }

      if (distanceLimitKm && clientLocation) {
        const freelancerDistance = distanceKm(
          clientLocation.lat,
          clientLocation.lng,
          freelancer.latitude as number,
          freelancer.longitude as number
        );
        if (freelancerDistance > distanceLimitKm) {
          return false;
        }
      }

      return true;
    });
  }, [freelancers, selectedProfessions, selectedAvailability, budgetBand, distanceLimitKm, clientLocation]);

  const selectedFreelancer = filteredFreelancers.find((freelancer) => freelancer.id === selectedId) || null;

  const center: LatLngExpression = useMemo(() => {
    if (clientLocation) {
      return [clientLocation.lat, clientLocation.lng];
    }

    const first = filteredFreelancers[0];
    if (
      first &&
      Number.isFinite(first.latitude) &&
      Number.isFinite(first.longitude)
    ) {
      return [first.latitude as number, first.longitude as number];
    }

    return [13.7563, 100.5018];
  }, [clientLocation, filteredFreelancers]);

  const toggleProfession = (profession: string) => {
    setSelectedProfessions((current) =>
      current.includes(profession)
        ? current.filter((item) => item !== profession)
        : [...current, profession]
    );
  };

  const toggleAvailability = (availability: Availability) => {
    setSelectedAvailability((current) =>
      current.includes(availability)
        ? current.filter((item) => item !== availability)
        : [...current, availability]
    );
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-xl md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-900" />
            <h2 className="text-lg font-bold text-gray-900">Map Filters</h2>
          </div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((current) => !current)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {filtersExpanded ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {!filtersExpanded && (
          <p className="mb-2 text-sm text-gray-600">
            {filteredFreelancers.length} match this filter set. Expand filters to refine profession, availability, budget, and distance.
          </p>
        )}

        {filtersExpanded && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Filter by Profession</h3>
            <div className="space-y-2 text-sm">
              {professionFilters.map((profession) => (
                <label key={profession} className="flex items-center gap-2 text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedProfessions.includes(profession)}
                    onChange={() => toggleProfession(profession)}
                  />
                  {profession}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Availability Filter</h3>
            <div className="space-y-2 text-sm">
              {availabilityFilters.map((availability) => (
                <label key={availability.key} className="flex items-center gap-2 text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedAvailability.includes(availability.key)}
                    onChange={() => toggleAvailability(availability.key)}
                  />
                  <span>{availability.dot} {availability.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Budget Filter</h3>
            <div className="space-y-2 text-sm">
              {[
                { key: 'all' as const, label: 'All' },
                { key: 'under-100' as const, label: '< $100' },
                { key: '100-300' as const, label: '$100-$300' },
                { key: '300-500' as const, label: '$300-$500' },
                { key: '500-plus' as const, label: '$500+' },
              ].map((band) => (
                <label key={band.key} className="flex items-center gap-2 text-gray-700">
                  <input
                    type="radio"
                    name="budget-band"
                    checked={budgetBand === band.key}
                    onChange={() => setBudgetBand(band.key)}
                  />
                  {band.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Distance Filter</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="distance-filter"
                  checked={distanceLimitKm === null}
                  onChange={() => setDistanceLimitKm(null)}
                />
                Any distance
              </label>
              {distanceFilters.map((distance) => (
                <label key={distance} className="flex items-center gap-2 text-gray-700">
                  <input
                    type="radio"
                    name="distance-filter"
                    checked={distanceLimitKm === distance}
                    onChange={() => setDistanceLimitKm(distance)}
                    disabled={!clientLocation}
                  />
                  Within {distance} km
                </label>
              ))}
              {!clientLocation && (
                <p className="text-xs text-gray-500">Set your profile location to enable distance filtering.</p>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="relative h-[460px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl md:h-[calc(100vh-240px)]">
        <MapContainer center={center} zoom={12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {clientLocation && (
            <>
              {distanceLimitKm ? (
                <Circle
                  center={[clientLocation.lat, clientLocation.lng]}
                  radius={distanceLimitKm * 1000}
                  pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.08 }}
                />
              ) : null}
              <Marker position={[clientLocation.lat, clientLocation.lng]} icon={clientMarkerIcon}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold text-gray-900">Your Location</p>
                    <p className="text-gray-600">{clientLocation.label}</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {filteredFreelancers.map((freelancer) => (
            <Marker
              key={freelancer.id}
              position={[freelancer.latitude as number, freelancer.longitude as number]}
              icon={freelancerMarkerIcon(freelancer)}
              eventHandlers={{
                click: () => setSelectedId(freelancer.id),
              }}
            >
              <Popup>
                <div className="w-56">
                  <div className="mb-2 h-24 overflow-hidden rounded-lg border border-gray-200">
                    <ImageWithFallback
                      src={freelancer.coverImage || freelancer.profileImage}
                      alt={`${freelancer.fullName} preview`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h4 className="text-base font-bold text-gray-900">{freelancer.fullName}</h4>
                  <p className="text-sm text-gray-600">{freelancer.profession}</p>
                  <p className="mt-1 text-xs text-gray-500">{freelancer.location}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-700">
                    <span>★ {freelancer.rating.toFixed(1)}</span>
                    <span>{freelancer.totalProjects} projects</span>
                    {Number.isFinite(freelancer.hourlyRate) ? <span>${freelancer.hourlyRate}/h</span> : null}
                  </div>
                  <button
                    onClick={() => handleViewProfile(freelancer.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    View Profile
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="pointer-events-none absolute top-4 left-4 z-[500] rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Navigation className="h-4 w-4" />
            OpenStreetMap Live View
          </div>
          <p className="mt-1 text-xs text-gray-600">{filteredFreelancers.length} freelancers match filters</p>
        </div>

        {(isLoading || errorMessage || (!isLoading && !errorMessage && filteredFreelancers.length === 0)) && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-center shadow-xl">
              {isLoading ? (
                <>
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
                  <p className="font-semibold text-gray-900">Loading freelancers...</p>
                </>
              ) : errorMessage ? (
                <>
                  <p className="font-semibold text-gray-900">Unable to load freelancers</p>
                  <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">No freelancers match these filters</p>
                  <p className="mt-1 text-sm text-gray-600">Try relaxing profession, availability, budget, or distance filters.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-xl md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Freelancers Near You</h2>
            <p className="text-sm text-gray-600">Profile previews from the current map filters.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
            {filteredFreelancers.length} shown
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFreelancers.map((freelancer) => (
            <button
              key={freelancer.id}
              onClick={() => {
                setSelectedId(freelancer.id);
                handleViewProfile(freelancer.id);
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                selectedId === freelancer.id
                  ? 'border-gray-900 bg-gray-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl ring-2 ring-white shadow">
                  <ImageWithFallback src={freelancer.profileImage} alt={freelancer.fullName} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-gray-900">{freelancer.fullName}</h3>
                  <p className="truncate text-xs text-gray-600">{freelancer.profession}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{freelancer.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-700">
                <span>★ {freelancer.rating.toFixed(1)}</span>
                <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{freelancer.totalProjects}</span>
                {Number.isFinite(freelancer.hourlyRate) ? <span>${freelancer.hourlyRate}/h</span> : null}
              </div>
            </button>
          ))}
        </div>

        {!isLoading && !errorMessage && filteredFreelancers.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">No freelancers match filters</p>
            <p className="mt-1">Try enabling more professions, widening distance, or selecting a broader budget band.</p>
          </div>
        )}
      </div>
    </div>
  );
}
