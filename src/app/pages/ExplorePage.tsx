import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, ChevronLeft, ChevronRight, Star, Sparkles } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { DataService } from '../../lib/dataService';
import { AIImageMatcher, AIImageMatcherResults, type AIMatcherFreelancer } from '../components/AIImageMatcher';
import { SearchFilterPanel, type FilterState } from '../components/SearchFilterPanel';

const fallbackProfileImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

interface ProfileCardProps {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  image: string;
  location?: string;
}

function ProfileCard({ id, name, specialty, rating, reviews, image, location }: ProfileCardProps) {
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
}

function CarouselSection({ title, profiles }: CarouselSectionProps) {
  return (
    <div className="mb-12 md:mb-16">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-xl md:text-3xl font-bold text-gray-900">{title}</h2>
        <div className="hidden md:flex gap-2">
          <button className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide">
        {profiles.map((profile, index) => (
          <ProfileCard key={profile.id || index} {...profile} />
        ))}
      </div>
    </div>
  );
}

export function ExplorePage() {
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [freelancers, setFreelancers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    services: [],
    priceRange: [0, 10000],
    locations: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIMatcher, setShowAIMatcher] = useState(false);
  const [aiMatcherResults, setAIMatcherResults] = useState<AIMatcherFreelancer[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFreelancers() {
      setIsLoading(true);
      setError(null);

      const response = searchQuery.trim()
        ? await DataService.searchFreelancers(searchQuery.trim())
        : await DataService.getAllFreelancers(60);

      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load freelancers.');
        setFreelancers([]);
      } else {
        setFreelancers(response.data || []);
      }

      setIsLoading(false);
    }

    const timeoutId = window.setTimeout(loadFreelancers, searchQuery.trim() ? 250 : 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const profiles = useMemo<ProfileCardProps[]>(() => {
    return freelancers.map((profile) => ({
      id: profile.user_id || profile.users?.id || profile.id,
      name: profile.users?.full_name || profile.title || 'Creative Freelancer',
      specialty: profile.title || profile.skills?.[0] || 'Creative Professional',
      rating: Number(profile.users?.rating || 0),
      reviews: Number(profile.users?.total_reviews || 0),
      image: profile.users?.avatar_url || fallbackProfileImage,
      location: profile.users?.location || undefined,
    }));
  }, [freelancers]);

  const filteredProfiles = useMemo(() => {
    const mapById = new Map(
      freelancers.map((item) => [item.user_id || item.users?.id || item.id, item])
    );

    return profiles.filter((profile) => {
      const source = mapById.get(profile.id);
      const combinedText = `${profile.specialty} ${source?.title || ''} ${(source?.skills || []).join(' ')}`.toLowerCase();

      const serviceMatch =
        filters.services.length === 0 ||
        filters.services.some((service) => combinedText.includes(service.toLowerCase().replace('&', 'and')));

      const locationMatch =
        filters.locations.length === 0 ||
        filters.locations.some((location) =>
          (profile.location || '').toLowerCase().includes(location.toLowerCase())
        );

      const hourlyRate = Number(source?.hourly_rate ?? 0);
      const [minPrice, maxPrice] = filters.priceRange;
      const priceMatch = hourlyRate === 0 ? true : hourlyRate >= minPrice && hourlyRate <= maxPrice;

      return serviceMatch && locationMatch && priceMatch;
    });
  }, [profiles, freelancers, filters]);

  const sectionFor = (keywords: string[]) => {
    return filteredProfiles.filter((profile) => {
      const searchable = `${profile.specialty} ${freelancers.find((item) => (item.user_id || item.users?.id || item.id) === profile.id)?.skills?.join(' ') || ''}`.toLowerCase();
      return keywords.some((keyword) => searchable.includes(keyword));
    });
  };

  const makeupArtists = sectionFor(['makeup', 'beauty', 'hair', 'stylist']);
  const photographers = sectionFor(['photo', 'camera', 'studio', 'portrait', 'editorial']);
  const models = sectionFor(['model', 'fashion', 'runway']);
  const uncategorizedProfiles = filteredProfiles.filter((profile) =>
    ![...makeupArtists, ...photographers, ...models].some((sectionProfile) => sectionProfile.id === profile.id)
  );

  return (
    <>
      {/* Search and AI Matcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 mb-8 md:mb-12">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search for makeup artists, photographers, models..."
            className="w-full pl-12 pr-4 py-3 md:py-4 bg-white rounded-2xl shadow-lg border border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSearchFilter(true)}
            className="flex-1 md:flex-none flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all group border border-gray-200"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm md:text-base text-gray-900">Advanced Filter</div>
              <div className="text-xs text-gray-500 hidden md:block">Refine Your Search</div>
            </div>
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
              <div className="font-semibold text-sm md:text-base text-gray-900">AI Matcher</div>
              <div className="text-xs text-gray-500 hidden md:block">Upload & Find Similar</div>
            </div>
          </button>
        </div>
      </div>

      <AIImageMatcher
        open={showAIMatcher}
        freelancers={freelancers}
        onClose={() => setShowAIMatcher(false)}
        onResults={setAIMatcherResults}
      />

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
          onReset={() => {
            setAIMatcherResults(null);
            setShowAIMatcher(true);
          }}
        />
      )}

      {!isLoading && !aiMatcherResults && profiles.length > 0 && filteredProfiles.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-lg">
          <h2 className="mb-2 text-xl font-bold text-gray-900">No freelancers match these filters</h2>
          <p className="text-gray-600">Adjust service, location, or price range in Advanced Filter.</p>
        </div>
      )}

      {/* Carousel Sections */}
      {!isLoading && makeupArtists.length > 0 && (
        <CarouselSection
          title="Popular Makeup Artists in Thailand"
          profiles={makeupArtists}
        />
      )}
      {!isLoading && photographers.length > 0 && (
        <CarouselSection
          title="Popular Photographers in Thailand"
          profiles={photographers}
        />
      )}
      {!isLoading && models.length > 0 && (
        <CarouselSection
          title="Popular Models in Thailand"
          profiles={models}
        />
      )}
      {!isLoading && uncategorizedProfiles.length > 0 && (
        <CarouselSection
          title="Featured Creative Freelancers"
          profiles={uncategorizedProfiles}
        />
      )}

      {showSearchFilter && (
        <SearchFilterPanel
          onClose={() => setShowSearchFilter(false)}
          onSearch={(nextFilters) => setFilters(nextFilters)}
        />
      )}
    </>
  );
}
