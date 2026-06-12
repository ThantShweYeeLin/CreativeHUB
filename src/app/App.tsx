import { useState } from 'react';
import { Search, Bell, Menu, Sparkles, ChevronLeft, ChevronRight, Star, Compass, MapPin, Grid, Heart } from 'lucide-react';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import logoImage from '../imports/logo.png';
import { FreelancerProfile } from './components/FreelancerProfile';
import { MapView } from './components/MapView';
import { PortfoliosView } from './components/PortfoliosView';
import { SearchFilterPanel } from './components/SearchFilterPanel';
import { SearchResults } from './components/SearchResults';
import { AIImageMatcher } from './components/AIImageMatcher';
import { UserMenu } from './components/UserMenu';
import { NotificationsPanel } from './components/NotificationsPanel';
import { RequestsPage } from './components/RequestsPage';
import { ClientProfilePage } from './components/ClientProfilePage';
import { BecomeFreelancerPage } from './components/BecomeFreelancerPage';
import { FreelancerDashboard } from './components/FreelancerDashboard';
import { PremiumSubscriptionPage } from './components/PremiumSubscriptionPage';
import { BookingTrackingPage } from './components/BookingTrackingPage';
import { MyBookingsPage } from './components/MyBookingsPage';
import { FavoritesPage } from './components/FavoritesPage';
import { MessagesPage } from './components/MessagesPage';
import { ForYouPage } from './components/ForYouPage';

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
  onViewProfile?: () => void;
}

function ProfileCard({ name, specialty, rating, reviews, image, onViewProfile }: ProfileCardProps) {
  const [isHovered, setIsHovered] = useState(false);

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
              onClick={onViewProfile}
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
              onClick={onViewProfile}
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
  onViewProfile: () => void;
}

