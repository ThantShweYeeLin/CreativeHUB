import { ChevronLeft, Heart, Star, MapPin } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState } from 'react';

interface FavoritesPageProps {
  onBack: () => void;
  onViewProfile: () => void;
}

const favoriteFreelancers = [
  {
    id: 1,
    name: 'Simran Sood',
    specialty: 'Creative Artistry',
    image: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=400',
    rating: 5.0,
    reviews: 312,
    location: 'Sukhumvit',
    projects: 89
  },
  {
    id: 2,
    name: 'Deny Napitupulu',
    specialty: 'Landscape & Nature',
    image: 'https://images.unsplash.com/photo-1706661912295-bd1dc10ffe7f?w=400',
    rating: 4.9,
    reviews: 234,
    location: 'Bang Na',
    projects: 127
  },
  {
    id: 3,
    name: 'Laura Chouette',
    specialty: 'Fashion & Editorial',
    image: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?w=400',
    rating: 5.0,
    reviews: 243,
    location: 'Thonglor',
    projects: 156
  },
  {
    id: 4,
    name: 'Daria Magazzu',
    specialty: 'High Fashion',
    image: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=400',
    rating: 5.0,
    reviews: 412,
    location: 'Silom',
    projects: 201
  },
  {
    id: 5,
    name: 'Marcus Chen',
    specialty: 'Action Sports',
    image: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?w=400',
    rating: 5.0,
    reviews: 187,
    location: 'Sathorn',
    projects: 145
  },
  {
    id: 6,
    name: 'Darling Arias',
    specialty: 'Fashion Editorial',
    image: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=400',
    rating: 5.0,
    reviews: 342,
    location: 'Asoke',
    projects: 198
  }
];

export function FavoritesPage({ onBack, onViewProfile }: FavoritesPageProps) {
  const [favorites, setFavorites] = useState(favoriteFreelancers);

  const removeFavorite = (id: number) => {
    setFavorites(favorites.filter(f => f.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 mb-6 md:mb-8">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            Back to Home
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Favorites</h1>
              <p className="text-sm md:text-base text-gray-600">{favorites.length} favorite freelancers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {favorites.map((freelancer) => (
              <div
                key={freelancer.id}
                className="group relative bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-300"
              >
                {/* Favorite Heart Button */}
                <button
                  onClick={() => removeFavorite(freelancer.id)}
                  className="absolute top-3 right-3 md:top-4 md:right-4 z-10 w-9 h-9 md:w-10 md:h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <Heart className="w-4 h-4 md:w-5 md:h-5 text-red-500 fill-red-500" />
                </button>

                {/* Profile Image */}
                <div className="relative h-64 md:h-80 overflow-hidden">
                  <ImageWithFallback
                    src={freelancer.image}
                    alt={freelancer.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Hover Actions */}
                  <div className="absolute bottom-4 left-4 right-4 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={onViewProfile}
                      className="w-full bg-white text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      View Profile
                    </button>
                  </div>
                </div>

                {/* Info Section */}
                <div className="p-4 md:p-5">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">{freelancer.name}</h3>
                  <p className="text-xs md:text-sm text-gray-600 mb-3">{freelancer.specialty}</p>

                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                      <span>{freelancer.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-gray-900">{freelancer.rating}</span>
                      <span className="text-gray-500">({freelancer.reviews})</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-gray-200">
                    <span className="text-xs md:text-sm text-gray-600">{freelancer.projects} projects</span>
                    <button
                      onClick={onViewProfile}
                      className="text-xs md:text-sm text-gray-900 font-semibold hover:text-black transition-colors"
                    >
                      Book Now →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-16 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-12 h-12 text-gray-700" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Favorites Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start exploring and add freelancers to your favorites to easily find them later!
            </p>
            <button
              onClick={onBack}
              className="px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              Explore Freelancers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
