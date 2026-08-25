import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { LatLngExpression, divIcon } from 'leaflet';
import { Filter, Layers, Navigation, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
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

function getMapLanguagePreference(): 'en' | 'th' {
  if (typeof window === 'undefined') {
    return 'en';
  }

  try {
    const raw = window.localStorage.getItem('creativehub.settings.v1');
    if (!raw) {
      return 'en';
    }

    const parsed = JSON.parse(raw) as { preferences?: { language?: string } };
    const language = parsed?.preferences?.language;
    return language === 'Thai' || language === 'ไทย' || language === 'th' ? 'th' : 'en';
  } catch {
    return 'en';
  }
}

function translateMapText(language: 'en' | 'th', english: string, thai: string) {
  return language === 'th' ? thai : english;
}

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

function formatDistanceAway(distance: number, language: 'en' | 'th') {
  if (!Number.isFinite(distance)) {
    return null;
  }

  if (distance < 1) {
    return language === 'th'
      ? `${Math.max(100, Math.round(distance * 1000))} m เหนือ` 
      : `${Math.max(100, Math.round(distance * 1000))} m away`;
  }

  return language === 'th'
    ? `${distance.toFixed(1)} กม. away`
    : `${distance.toFixed(1)} km away`;
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
  const [locationSource, setLocationSource] = useState<'profile' | 'device' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [mapLanguage, setMapLanguage] = useState<'en' | 'th'>(() => getMapLanguagePreference());

  const handleViewProfile = (freelancerId: string) => {
    const targetId = freelancers.find((item) => item.id === freelancerId)?.userId || freelancerId;

    if (onViewProfile) {
      onViewProfile(targetId);
      return;
    }

    navigate(`/profile/${targetId}`);
  };

  useEffect(() => {
    const syncMapLanguage = () => {
      setMapLanguage(getMapLanguagePreference());
    };

    syncMapLanguage();
    window.addEventListener('storage', syncMapLanguage);
    window.addEventListener('creativehub-settings-changed', syncMapLanguage);

    return () => {
      window.removeEventListener('storage', syncMapLanguage);
      window.removeEventListener('creativehub-settings-changed', syncMapLanguage);
    };
  }, []);

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
            const geocoded = await geocodeAddress(freelancer.location || '', mapLanguage);
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
        setLocationSource('profile');
      } else {
        const userLocationText = userResponse.data?.location || '';
        if (userLocationText) {
          const geocodedUserLocation = await geocodeAddress(userLocationText, mapLanguage);
          if (geocodedUserLocation) {
            setClientLocation({
              lat: geocodedUserLocation.latitude,
              lng: geocodedUserLocation.longitude,
              label: geocodedUserLocation.formattedAddress,
            });
            setLocationSource('profile');
          } else {
            setClientLocation(null);
            setLocationSource(null);
          }
        } else {
          setClientLocation(null);
          setLocationSource(null);
        }
      }

      setIsLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [mapLanguage, user?.id]);

  useEffect(() => {
    if (!navigator.geolocation || clientLocation) {
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        setClientLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'Current location',
        });
        setLocationSource('device');
      },
      () => {
        // Keep profile-based location when device location is unavailable or denied.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 120000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const distanceByFreelancerId = useMemo(() => {
    const map = new Map<string, number>();

    if (!clientLocation) {
      return map;
    }

    for (const freelancer of freelancers) {
      if (Number.isFinite(freelancer.latitude) && Number.isFinite(freelancer.longitude)) {
        map.set(
          freelancer.id,
          distanceKm(
            clientLocation.lat,
            clientLocation.lng,
            freelancer.latitude as number,
            freelancer.longitude as number
          )
        );
      }
    }

    return map;
  }, [freelancers, clientLocation]);

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
        const freelancerDistance = distanceByFreelancerId.get(freelancer.id);
        if (freelancerDistance === undefined || !Number.isFinite(freelancerDistance)) {
          return false;
        }
        if (freelancerDistance > distanceLimitKm) {
          return false;
        }
      }

      return true;
    });
  }, [freelancers, selectedProfessions, selectedAvailability, budgetBand, distanceLimitKm, clientLocation, distanceByFreelancerId]);

  const selectedFreelancer = filteredFreelancers.find((freelancer) => freelancer.id === selectedId) || null;
  const mapText = {
    filters: translateMapText(mapLanguage, 'Map Filters', 'ตัวกรองแผนที่'),
    hideFilters: translateMapText(mapLanguage, 'Hide Filters', 'ซ่อนตัวกรอง'),
    showFilters: translateMapText(mapLanguage, 'Show Filters', 'แสดงตัวกรอง'),
    matchCount: (count: number) => translateMapText(mapLanguage, `${count} match this filter set. Expand filters to refine profession, availability, budget, and distance.`, `${count} รายการตรงกับตัวกรองนี้ คลิกเพื่อปรับแต่งอาชีพ ความพร้อม ค่าบริการ และระยะทาง`),
    profession: translateMapText(mapLanguage, 'Filter by Profession', 'กรองตามอาชีพ'),
    availability: translateMapText(mapLanguage, 'Availability Filter', 'กรองความพร้อม'),
    budget: translateMapText(mapLanguage, 'Budget Filter', 'กรองงบประมาณ'),
    distance: translateMapText(mapLanguage, 'Distance Filter', 'กรองระยะทาง'),
    anyDistance: translateMapText(mapLanguage, 'Any distance', 'ทุกระยะทาง'),
    withinDistance: (distance: number) => translateMapText(mapLanguage, `Within ${distance} km`, `ภายใน ${distance} กม.`),
    reset: translateMapText(mapLanguage, 'Reset Map Filters', 'ล้างตัวกรองแผนที่'),
    openStreetMap: translateMapText(mapLanguage, 'OpenStreetMap Live View', 'มุมมองแผนที่แบบสด OpenStreetMap'),
    matchingFreelancers: (count: number) => translateMapText(mapLanguage, `${count} freelancers match filters`, `${count} ฟรีแลนซ์ตรงกับตัวกรอง`),
    locationSourceProfile: translateMapText(mapLanguage, 'Profile location', 'ตำแหน่งตามโปรไฟล์'),
    locationSourceDevice: translateMapText(mapLanguage, 'Current device GPS', 'พิกัด GPS ของอุปกรณ์ปัจจุบัน'),
    loading: translateMapText(mapLanguage, 'Loading freelancers...', 'กำลังโหลดฟรีแลนซ์...'),
    unableToLoad: translateMapText(mapLanguage, 'Unable to load freelancers', 'ไม่สามารถโหลดฟรีแลนซ์ได้'),
    noMatches: translateMapText(mapLanguage, 'No freelancers match these filters', 'ไม่มีฟรีแลนซ์ที่ตรงกับตัวกรอง'),
    noMatchesHint: translateMapText(mapLanguage, 'Try relaxing profession, availability, budget, or distance filters.', 'ลองผ่อนตัวกรองอาชีพ ความพร้อม งบประมาณ หรือระยะทางให้กว้างขึ้น'),
    nearYou: translateMapText(mapLanguage, 'Freelancers Near You', 'ฟรีแลนซ์ใกล้คุณ'),
    previewSubtitle: translateMapText(mapLanguage, 'Profile previews from the current map filters.', 'ตัวอย่างโปรไฟล์จากตัวกรองแผนที่ปัจจุบัน'),
    shown: translateMapText(mapLanguage, 'shown', 'แสดง'),
    viewProfile: translateMapText(mapLanguage, 'View Profile', 'ดูโปรไฟล์'),
    yourLocation: translateMapText(mapLanguage, 'Your Location', 'ตำแหน่งของคุณ'),
  };

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
            <h2 className="text-lg font-bold text-gray-900">{mapText.filters}</h2>
          </div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((current) => !current)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {filtersExpanded ? mapText.hideFilters : mapText.showFilters}
          </button>
        </div>

        {!filtersExpanded && (
          <p className="mb-2 text-sm text-gray-600">
            {mapText.matchCount(filteredFreelancers.length)}
          </p>
        )}

        {filtersExpanded && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">{mapText.profession}</h3>
            <div className="flex flex-wrap gap-2">
              {professionFilters.map((profession) => {
                const isSelected = selectedProfessions.includes(profession);
                return (
                  <button
                    key={profession}
                    type="button"
                    onClick={() => toggleProfession(profession)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {profession}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">{mapText.availability}</h3>
            <div className="flex flex-wrap gap-2">
              {availabilityFilters.map((availability) => {
                const isSelected = selectedAvailability.includes(availability.key);
                return (
                  <button
                    key={availability.key}
                    type="button"
                    onClick={() => toggleAvailability(availability.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {availability.dot} {availability.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">{mapText.budget}</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all' as const, label: 'All' },
                { key: 'under-100' as const, label: '< $100' },
                { key: '100-300' as const, label: '$100-$300' },
                { key: '300-500' as const, label: '$300-$500' },
                { key: '500-plus' as const, label: '$500+' },
              ].map((band) => (
                <button
                  key={band.key}
                  type="button"
                  onClick={() => setBudgetBand(band.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    budgetBand === band.key
                      ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">{mapText.distance}</h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => setDistanceLimitKm(null)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  distanceLimitKm === null
                    ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mapText.anyDistance}
              </button>
              {distanceFilters.map((distance) => (
                <button
                  key={distance}
                  type="button"
                  onClick={() => setDistanceLimitKm(distance)}
                  disabled={!clientLocation}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    distanceLimitKm === distance
                      ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {mapText.withinDistance(distance)}
                </button>
              ))}
              {!clientLocation && (
                <p className="text-xs text-gray-500">Set your profile location to enable distance filtering.</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedProfessions([...professionFilters]);
                setSelectedAvailability(['available', 'busy', 'unavailable']);
                setBudgetBand('all');
                setDistanceLimitKm(null);
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              {mapText.reset}
            </button>
          </div>
        </div>
        )}
      </div>

      <div className="relative z-0 h-[460px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl md:h-[calc(100vh-240px)]">
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
                    <p className="font-bold text-gray-900">{mapText.yourLocation} {locationSource === 'device' ? '(Live)' : ''}</p>
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
                  {clientLocation && Number.isFinite(distanceByFreelancerId.get(freelancer.id)) ? (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      {formatDistanceAway(distanceByFreelancerId.get(freelancer.id) as number, mapLanguage)}
                    </p>
                  ) : null}
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
                    {mapText.viewProfile}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="pointer-events-none absolute top-4 left-4 z-[500] rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Navigation className="h-4 w-4" />
            {mapText.openStreetMap}
          </div>
          <p className="mt-1 text-xs text-gray-600">{mapText.matchingFreelancers(filteredFreelancers.length)}</p>
          {clientLocation ? (
            <p className="mt-0.5 text-xs text-gray-500">
              {translateMapText(mapLanguage, 'Location source: ', 'แหล่งที่มาของตำแหน่ง: ')}{locationSource === 'device' ? mapText.locationSourceDevice : mapText.locationSourceProfile}
            </p>
          ) : null}
        </div>

        {(isLoading || errorMessage || (!isLoading && !errorMessage && filteredFreelancers.length === 0)) && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-center shadow-xl">
              {isLoading ? (
                <>
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
                  <p className="font-semibold text-gray-900">{mapText.loading}</p>
                </>
              ) : errorMessage ? (
                <>
                  <p className="font-semibold text-gray-900">{mapText.unableToLoad}</p>
                  <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">{mapText.noMatches}</p>
                  <p className="mt-1 text-sm text-gray-600">{mapText.noMatchesHint}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-xl md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{mapText.nearYou}</h2>
            <p className="text-sm text-gray-600">{mapText.previewSubtitle}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
            {filteredFreelancers.length} {mapText.shown}
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
                <Avatar
                  src={freelancer.profileImage}
                  alt={freelancer.fullName}
                  gender={freelancer.gender}
                  sizeClassName="h-14 w-14 ring-2 ring-white shadow"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-gray-900">{freelancer.fullName}</h3>
                  <p className="truncate text-xs text-gray-600">{freelancer.profession}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{freelancer.location}</p>
                  {clientLocation && Number.isFinite(distanceByFreelancerId.get(freelancer.id)) ? (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      {formatDistanceAway(distanceByFreelancerId.get(freelancer.id) as number, mapLanguage)}
                    </p>
                  ) : null}
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
            <p className="font-semibold text-gray-900">{mapText.noMatches}</p>
            <p className="mt-1">{mapText.noMatchesHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
