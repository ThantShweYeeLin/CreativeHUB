import { ChevronLeft, Upload, Plus, Edit, Trash2, Eye, TrendingUp, MapPin, Calendar, DollarSign, Settings, Check, X, Users, Image as ImageIcon, Shield } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState } from 'react';

interface FreelancerDashboardProps {
  onBack: () => void;
}

type AvailabilityStatus = 'available' | 'busy' | 'unavailable';

const portfolioItems = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1758613653735-9d7e87996110?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    title: 'Sunset Fashion Editorial',
    style: ['Cinematic', 'Soft Lighting'],
    views: 1245,
    likes: 89
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1758613653298-738e98658e31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    title: 'Urban Portrait Series',
    style: ['Minimalist', 'Editorial'],
    views: 2103,
    likes: 156
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1758613653231-bae4e1131dde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    title: 'Studio Beauty',
    style: ['Soft Lighting', 'Minimalist'],
    views: 892,
    likes: 67
  }
];

const pendingRequests = [
  {
    id: 1,
    client: 'Sarah Miller',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    project: 'Wedding Photography',
    budget: 25000,
    date: '2026-05-20'
  },
  {
    id: 2,
    client: 'John Davis',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    project: 'Fashion Editorial Shoot',
    budget: 18000,
    date: '2026-05-25'
  }
];

