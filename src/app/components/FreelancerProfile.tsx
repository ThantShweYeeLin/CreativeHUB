import { ArrowLeft, Star, MapPin, Briefcase, Phone, Mail, Heart, Users, X, MessageCircle, Sparkles } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import logoImage from '../../imports/logo.png';
import { DataService } from '../../lib/dataService';
import { FreelancerMapProfile, normalizeFreelancer } from '../../lib/freelancerMapper';

interface FreelancerProfileProps {
  onBack: () => void;
  requestStatus?: 'accepted' | 'pending' | 'rejected' | null;
  onOpenChat?: () => void;
}

export function FreelancerProfile({ onBack, requestStatus = null, onOpenChat }: FreelancerProfileProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [freelancer, setFreelancer] = useState<FreelancerMapProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
    budget: '',
    description: '',
  });
  const visiblePortfolio = useMemo(
    () => freelancer?.portfolio.length ? freelancer.portfolio : [],
    [freelancer]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadFreelancer() {
      if (!id) {
        setFreelancer(null);
        setErrorMessage('Freelancer not found.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await DataService.getFreelancerById(id);

      if (!isMounted) return;

      if (error || !data) {
        setFreelancer(null);
        setErrorMessage('Freelancer not found.');
        setIsLoading(false);
        return;
      }

      setFreelancer(normalizeFreelancer(data));
      setIsLoading(false);
    }

    loadFreelancer();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('Booking submitted:', formData);
    setIsBookingFormOpen(false);
    setFormData({ projectName: '', budget: '', description: '' });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    }

    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
          <p className="text-sm text-gray-600">Loading freelancer profile...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !freelancer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center max-w-md w-full">
          <p className="text-xl font-bold text-gray-900">Freelancer not found.</p>
          <button
            onClick={() => navigate('/map')}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg transition-all"
          >
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3 md:gap-6">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
              </button>
              <img
                src={logoImage}
                alt="CreativeHUB"
                className="h-12 md:h-14 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-4 md:p-8 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden ring-4 ring-gray-100">
                <ImageWithFallback
                  src={freelancer.profileImage}
                  alt={freelancer.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className={`absolute bottom-2 right-2 w-5 h-5 md:w-6 md:h-6 rounded-full border-4 border-white ${freelancer.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            </div>

            {/* Info */}
            <div className="flex-1 w-full">
              <div className="mb-4">
                <div className="text-center md:text-left mb-4">
                  <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">{freelancer.fullName}</h1>
                  <p className="text-base md:text-xl text-gray-600 mb-3 md:mb-4">@{freelancer.username || 'freelancer'}</p>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 text-gray-700 text-sm md:text-base">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                      <span className="font-medium">{freelancer.location || 'Location not provided'}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                      <span className="font-medium">{freelancer.profession}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center md:justify-start gap-3">
                  <button
                    onClick={() => setIsFavorited(!isFavorited)}
                    className={`p-3 rounded-full transition-all self-center md:self-auto ${
                      isFavorited
                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => setShowPortfolioModal(true)}
                    className="px-6 py-3 bg-white text-gray-900 rounded-xl text-base font-semibold border-2 border-gray-300 hover:border-gray-900 hover:text-gray-900 transition-all"
                  >
                    View Portfolio
                  </button>

                  {requestStatus === 'accepted' ? (
                    <>
                      <div className="px-6 py-3 bg-green-100 text-green-700 rounded-xl text-base font-semibold border-2 border-green-200">
                        Accepted
                      </div>
                      <button
                        onClick={onOpenChat}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Chat
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsBookingFormOpen(true)}
                      className="px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
                    >
                      Request Booking
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:flex md:flex-wrap items-center justify-center md:justify-start gap-4 md:gap-8 py-4 md:py-6 border-y border-gray-200 text-sm md:text-base">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Heart className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                  <span className="font-semibold text-gray-900">{freelancer.totalReviews}</span>
                  <span className="text-gray-600 hidden md:inline">Favorites</span>
                  <span className="text-gray-600 md:hidden">Favs</span>
                </div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                  <span className="font-semibold text-gray-900">{freelancer.totalReviews}</span>
                  <span className="text-gray-600">Clients</span>
                </div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                  <span className="font-semibold text-gray-900">{freelancer.totalProjects}</span>
                  <span className="text-gray-600">Projects</span>
                </div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-gray-900">{freelancer.rating.toFixed(1)}</span>
                  <span className="text-gray-600">({freelancer.totalReviews})</span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="mt-4 md:mt-6 flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 text-xs md:text-base">
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                  <span>{freelancer.phone || 'Phone not provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                  <span className="truncate">{freelancer.email || 'Email not provided'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Section */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-4 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">Posts</h2>
          {visiblePortfolio.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
            {visiblePortfolio.map((item, index) => (
              <div
                key={item.id}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer"
              >
                <ImageWithFallback
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-semibold">{item.title || `Project ${index + 1}`}</p>
                    <p className="text-white/80 text-sm">{item.description || freelancer.profession}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="font-semibold text-gray-900">No portfolio items yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* Booking Form Modal */}
      {isBookingFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Request Booking</h2>
              <button
                onClick={() => setIsBookingFormOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-8">
              {/* Freelancer Info Summary */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-gray-200">
                    <ImageWithFallback
                      src={freelancer.profileImage}
                      alt={freelancer.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{freelancer.fullName}</h3>
                    <p className="text-gray-600">{freelancer.profession}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-sm">{freelancer.rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({freelancer.totalReviews} reviews)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                <div>
                  <label htmlFor="projectName" className="block text-sm font-semibold text-gray-900 mb-2">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    required
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="e.g., Fashion Editorial Photoshoot"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="budget" className="block text-sm font-semibold text-gray-900 mb-2">
                    Budget (THB) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="budget"
                    required
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="e.g., 15,000 - 25,000"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
                    Project Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your project, timeline, location, and any specific requirements..."
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all resize-none"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Include details about the project scope, timeline, and deliverables
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center gap-3 md:gap-4 mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsBookingFormOpen(false)}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gray-100 text-gray-700 rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portfolio Information Modal */}
      {showPortfolioModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 md:px-8 py-4 md:py-6 rounded-t-3xl flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Portfolio Details</h2>
                <p className="text-xs md:text-sm text-gray-600 mt-1">Professional information & requirements</p>
              </div>
              <button
                onClick={() => setShowPortfolioModal(false)}
                className="p-2 hover:bg-white rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-4 md:p-8 space-y-4 md:space-y-6">
              {/* Description */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-gray-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                  </div>
                  Description
                </h3>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                  {freelancer.bio || 'No bio provided.'}
                </p>
              </div>

              {/* Style */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-gray-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                  </div>
                  Style
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(freelancer.skills.length > 0 ? freelancer.skills : ['No skills listed']).map((skill) => (
                    <span key={skill} className="px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-black rounded-full text-xs md:text-sm font-semibold">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience & Specialization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-gray-200">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-2">
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                    </div>
                    Experience
                  </h3>
                  <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-black text-gray-900 mb-2">
                    {freelancer.experienceYears ? `${freelancer.experienceYears}+ Years` : 'Not provided'}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600">{freelancer.profession}</p>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-gray-200">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-2">
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Star className="w-4 h-4 md:w-5 md:h-5 text-gray-800" />
                    </div>
                    Specialization
                  </h3>
                  <ul className="space-y-2 text-sm md:text-base text-gray-700">
                    {(freelancer.skills.length > 0 ? freelancer.skills : [freelancer.profession]).map((skill) => (
                      <li key={skill} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Requirements & Limits */}
              <div className="bg-gradient-to-br from-orange-50 to-white rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-orange-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    ⚙️
                  </div>
                  Requirements & Limits
                </h3>
                <ul className="space-y-2 md:space-y-3 text-sm md:text-base text-gray-700">
                  {freelancer.availability.map((availability) => (
                    <li key={availability} className="flex items-start gap-3">
                      <div className="w-4 h-4 md:w-5 md:h-5 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs">•</span>
                      </div>
                      <span>{availability}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Budget, Days, Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-5 border-2 border-gray-200 text-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2 md:mb-3">
                    <span className="text-xl md:text-2xl">💰</span>
                  </div>
                  <h4 className="text-sm md:text-base font-bold text-gray-900 mb-1 md:mb-2">Budget Range</h4>
                  <p className="text-base md:text-lg font-bold text-green-600">
                    {freelancer.hourlyRate ? `฿${freelancer.hourlyRate.toLocaleString()}` : 'Not provided'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Hourly rate</p>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-5 border-2 border-gray-200 text-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2 md:mb-3">
                    <span className="text-xl md:text-2xl">📅</span>
                  </div>
                  <h4 className="text-sm md:text-base font-bold text-gray-900 mb-1 md:mb-2">Working Days</h4>
                  <p className="text-xs md:text-sm font-semibold text-gray-700">{freelancer.availability.join(', ')}</p>
                  <p className="text-xs text-gray-500 mt-1">{freelancer.isAvailable ? 'Available' : 'Unavailable'}</p>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl md:rounded-2xl p-4 md:p-5 border-2 border-gray-200 text-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2 md:mb-3">
                    <MapPin className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                  </div>
                  <h4 className="text-sm md:text-base font-bold text-gray-900 mb-1 md:mb-2">Location</h4>
                  <p className="text-xs md:text-sm font-semibold text-gray-700">{freelancer.location || 'Not provided'}</p>
                  <p className="text-xs text-gray-500 mt-1">Travel available</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 md:px-8 py-4 md:py-6 rounded-b-3xl">
              <div className="flex items-center gap-3 md:gap-4">
                <button
                  onClick={() => setShowPortfolioModal(false)}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gray-100 text-gray-700 rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowPortfolioModal(false);
                    setIsBookingFormOpen(true);
                  }}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
                >
                  Request Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
