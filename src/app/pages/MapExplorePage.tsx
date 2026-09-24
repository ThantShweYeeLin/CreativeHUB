import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { LatLngExpression, divIcon } from 'leaflet';
import { Filter, Layers, Navigation, Search, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { FreelancerMapProfile, normalizeFreelancer } from '../../lib/freelanceMapper';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { FREELANCER_CATEGORY_LABELS, isFreelancerCategory } from '../../lib/categories';
import { haversineDistanceKm } from '../../lib/geo';

type Availability = 'available' | 'busy' | 'unavailable';
type BudgetBand = 'all' | 'under-100' | '100-300' | '300-500' | '500-plus';

interface MapViewProps {
  onViewProfile?: (freelancerId: string) => void;
}

const professionFilters = FREELANCER_CATEGORY_LABELS;

const availabilityFilters: { key: Availability; label: string; dot: string }[] = [
  { key: 'available', label: 'Available', dot: 'bg-green-500' },
  { key: 'busy', label: 'Busy', dot: 'bg-amber-500' },
  { key: 'unavailable', label: 'Unavailable', dot: 'bg-red-500' },
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
const DEFAULT_DISTANCE_LIMIT_KM = 25;

// react-leaflet's MapContainer only applies `center`/`zoom` on the initial
// mount - they aren't reactive afterward. Geolocation resolves
// asynchronously, so `center` almost always changes shortly after the map
// first renders (from the Bangkok/first-freelancer fallback to the user's
// real position), and without this the map just never moves there. This
// imperatively re-centers the underlying Leaflet map whenever `center`
// changes, most importantly the very first time it becomes the user's own
// location.
function RecenterMapView({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(center) ? center[0] : undefined, Array.isArray(center) ? center[1] : undefined]);

  return null;
}

// freelancer.profession comes from freelancer_profiles.title, which is
// always exactly one of the five FREELANCER_CATEGORY_LABELS for a valid
// profile — an exact match, not fuzzy substring detection, now that the
// category field is a controlled dropdown rather than free text.
function detectProfession(freelancer: FreelancerMapProfile): (typeof professionFilters)[number] | null {
  return isFreelancerCategory(freelancer.profession) ? freelancer.profession : null;
}

function availabilityStatus(freelancer: FreelancerMapProfile): Availability {
  const text = freelancer.availability.join(' ').toLowerCase();
  if (text.includes('busy')) return 'busy';
  if (text.includes('unavailable') || !freelancer.isAvailable) return 'unavailable';
  return 'available';
}

function statusColor(status: Availability) {
  if (status === 'available') return '#22c55e';
  if (status === 'busy') return '#f59e0b';
  return '#ef4444';
}

// A clean circular avatar pin (photo + a small availability badge, like a
// contact card) instead of the old dark teardrop-with-initials marker —
// the photo itself is identity enough, so no category glyph is needed here.
function freelancerMarkerIcon(freelancer: FreelancerMapProfile) {
  const status = availabilityStatus(freelancer);
  const color = statusColor(status);
  // Unique per marker so multiple pins on the same map don't clash on the
  // same <clipPath> id (SVG ids are global to the document once inlined).
  const clipId = `marker-clip-${freelancer.id}`;

  return divIcon({
    className: '',
    html: `
      <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 8px 12px rgba(15,23,42,.35));">
        <defs>
          <clipPath id="${clipId}">
            <circle cx="20" cy="18" r="15" />
          </clipPath>
        </defs>
        <path d="M11 29 L20 49 L29 29 Z" fill="#ffffff" />
        <circle cx="20" cy="18" r="17.5" fill="#ffffff" />
        <circle cx="20" cy="18" r="15" fill="#e0f2fe" />
        <image href="${freelancer.profileImage}" x="5" y="3" width="30" height="30" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" />
        <circle cx="32" cy="7" r="6.5" fill="${color}" stroke="#ffffff" stroke-width="2.5" />
      </svg>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 49],
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

const distanceKm = haversineDistanceKm;

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
  const hasAppliedDefaultDistance = useRef(false);
  const [locationSource, setLocationSource] = useState<'profile' | 'device' | 'manual' | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
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

      // Freelancers whose category isn't one of the five supported labels
      // don't surface on the map until they pick a valid category.
      normalized = normalized.filter((freelancer) => isFreelancerCategory(freelancer.profession));

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

  // distanceLimitKm defaults to null ("Any distance"), which showed every
  // matching freelancer regardless of how far away they actually were under
  // a "Freelancers Near You" heading. Once we know where the user actually
  // is (profile location or device geolocation, whichever resolves first),
  // apply a sensible default radius so "near you" means something - but
  // only the first time, so it never overrides an explicit later choice
  // (including deliberately picking "Any distance").
  useEffect(() => {
    if (clientLocation && !hasAppliedDefaultDistance.current) {
      hasAppliedDefaultDistance.current = true;
      // Functional form so an explicit "Any distance" click that happened
      // to land before geolocation resolved isn't clobbered.
      setDistanceLimitKm((current) => (current === null ? DEFAULT_DISTANCE_LIMIT_KM : current));
    }
  }, [clientLocation]);

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

  // Profession/availability/budget filters apply everywhere. The distance
  // filter, though, only ever narrows the "Freelancers Near You" list below
  // - the map itself always plots everyone matching the other filters, same
  // as before the distance-default change, so you can still see where
  // everyone is even once the list has narrowed to a nearby few.
  const mapFreelancers = useMemo(() => {
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

      return true;
    });
  }, [freelancers, selectedProfessions, selectedAvailability, budgetBand]);

  const filteredFreelancers = useMemo(() => {
    const inRange = !distanceLimitKm || !clientLocation
      ? mapFreelancers
      : mapFreelancers.filter((freelancer) => {
          const freelancerDistance = distanceByFreelancerId.get(freelancer.id);
          return freelancerDistance !== undefined && Number.isFinite(freelancerDistance) && freelancerDistance <= distanceLimitKm;
        });

    if (!clientLocation) {
      return inRange;
    }

    // Nearest first - a freelancer with no resolvable coordinates (so no
    // known distance) sorts after every freelancer whose distance IS known,
    // rather than at an arbitrary spot among them.
    return [...inRange].sort((a, b) => {
      const distanceA = distanceByFreelancerId.get(a.id);
      const distanceB = distanceByFreelancerId.get(b.id);
      if (distanceA === undefined && distanceB === undefined) return 0;
      if (distanceA === undefined) return 1;
      if (distanceB === undefined) return -1;
      return distanceA - distanceB;
    });
  }, [mapFreelancers, distanceLimitKm, clientLocation, distanceByFreelancerId]);

  const selectedFreelancer = mapFreelancers.find((freelancer) => freelancer.id === selectedId) || null;
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
    locationSourceManual: translateMapText(mapLanguage, 'Location you set', 'ตำแหน่งที่คุณตั้งค่า'),
    locationSearchPlaceholder: translateMapText(mapLanguage, 'Search a city or address...', 'ค้นหาเมืองหรือที่อยู่...'),
    locationSearchButton: translateMapText(mapLanguage, 'Search', 'ค้นหา'),
    locationSearchSearching: translateMapText(mapLanguage, 'Searching...', 'กำลังค้นหา...'),
    setDesiredLocation: translateMapText(mapLanguage, 'Set a desired location', 'ตั้งค่าตำแหน่งที่ต้องการ'),
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

    const first = mapFreelancers[0];
    if (
      first &&
      Number.isFinite(first.latitude) &&
      Number.isFinite(first.longitude)
    ) {
      return [first.latitude as number, first.longitude as number];
    }

    return [13.7563, 100.5018];
  }, [clientLocation, mapFreelancers]);

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

  // Explicit search-on-submit only (button/Enter) — Nominatim's usage policy
  // forbids autocomplete-on-keystroke, so there's no live suggestion list here.
  const handleLocationSearch = async () => {
    const query = locationSearchQuery.trim();
    if (!query) return;

    setIsSearchingLocation(true);
    setLocationSearchError(null);

    const result = await geocodeAddress(query, mapLanguage);

    setIsSearchingLocation(false);

    if (!result) {
      setLocationSearchError(
        translateMapText(mapLanguage, "Couldn't find that location. Try a different search.", 'ไม่พบตำแหน่งนี้ ลองค้นหาใหม่อีกครั้ง')
      );
      return;
    }

    setClientLocation({ lat: result.latitude, lng: result.longitude, label: result.formattedAddress });
    setLocationSource('manual');
  };

  return (
    <div className="relative">
      <PageBackdrop />
      <style>{`
        .freelancer-map-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.28);
        }
        .freelancer-map-popup .leaflet-popup-content {
          margin: 0;
        }
        .freelancer-map-popup .leaflet-popup-tip {
          background: #ffffff;
        }
        .freelancer-map-popup .leaflet-popup-close-button {
          top: 8px !important;
          right: 8px !important;
          width: 22px !important;
          height: 22px !important;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.9);
          color: #1f2937 !important;
          font-size: 15px !important;
          line-height: 22px !important;
          text-align: center;
        }
      `}</style>
      <div className="relative z-10 space-y-6 md:space-y-8">
      <div className="rounded-3xl border border-sky-100 bg-white/80 backdrop-blur-xl p-4 shadow-[0_8px_30px_rgba(56,189,248,0.15)] md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-bold text-gray-900">{mapText.filters}</h2>
          </div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((current) => !current)}
            className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-sky-50"
          >
            {filtersExpanded ? mapText.hideFilters : mapText.showFilters}
          </button>
        </div>

        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold text-gray-900">{mapText.setDesiredLocation}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleLocationSearch();
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="text"
              value={locationSearchQuery}
              onChange={(event) => setLocationSearchQuery(event.target.value)}
              placeholder={mapText.locationSearchPlaceholder}
              className="min-w-[200px] flex-1 rounded-xl border border-sky-200 px-4 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSearchingLocation || !locationSearchQuery.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {isSearchingLocation ? mapText.locationSearchSearching : mapText.locationSearchButton}
            </button>
          </form>
          {locationSearchError && <p className="mt-2 text-xs text-red-600">{locationSearchError}</p>}
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
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                        : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
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
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                        : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${availability.dot} ${isSelected ? 'ring-2 ring-white/60' : ''}`} />
                      {availability.label}
                    </span>
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
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                      : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
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
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                    : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
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
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                      : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
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
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50"
            >
              {mapText.reset}
            </button>
          </div>
        </div>
        )}
      </div>

      <div className="relative z-0 h-[460px] overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)] md:h-[calc(100vh-240px)]">
        <MapContainer center={center} zoom={12} className="h-full w-full">
          <RecenterMapView center={center} zoom={clientLocation ? 13 : 12} />
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
                    <p className="font-bold text-gray-900">{mapText.yourLocation} {locationSource === 'device' ? '(Live)' : locationSource === 'manual' ? '(Set by you)' : ''}</p>
                    <p className="text-gray-600">{clientLocation.label}</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {mapFreelancers.map((freelancer) => (
            <Marker
              key={freelancer.id}
              position={[freelancer.latitude as number, freelancer.longitude as number]}
              icon={freelancerMarkerIcon(freelancer)}
              eventHandlers={{
                click: () => setSelectedId(freelancer.id),
              }}
            >
              <Popup className="freelancer-map-popup" minWidth={224} maxWidth={224}>
                <div className="w-56 overflow-hidden rounded-2xl">
                  <div className="relative h-36 w-full">
                    <ImageWithFallback
                      src={freelancer.profileImage}
                      alt={freelancer.fullName}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <span
                      className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-800 shadow-sm backdrop-blur-sm"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusColor(availabilityStatus(freelancer)) }}
                      />
                      {availabilityFilters.find((item) => item.key === availabilityStatus(freelancer))?.label}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <h4 className="text-base font-bold leading-tight text-white">{freelancer.fullName}</h4>
                      <p className="text-xs text-white/85">{freelancer.profession}</p>
                    </div>
                  </div>

                  <div className="bg-white p-3">
                    <p className="truncate text-xs text-gray-500">{freelancer.location}</p>
                    {clientLocation && Number.isFinite(distanceByFreelancerId.get(freelancer.id)) ? (
                      <p className="mt-1 text-xs font-semibold text-sky-700">
                        {formatDistanceAway(distanceByFreelancerId.get(freelancer.id) as number, mapLanguage)}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-gray-700">
                      <span className="flex items-center gap-1">
                        <span className="text-amber-500">★</span> {freelancer.rating > 0 ? freelancer.rating.toFixed(1) : 'New'}
                      </span>
                      <span>{freelancer.totalProjects} projects</span>
                      {Number.isFinite(freelancer.hourlyRate) ? <span>${freelancer.hourlyRate}/h</span> : null}
                    </div>
                    <button
                      onClick={() => handleViewProfile(freelancer.id)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {mapText.viewProfile}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="pointer-events-none absolute top-4 left-4 z-[500] rounded-xl border border-sky-100 bg-white/90 px-4 py-3 shadow-[0_8px_30px_rgba(56,189,248,0.15)] backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Navigation className="h-4 w-4 text-sky-500" />
            {mapText.openStreetMap}
          </div>
          <p className="mt-1 text-xs text-gray-600">{mapText.matchingFreelancers(mapFreelancers.length)}</p>
          {clientLocation ? (
            <p className="mt-0.5 text-xs text-gray-500">
              {translateMapText(mapLanguage, 'Location source: ', 'แหล่งที่มาของตำแหน่ง: ')}
              {locationSource === 'device'
                ? mapText.locationSourceDevice
                : locationSource === 'manual'
                  ? mapText.locationSourceManual
                  : mapText.locationSourceProfile}
            </p>
          ) : null}
        </div>

        {(isLoading || errorMessage || (!isLoading && !errorMessage && mapFreelancers.length === 0)) && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="rounded-2xl border border-sky-100 bg-white px-6 py-5 text-center shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              {isLoading ? (
                <>
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
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

      <div className="rounded-3xl border border-sky-100 bg-white/80 backdrop-blur-xl p-4 shadow-[0_8px_30px_rgba(56,189,248,0.15)] md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{mapText.nearYou}</h2>
            <p className="text-sm text-gray-600">{mapText.previewSubtitle}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-gray-900">
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
                  ? 'border-sky-400 bg-sky-50 shadow-[0_8px_24px_rgba(56,189,248,0.25)]'
                  : 'border-sky-100 bg-white hover:border-sky-300 hover:shadow-md'
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
          <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">{mapText.noMatches}</p>
            <p className="mt-1">{mapText.noMatchesHint}</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