function CarouselSection({ title, profiles, onViewProfile }: CarouselSectionProps) {
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
          <ProfileCard key={index} {...profile} onViewProfile={onViewProfile} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'map' | 'freelancers' | 'foryou'>('explore');
  const [showProfile, setShowProfile] = useState(false);
  const [profileRequestStatus, setProfileRequestStatus] = useState<'accepted' | 'pending' | 'rejected' | null>(null);
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showAIImageMatcher, setShowAIImageMatcher] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRequestsPage, setShowRequestsPage] = useState(false);
  const [showClientProfile, setShowClientProfile] = useState(false);
  const [showBecomeFreelancer, setShowBecomeFreelancer] = useState(false);
  const [showFreelancerDashboard, setShowFreelancerDashboard] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [showBookingTracking, setShowBookingTracking] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const handleSearchClick = () => {
    setShowSearchFilter(true);
  };

  const handleApplyFilters = () => {
    setShowSearchResults(true);
    setActiveTab('explore'); // Reset to explore view to show results
  };

  const handleAIImageSearch = (images: File[]) => {
    // TODO: Implement AI matching logic
    console.log('Searching with images:', images);
    setShowAIImageMatcher(false);
    setShowSearchResults(true);
    setActiveTab('explore');
  };

  const handleMenuSelection = (item: 'requests' | 'messages' | 'favorites' | 'settings' | 'premium' | 'bookings') => {
    if (item === 'requests') {
      setShowRequestsPage(true);
    } else if (item === 'favorites') {
      setShowFavorites(true);
    } else if (item === 'messages') {
      setShowMessages(true);
    } else if (item === 'premium') {
      setShowPremium(true);
    } else if (item === 'bookings') {
      setShowMyBookings(true);
    }
    // TODO: Handle settings
  };

  const handleSelectBooking = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setShowMyBookings(false);
    setShowBookingTracking(true);
  };

    if (showProfile) {
    return (
      <FreelancerProfile
        onBack={() => { setShowProfile(false); setProfileRequestStatus(null); }}
        requestStatus={profileRequestStatus}
        onOpenChat={() => { setShowProfile(false); setShowMessages(true); }}
      />
    );
  }
    if (showRequestsPage) {
    return (
      <RequestsPage
        onBack={() => setShowRequestsPage(false)}
        onViewProfile={(status) => { setProfileRequestStatus(status); setShowProfile(true); setShowRequestsPage(false); }}
        onOpenMessages={() => { setShowMessages(true); setShowRequestsPage(false); }}
      />
    );
  }
    if (showClientProfile) { return <ClientProfilePage onBack={() => setShowClientProfile(false)} />; }
    if (showBecomeFreelancer) { return <BecomeFreelancerPage onBack={() => setShowBecomeFreelancer(false)} />; }
    if (showFreelancerDashboard) { return <FreelancerDashboard onBack={() => setShowFreelancerDashboard(false)} />; }
    if (showPremium) { return <PremiumSubscriptionPage onBack={() => setShowPremium(false)} />; }
    if (showMyBookings) { return <MyBookingsPage onBack={() => setShowMyBookings(false)} onSelectBooking={handleSelectBooking} />; }
    if (showBookingTracking) { return <BookingTrackingPage onBack={() => { setShowBookingTracking(false); setShowMyBookings(true); }} />; }
    if (showFavorites) { return <FavoritesPage onBack={() => setShowFavorites(false)} onViewProfile={() => setShowProfile(true)} />; }
    if (showMessages) { return <MessagesPage onBack={() => setShowMessages(false)} />; }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1680px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <button
              onClick={() => setActiveTab('explore')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img
                src={logoImage}
                alt="CreativeHUB"
                className="h-12 md:h-14 w-auto object-contain"
              />
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {['Explore', 'Map', 'Freelancers', 'For You'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '') as 'foryou' | 'explore' | 'map' | 'freelancers')}
                  className={`relative py-2 font-semibold transition-colors ${
                    activeTab === tab.toLowerCase().replace(' ', '')
                      ? 'text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                  {activeTab === tab.toLowerCase().replace(' ', '') && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full" />
                  )}
                </button>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setShowFreelancerDashboard(true)}
                className="hidden md:block px-6 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                Freelancer Dashboard
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                {showNotifications && (
                  <NotificationsPanel
                    onClose={() => setShowNotifications(false)}
                    onViewProfile={(status) => {
                      setProfileRequestStatus(status);
                      setShowProfile(true);
                      setShowNotifications(false);
                    }}
                    onOpenMessages={() => {
                      setShowMessages(true);
                      setShowNotifications(false);
                    }}
                  />
                )}
              </div>
              <button
                onClick={() => setShowClientProfile(true)}
                className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center cursor-pointer hover:shadow-lg transition-shadow"
              >
                <span className="text-white text-sm md:text-base font-semibold">JD</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
                {showUserMenu && (
                  <UserMenu
                    onClose={() => setShowUserMenu(false)}
                    onSelectItem={handleMenuSelection}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* Search and AI Matcher - Only show on Explore and Freelancers */}
        {(activeTab === 'explore' || activeTab === 'freelancers') && !showSearchResults && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 mb-8 md:mb-12">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'explore'
                    ? 'Search for makeup artists, photographers, models...'
                    : 'Search freelancers...'
                }
                className="w-full pl-12 pr-4 py-3 md:py-4 bg-white rounded-2xl shadow-lg border border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSearchClick}
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
                onClick={() => setShowAIImageMatcher(true)}
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
        )}

        {/* Search Results - Show when filters are applied */}
        {showSearchResults && activeTab === 'explore' && (
          <div className="mb-8">
            <button
              onClick={() => setShowSearchResults(false)}
              className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-6"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to Explore
            </button>
            <SearchResults onViewProfile={() => setShowProfile(true)} />
          </div>
        )}

        {/* Conditional Content Based on Active Tab */}
        {activeTab === 'foryou' && <ForYouPage onViewProfile={() => setShowProfile(true)} />}

        {activeTab === 'explore' && !showSearchResults && (
          <>
            <CarouselSection
              title="Popular Makeup Artists in Thailand"
              profiles={makeupArtists}
              onViewProfile={() => setShowProfile(true)}
            />
            <CarouselSection
              title="Popular Photographers in Thailand"
              profiles={photographers}
              onViewProfile={() => setShowProfile(true)}
            />
            <CarouselSection
              title="Popular Models in Thailand"
              profiles={models}
              onViewProfile={() => setShowProfile(true)}
            />
          </>
        )}

        {activeTab === 'map' && <MapView onViewProfile={() => setShowProfile(true)} />}

        {activeTab === 'freelancers' && <PortfoliosView onViewProfile={() => setShowProfile(true)} />}
      </main>

      {/* Search Filter Modal */}
      {showSearchFilter && (
        <SearchFilterPanel
          onClose={() => setShowSearchFilter(false)}
          onSearch={handleApplyFilters}
        />
      )}

      {/* AI Image Matcher Modal */}
      {showAIImageMatcher && (
        <AIImageMatcher
          onClose={() => setShowAIImageMatcher(false)}
          onSearch={handleAIImageSearch}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              activeTab === 'explore' ? 'text-gray-900' : 'text-gray-600'
            }`}
          >
            <Compass className="w-6 h-6" />
            <span className="text-xs font-semibold">Explore</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              activeTab === 'map' ? 'text-gray-900' : 'text-gray-600'
            }`}
          >
            <MapPin className="w-6 h-6" />
            <span className="text-xs font-semibold">Map</span>
          </button>
          <button
            onClick={() => setActiveTab('freelancers')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              activeTab === 'freelancers' ? 'text-gray-900' : 'text-gray-600'
            }`}
          >
            <Grid className="w-6 h-6" />
            <span className="text-xs font-semibold">Freelancers</span>
          </button>
          <button
            onClick={() => setActiveTab('foryou')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              activeTab === 'foryou' ? 'text-gray-900' : 'text-gray-600'
            }`}
          >
            <Heart className="w-6 h-6" />
            <span className="text-xs font-semibold">For You</span>
          </button>
        </div>
      </nav>
    </div>
  );
}