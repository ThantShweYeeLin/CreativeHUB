import { Search, Filter, Grid3x3, LayoutGrid, Heart, Eye, MessageCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState } from 'react';

const portfolioItems = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1758613653298-738e98658e31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Studio Fashion Shoot',
    artist: 'Darling Arias',
    category: 'Photography',
    style: 'Editorial',
    likes: 342,
    views: 1200,
    comments: 28
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1758613653231-bae4e1131dde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Editorial Portrait',
    artist: 'Marcus Chen',
    category: 'Photography',
    style: 'Minimalist',
    likes: 289,
    views: 980,
    comments: 19
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1769605767701-6e5a680ef685?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Tattoo Artistry',
    artist: 'Sarah Kim',
    category: 'Art',
    style: 'Dramatic',
    likes: 421,
    views: 1500,
    comments: 35
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1623577284502-d65cdc6ba0b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Music Production',
    artist: 'Talie Ashrafi',
    category: 'Music',
    style: 'Cinematic',
    likes: 256,
    views: 890,
    comments: 22
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1625980221833-ad4f4ed05706?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Behind the Lens',
    artist: 'Ahmed Sheraz',
    category: 'Photography',
    style: 'Vibrant',
    likes: 378,
    views: 1100,
    comments: 31
  },
  {
    id: 6,
    image: 'https://images.unsplash.com/photo-1659489755247-085322191791?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Creative Process',
    artist: 'Pooria Shahriari',
    category: 'Design',
    style: 'Minimalist',
    likes: 298,
    views: 950,
    comments: 24
  },
  {
    id: 7,
    image: 'https://images.unsplash.com/photo-1707920026227-dc635c6f2c13?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Street Photography',
    artist: 'Mariyan Rajesh',
    category: 'Photography',
    style: 'Editorial',
    likes: 412,
    views: 1350,
    comments: 29
  },
  {
    id: 8,
    image: 'https://images.unsplash.com/photo-1653379671625-35943f524abc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Green Screen Work',
    artist: 'Anil Sharma',
    category: 'Video',
    style: 'Cinematic',
    likes: 334,
    views: 1050,
    comments: 26
  },
  {
    id: 9,
    image: 'https://images.unsplash.com/photo-1738405572298-34c142e485e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Rainbow Portrait',
    artist: 'Akash Maurya',
    category: 'Photography',
    style: 'Vibrant',
    likes: 467,
    views: 1600,
    comments: 42
  },
  {
    id: 10,
    image: 'https://images.unsplash.com/photo-1630317334568-81f48cb35685?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Fashion Editorial',
    artist: 'The Artist Studio',
    category: 'Fashion',
    style: 'Editorial',
    likes: 389,
    views: 1280,
    comments: 33
  },
  {
    id: 11,
    image: 'https://images.unsplash.com/photo-1762708590382-9754c70b3f58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Traditional Elegance',
    artist: 'AL Kaium',
    category: 'Photography',
    style: 'Dramatic',
    likes: 501,
    views: 1750,
    comments: 48
  },
  {
    id: 12,
    image: 'https://images.unsplash.com/photo-1630251414251-ee3ec87f5a93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    title: 'Outdoor Adventure',
    artist: 'Robiul Islam',
    category: 'Photography',
    style: 'Vibrant',
    likes: 356,
    views: 1120,
    comments: 27
  },
];

interface PortfolioCardProps {
  item: typeof portfolioItems[0];
  onViewProfile: () => void;
}

function PortfolioCard({ item, onViewProfile }: PortfolioCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onViewProfile}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            {/* Top Actions */}
            <div className="flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLiked(!isLiked);
                }}
                className={`p-2 rounded-full backdrop-blur-sm transition-all ${
                  isLiked
                    ? 'bg-red-500 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Bottom Info */}
            <div className="space-y-3">
              <div>
                <h3 className="text-white font-bold text-lg mb-1">{item.title}</h3>
                <p className="text-white/80 text-sm">by {item.artist}</p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-white/90 text-sm">
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span>{item.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{item.views}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{item.comments}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Badge */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-900">
            {item.category}
          </span>
        </div>
      </div>
    </div>
  );
}

interface PortfoliosViewProps {
  onViewProfile: () => void;
}

export function PortfoliosView({ onViewProfile }: PortfoliosViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState('all');

  const filteredItems = portfolioItems.filter((item) => {
    const categoryMatch = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory;
    const styleMatch = selectedStyle === 'all' || item.style.toLowerCase() === selectedStyle;
    return categoryMatch && styleMatch;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filters and View Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-0">
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto pb-2 md:pb-0">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <Filter className="w-5 h-5 text-gray-600" />
          </button>

          {/* Category Filters */}
          <div className="flex gap-2">
            {['All', 'Photography', 'Fashion', 'Art', 'Design', 'Video'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category.toLowerCase())}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-all whitespace-nowrap ${
                  selectedCategory === category.toLowerCase()
                    ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle - Desktop Only */}
        <div className="hidden md:flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-gradient-to-r from-gray-900 to-black text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('masonry')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'masonry'
                ? 'bg-gradient-to-r from-gray-900 to-black text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Style Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <span className="text-sm font-semibold text-gray-700 flex-shrink-0">Filter by Style:</span>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['All', 'Editorial', 'Minimalist', 'Dramatic', 'Cinematic', 'Vibrant'].map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style.toLowerCase())}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-all whitespace-nowrap ${
                selectedStyle === style.toLowerCase()
                  ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio Grid */}
      <div className={`grid gap-4 md:gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
        {filteredItems.map((item) => (
          <PortfolioCard key={item.id} item={item} onViewProfile={onViewProfile} />
        ))}
      </div>

      {/* Load More */}
      <div className="flex justify-center pt-8">
        <button className="px-8 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-all">
          Load More
        </button>
      </div>
    </div>
  );
}
