import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, ChevronLeft, ChevronRight, Star, Sparkles } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

const makeupArtists = [
  { name: 'Mihaela Claudia', specialty: 'Bridal Makeup', rating: 4.9, reviews: 127, image: 'https://images.unsplash.com/photo-1741544486129-956dec7c89ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Laura Chouette', specialty: 'Fashion & Editorial', rating: 5.0, reviews: 243, image: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Baylee Gramling', specialty: 'Natural Beauty', rating: 4.8, reviews: 156, image: 'https://images.unsplash.com/photo-1560869683-f5d8bf564346?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Maya Thompson', specialty: 'Special Effects', rating: 4.9, reviews: 198, image: 'https://images.unsplash.com/photo-1585616840136-d91fe5f967aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Simran Sood', specialty: 'Creative Artistry', rating: 5.0, reviews: 312, image: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Anil Sharma', specialty: 'HD Makeup', rating: 4.7, reviews: 189, image: 'https://images.unsplash.com/photo-1644134395029-d68dd6b97761?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
];

const photographers = [
  { name: 'Deny Napitupulu', specialty: 'Landscape & Nature', rating: 4.9, reviews: 234, image: 'https://images.unsplash.com/photo-1706661912295-bd1dc10ffe7f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Marcus Chen', specialty: 'Action Sports', rating: 5.0, reviews: 187, image: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'ENG-HS', specialty: 'Portrait & Studio', rating: 4.8, reviews: 298, image: 'https://images.unsplash.com/photo-1643264623879-bb85ea39c62a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Irish O\'Connell', specialty: 'Event Photography', rating: 4.9, reviews: 221, image: 'https://images.unsplash.com/photo-1627961888164-b79f406b245b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'James Park', specialty: 'Product & Commercial', rating: 4.7, reviews: 165, image: 'https://images.unsplash.com/photo-1643968612613-fd411aecd1fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Darling Arias', specialty: 'Fashion Editorial', rating: 5.0, reviews: 342, image: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
];

const models = [
  { name: 'Daria Magazzu', specialty: 'High Fashion', rating: 5.0, reviews: 412, image: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Sour Moha', specialty: 'Editorial & Runway', rating: 4.9, reviews: 387, image: 'https://images.unsplash.com/photo-1676286255284-3a5cab9cea19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Mesut Çiçen', specialty: 'Commercial & Lifestyle', rating: 4.8, reviews: 256, image: 'https://images.unsplash.com/photo-1671454390265-c0ed999cd528?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Isabella Rodriguez', specialty: 'Fashion & Beauty', rating: 5.0, reviews: 489, image: 'https://images.unsplash.com/photo-1671454265388-0c0672798125?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Artem Artemov', specialty: 'Creative Portraits', rating: 4.9, reviews: 298, image: 'https://images.unsplash.com/photo-1664891399651-bccb92f27f25?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { name: 'Sofia Winters', specialty: 'Avant-Garde', rating: 4.8, reviews: 334, image: 'https://images.unsplash.com/photo-1671454264961-98e81937dc94?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
];

interface ProfileCardProps {
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  image: string;
}

function ProfileCard({ name, specialty, rating, reviews, image }: ProfileCardProps) {
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
              onClick={() => navigate(`/profile/1`)}
              className="w-full bg-white text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              View Profile
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1">{name}</h3>
          <p className="text-sm text-gray-600 mb-3">{specialty}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-sm text-gray-900">{rating}</span>
              <span className="text-xs text-gray-500">({reviews})</span>
            </div>
            <button
              onClick={() => navigate(`/profile/1`)}
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
          <ProfileCard key={index} {...profile} />
        ))}
      </div>
    </div>
  );
}

export function ExplorePage() {
  const [showSearchFilter, setShowSearchFilter] = useState(false);

  return (
    <>
      {/* Search and AI Matcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 mb-8 md:mb-12">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
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
            onClick={() => {}}
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

      {/* Carousel Sections */}
      <CarouselSection
        title="Popular Makeup Artists in Thailand"
        profiles={makeupArtists}
      />
      <CarouselSection
        title="Popular Photographers in Thailand"
        profiles={photographers}
      />
      <CarouselSection
        title="Popular Models in Thailand"
        profiles={models}
      />
    </>
  );
}
