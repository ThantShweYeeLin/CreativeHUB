import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Star, MapPin } from 'lucide-react';
import { useState } from 'react';

const categories = ['All', 'Makeup', 'Hairstyle', 'Photography', 'Videography', 'Model', 'Designer'];

const mockResults = [
  { id: 1, name: 'Beauty by Naychi', category: 'Makeup', image: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=400', rating: 4.9, location: 'Bangkok' },
  { id: 2, name: 'Ur Daily Hairstyles', category: 'Hairstyle', image: 'https://images.unsplash.com/photo-1560869683-f5d8bf564346?w=400', rating: 4.8, location: 'Chiang Mai' },
  { id: 3, name: 'Studio Alpha', category: 'Photography', image: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=400', rating: 5.0, location: 'Bangkok' },
  { id: 4, name: 'Glamour Studio', category: 'Makeup', image: 'https://images.unsplash.com/photo-1676286255284-3a5cab9cea19?w=400', rating: 4.7, location: 'Phuket' },
  { id: 5, name: 'Hair Masters', category: 'Hairstyle', image: 'https://images.unsplash.com/photo-1671454390265-c0ed999cd528?w=400', rating: 4.9, location: 'Bangkok' },
  { id: 6, name: 'Vogue Photography', category: 'Photography', image: 'https://images.unsplash.com/photo-1758613653298-738e98658e31?w=400', rating: 4.8, location: 'Pattaya' },
  { id: 7, name: 'Bella Beauty', category: 'Makeup', image: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=400', rating: 4.6, location: 'Bangkok' },
  { id: 8, name: 'Style & Grace', category: 'Hairstyle', image: 'https://images.unsplash.com/photo-1671454265388-0c0672798125?w=400', rating: 5.0, location: 'Chiang Mai' },
  { id: 9, name: 'Lens Pro', category: 'Photography', image: 'https://images.unsplash.com/photo-1706661912295-bd1dc10ffe7f?w=400', rating: 4.7, location: 'Bangkok' },
  { id: 10, name: 'Makeup Haven', category: 'Makeup', image: 'https://images.unsplash.com/photo-1664891399651-bccb92f27f25?w=400', rating: 4.9, location: 'Phuket' },
  { id: 11, name: 'Hair Artistry', category: 'Hairstyle', image: 'https://images.unsplash.com/photo-1630251414251-ee3ec87f5a93?w=400', rating: 4.8, location: 'Bangkok' },
  { id: 12, name: 'Creative Lens', category: 'Photography', image: 'https://images.unsplash.com/photo-1758613653231-bae4e1131dde?w=400', rating: 5.0, location: 'Pattaya' },
];

interface SearchResultsProps {
  onViewProfile: () => void;
}

export function SearchResults({ onViewProfile }: SearchResultsProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredResults = selectedCategory === 'All'
    ? mockResults
    : mockResults.filter(r => r.category === selectedCategory);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Category Filter Tabs */}
      <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2 overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl text-sm md:text-base font-semibold transition-all whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Results Count */}
      <div className="text-sm md:text-base text-gray-600">
        <span className="font-semibold text-gray-900">{filteredResults.length}</span> results found
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
        {filteredResults.map((result) => (
          <div
            key={result.id}
            onClick={onViewProfile}
            className="group cursor-pointer"
          >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-3">
              <ImageWithFallback
                src={result.image}
                alt={result.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-center gap-1 text-white text-xs">
                    <MapPin className="w-3 h-3" />
                    <span>{result.location}</span>
                  </div>
                </div>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm truncate mb-1">{result.name}</h3>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-semibold text-gray-900">{result.rating}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="flex justify-center pt-8">
        <button className="px-8 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-all">
          Load More Results
        </button>
      </div>
    </div>
  );
}
