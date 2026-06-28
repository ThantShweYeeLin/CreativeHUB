import { useEffect, useMemo, useState } from 'react';
import { Filter, Layers, MapPin, Search, Star } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { DataService } from '../../lib/dataService';
import { normalizeFreelancer, type FreelancerMapProfile } from '../../lib/freelanceMapper';

interface FreelancerCardData extends FreelancerMapProfile {
  category: string;
}

interface FreelancerCardProps {
  item: FreelancerCardData;
  onViewProfile: (freelancerId: string) => void;
}

function FreelancerCard({ item, onViewProfile }: FreelancerCardProps) {
  const latestWork = item.portfolio[0];

  return (
    <button
      type="button"
      className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
      onClick={() => onViewProfile(item.userId || item.id)}
    >
      <div className="mb-4 flex items-start gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-xl ring-2 ring-white shadow-md">
          <ImageWithFallback src={item.profileImage} alt={item.fullName} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-gray-900">{item.fullName}</h3>
          <p className="truncate text-sm text-gray-600">{item.profession}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-500" />
              {item.rating.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {item.totalProjects} projects
            </span>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-gray-600">
        <MapPin className="h-3.5 w-3.5" />
        <span className="truncate">{item.location || 'Location unavailable'}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
          {item.category}
        </span>
        {item.skills.slice(0, 2).map((skill) => (
          <span key={skill} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
            {skill}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-gray-100">
        <ImageWithFallback
          src={latestWork?.imageUrl || item.coverImage}
          alt={latestWork?.title || `${item.fullName} portfolio cover`}
          className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">
        {latestWork?.description || item.bio || 'View profile for portfolio and booking details.'}
      </p>
    </button>
  );
}

interface PortfoliosViewProps {
  onViewProfile: (freelancerId: string) => void;
}

function getCategory(profession: string) {
  const value = profession.toLowerCase();
  if (value.includes('photo')) return 'Photography';
  if (value.includes('makeup')) return 'Beauty';
  if (value.includes('model')) return 'Modeling';
  if (value.includes('design')) return 'Design';
  return 'Creative';
}

export function PortfoliosView({ onViewProfile }: PortfoliosViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [freelancers, setFreelancers] = useState<FreelancerCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPortfolios() {
      setIsLoading(true);
      setError(null);

      const freelancersResponse = await DataService.getAllFreelancers(60);
      if (freelancersResponse.error) {
        if (isMounted) {
          setError((freelancersResponse.error as any).message || 'Unable to load freelancer portfolios.');
          setFreelancers([]);
          setIsLoading(false);
        }
        return;
      }

      const items = (freelancersResponse.data || [])
        .map(normalizeFreelancer)
        .map((freelancer) => ({
          ...freelancer,
          category: getCategory(freelancer.profession),
        }));

      if (!isMounted) {
        return;
      }

      setFreelancers(items);
      setIsLoading(false);
    }

    loadPortfolios();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return freelancers.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory;
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        `${item.fullName} ${item.profession} ${item.category} ${item.skills.join(' ')}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [freelancers, searchQuery, selectedCategory]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg border border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search portfolio titles, artists, or styles"
            className="w-full bg-transparent outline-none text-sm md:text-base"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm">
          {filteredItems.length} profiles
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4" />
          <span>Category</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['All', 'Photography', 'Beauty', 'Modeling', 'Design', 'Creative'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category.toLowerCase())}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === category.toLowerCase() ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
        </div>
      )}

      {!isLoading && filteredItems.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-lg">
          <h2 className="mb-2 text-xl font-bold text-gray-900">No freelancer profiles found</h2>
          <p className="text-gray-600">Try changing category/search filters or add available freelancers in your database.</p>
        </div>
      )}

      {!isLoading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <FreelancerCard key={item.id} item={item} onViewProfile={onViewProfile} />
          ))}
        </div>
      )}
    </div>
  );
}