export function FreelancerDashboard({ onBack }: FreelancerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'requests' | 'settings' | 'analytics'>('portfolio');
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [serviceInfo, setServiceInfo] = useState({
    minBudget: 8000,
    maxBudget: 25000,
    depositAmount: 3000,
    workingDays: 'Monday - Saturday',
    location: 'Bangkok, Thailand'
  });

  const getAvailabilityColor = (status: AvailabilityStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'busy':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'unavailable':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 mb-6 md:mb-8">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            Back to Home
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Freelancer Dashboard</h1>
              <p className="text-sm md:text-base text-gray-600">Manage your creative business</p>
            </div>

            {/* Availability Status Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Status:</span>
              {(['available', 'busy', 'unavailable'] as AvailabilityStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setAvailability(status)}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold border-2 capitalize transition-all ${
                    availability === status
                      ? getAvailabilityColor(status)
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 p-2 mb-6 md:mb-8 flex gap-2 overflow-x-auto">
          {[
            { id: 'portfolio', label: 'Portfolio', icon: ImageIcon },
            { id: 'requests', label: 'Requests', icon: Users },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.label.slice(0, 4)}</span>
            </button>
          ))}
        </div>

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6 md:space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">My Portfolio</h2>
              <button className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:inline">Add Project</span>
                <span className="md:hidden">Add</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {portfolioItems.map((item) => (
                <div key={item.id} className="group bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl transition-all">
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    <ImageWithFallback
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-3 md:bottom-4 left-3 md:left-4 right-3 md:right-4 flex gap-2">
                        <button className="flex-1 bg-white text-gray-900 py-2 md:py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
                          <Edit className="w-4 h-4 mx-auto" />
                        </button>
                        <button className="flex-1 bg-red-500 text-white py-2 md:py-2.5 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors">
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 md:p-5">
                    <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {item.style.map((tag) => (
                        <span key={tag} className="px-2 md:px-3 py-1 bg-gray-100 text-black rounded-full text-xs font-semibold">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs md:text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{item.views}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>❤️</span>
                        <span>{item.likes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Pending Requests</h2>
              <p className="text-sm md:text-base text-gray-600">{pendingRequests.length} collaboration requests waiting</p>
            </div>

            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden ring-2 ring-white shadow-lg flex-shrink-0 self-center md:self-auto">
                      <ImageWithFallback
                        src={request.avatar}
                        alt={request.client}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">{request.project}</h3>
                      <p className="text-sm md:text-base text-gray-600 mb-2">
                        <span className="font-semibold">{request.client}</span> • Date: {new Date(request.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-base md:text-lg font-bold text-green-600">฿{request.budget.toLocaleString()}</p>
                    </div>

                    <div className="flex md:flex-col gap-2 md:gap-3">
                      <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all">
                        <Check className="w-4 h-4 md:w-5 md:h-5" />
                        Accept
                      </button>
                      <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gray-100 text-gray-700 rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors">
                        <X className="w-4 h-4 md:w-5 md:h-5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Analytics & Insights</h2>
              <p className="text-sm md:text-base text-gray-600">Track your performance</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Profile Views', value: '2,847', change: '+12%', icon: Eye, color: 'from-gray-700 to-gray-800' },
                { label: 'AI Matches', value: '156', change: '+24%', icon: TrendingUp, color: 'from-gray-700 to-gray-800' },
                { label: 'Portfolio Likes', value: '892', change: '+8%', icon: Users, color: 'from-green-500 to-emerald-500' },
                { label: 'Requests', value: '23', change: '+18%', icon: Users, color: 'from-orange-500 to-red-500' }
              ].map((stat, index) => (
                <div key={index} className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6">
                  <div className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-3 md:mb-4`}>
                    <stat.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
                  <p className="text-xs md:text-sm text-green-600 font-semibold">{stat.change} this month</p>
                </div>
              ))}
            </div>

            {/* Most Viewed Styles */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">Most Viewed Styles</h3>
              <div className="space-y-3 md:space-y-4">
                {[
                  { style: 'Cinematic', views: 1847, percentage: 85 },
                  { style: 'Soft Lighting', views: 1523, percentage: 70 },
                  { style: 'Minimalist', views: 1289, percentage: 59 }
                ].map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm md:text-base font-semibold text-gray-900">{item.style}</span>
                      <span className="text-sm md:text-base text-gray-600">{item.views} views</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 md:h-3">
                      <div
                        className="bg-gradient-to-r from-gray-900 to-black h-2 md:h-3 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Service Settings</h2>
              <p className="text-sm md:text-base text-gray-600">Configure your freelance services</p>
            </div>

            {/* Service Information */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">Pricing & Availability</h3>
              <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Budget</label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                      <DollarSign className="w-5 h-5 text-gray-600" />
                      <input
                        type="number"
                        value={serviceInfo.minBudget}
                        onChange={(e) => setServiceInfo({ ...serviceInfo, minBudget: Number(e.target.value) })}
                        className="flex-1 bg-transparent outline-none text-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Budget</label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                      <DollarSign className="w-5 h-5 text-gray-600" />
                      <input
                        type="number"
                        value={serviceInfo.maxBudget}
                        onChange={(e) => setServiceInfo({ ...serviceInfo, maxBudget: Number(e.target.value) })}
                        className="flex-1 bg-transparent outline-none text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Booking Deposit Amount
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-gray-900">
                    <Shield className="w-5 h-5 text-gray-900" />
                    <span className="text-gray-600">฿</span>
                    <input
                      type="number"
                      value={serviceInfo.depositAmount}
                      onChange={(e) => setServiceInfo({ ...serviceInfo, depositAmount: Number(e.target.value) })}
                      className="flex-1 bg-transparent outline-none text-gray-900 font-semibold"
                      placeholder="e.g., 3000"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Clients will transfer this deposit to secure bookings. Deposit is held safely and transferred to you after service completion.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Working Days</label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <input
                      type="text"
                      value={serviceInfo.workingDays}
                      onChange={(e) => setServiceInfo({ ...serviceInfo, workingDays: e.target.value })}
                      className="flex-1 bg-transparent outline-none text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Service Location</label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <MapPin className="w-5 h-5 text-gray-600" />
                    <input
                      type="text"
                      value={serviceInfo.location}
                      onChange={(e) => setServiceInfo({ ...serviceInfo, location: e.target.value })}
                      className="flex-1 bg-transparent outline-none text-gray-900"
                    />
                  </div>
                </div>

                <button className="w-full px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all">
                  Save Changes
                </button>
              </div>
            </div>

            {/* Creative Identity */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">Creative Identity</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Your Style Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {['Minimalist', 'Cinematic', 'Soft Lighting', 'Editorial', 'Vibrant', 'Dramatic'].map((tag) => (
                      <button
                        key={tag}
                        className="px-3 md:px-4 py-2 bg-gray-100 text-black rounded-full text-xs md:text-sm font-semibold hover:bg-gray-200 transition-colors"
                      >
                        {tag} ×
                      </button>
                    ))}
                    <button className="px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-xs md:text-sm font-semibold hover:bg-gray-200 transition-colors">
                      + Add Style
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
