import { ChevronLeft, MapPin, Phone, Edit, Plus, Star } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState } from 'react';

interface ClientProfilePageProps {
  onBack: () => void;
}

export function ClientProfilePage({ onBack }: ClientProfilePageProps) {
  const [isEditMode, setIsEditMode] = useState(false);

  const posts = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      title: 'Amazing photoshoot experience!',
      date: '2026-05-01'
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      title: 'Loved working with this team',
      date: '2026-04-28'
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      title: 'Professional and creative',
      date: '2026-04-25'
    }
  ];

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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Profile</h1>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              <Edit className="w-4 h-4" />
              <span className="hidden md:inline">{isEditMode ? 'Save Profile' : 'Edit Profile'}</span>
              <span className="md:hidden">{isEditMode ? 'Save' : 'Edit'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6 md:mb-8">
          <div className="h-24 md:h-32 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900" />
          <div className="px-4 md:px-8 pb-6 md:pb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 -mt-12 md:-mt-16">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden ring-4 ring-white shadow-xl bg-gray-200">
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-5 h-5 md:w-6 md:h-6 bg-green-500 rounded-full border-4 border-white" />
              </div>

              {/* Profile Info */}
              <div className="flex-1 w-full text-center md:text-left pt-0 md:pt-16">
                <div className="mb-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">John Doe</h2>
                  <p className="text-lg md:text-xl text-gray-600 mb-3">@johndoe_creative</p>
                  <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 text-sm md:text-base text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                      <span>Bangkok, Thailand</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 md:w-5 md:h-5" />
                      <span>+66 123 456 789</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-8 text-xs md:text-sm">
                  <div>
                    <span className="font-semibold text-gray-900">Reliability:</span>{' '}
                    <span className="text-green-600 font-bold">99%</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Projects Worked:</span>{' '}
                    <span className="text-gray-900 font-bold">4</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">4.9</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Info Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-8 mb-6 md:mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Personal Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">Client</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">Bangkok</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 text-sm md:text-base truncate">john.doe@example.com</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">+66 123 456 789</div>
            </div>
          </div>
        </div>

        {/* Posts Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-xl md:text-2xl font-bold text-gray-900">My Posts</h3>
            <button className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors">
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden md:inline">Write a Post</span>
              <span className="md:hidden">Post</span>
            </button>
          </div>

          {posts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="group cursor-pointer rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                >
                  <div className="aspect-square overflow-hidden bg-gray-200">
                    <ImageWithFallback
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 bg-white">
                    <h4 className="font-semibold text-gray-900 mb-1">{post.title}</h4>
                    <p className="text-sm text-gray-500">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-10 h-10 text-gray-900" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">No posts yet</h4>
              <p className="text-gray-600 mb-4">Share your experiences with freelancers!</p>
              <button className="px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg font-semibold hover:shadow-lg transition-shadow">
                Create Your First Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
