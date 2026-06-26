import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, Briefcase, Heart, Mail, MapPin, MessageCircle, Sparkles, Star, Users, X } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import logoImage from '../../imports/logo.png';

interface FreelancerProfileProps {
  onBack: () => void;
  requestStatus?: 'accepted' | 'pending' | 'rejected' | null;
  onOpenChat?: () => void;
}

const fallbackProfileImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

export function FreelancerProfile({ onBack, requestStatus = null, onOpenChat }: FreelancerProfileProps) {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectName: '',
    budget: '',
    description: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!id) {
        if (isMounted) {
          setError('Missing freelancer id.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      const [userResponse, freelancerResponse] = await Promise.all([
        DataService.getUser(id),
        DataService.getFreelancerProfile(id),
      ]);

      if (!isMounted) {
        return;
      }

      if (userResponse.error || !userResponse.data) {
        setError((userResponse.error as any)?.message || 'Unable to load this freelancer.');
        setProfile(null);
        setFreelancerProfile(null);
        setPortfolioItems([]);
        setIsLoading(false);
        return;
      }

      setProfile(userResponse.data);
      setFreelancerProfile(freelancerResponse.data || null);

      if (freelancerResponse.data?.id) {
        const portfolioResponse = await DataService.getFreelancerPortfolio(freelancerResponse.data.id);
        if (!isMounted) {
          return;
        }

        if (portfolioResponse.error) {
          setError((portfolioResponse.error as any).message || 'Unable to load portfolio items.');
          setPortfolioItems([]);
        } else {
          setPortfolioItems(portfolioResponse.data || []);
        }
      } else {
        setPortfolioItems([]);
      }

      if (user?.id && user.id !== id) {
        const favoriteResponse = await DataService.isFavorited(user.id, id);
        if (isMounted && !favoriteResponse.error) {
          setIsFavorited(favoriteResponse.isFavorited);
        }
      } else {
        setIsFavorited(false);
      }

      setIsLoading(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [id, user?.id]);

  const displayName = profile?.full_name || 'Creative Freelancer';
  const avatarUrl = profile?.avatar_url || fallbackProfileImage;
  const location = profile?.location || 'Location not provided';
  const bio = profile?.bio || freelancerProfile?.description || 'This freelancer has not added a bio yet.';
  const title = freelancerProfile?.title || 'Freelancer';
  const rating = Number(profile?.rating || 0);
  const totalReviews = Number(profile?.total_reviews || 0);
  const portfolioCount = Number(freelancerProfile?.portfolio_count || portfolioItems.length || 0);
  const availability = freelancerProfile?.is_available === false ? 'Currently unavailable' : 'Available for new bookings';
  const skills = freelancerProfile?.skills || [];
  const styles = freelancerProfile?.styles || [];

  const featuredPortfolio = useMemo(() => portfolioItems.length > 0 ? portfolioItems : [], [portfolioItems]);

  const handleFavoriteToggle = async () => {
    if (!user?.id || !id || user.id === id) {
      return;
    }

    setError(null);

    const response = isFavorited
      ? await DataService.removeFavorite(user.id, id)
      : await DataService.addFavorite(user.id, id);

    if (response.error) {
      setError((response.error as any).message || 'Unable to update favorites.');
      return;
    }

    setIsFavorited((current) => !current);
  };

  const handleSubmitRequest = async (event: FormEvent) => {
    event.preventDefault();

    if (!user?.id || !id) {
      setError('You must be signed in to send a booking request.');
      return;
    }

    const budget = Number(formData.budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      setError('Enter a valid budget amount.');
      return;
    }

    setIsSubmittingRequest(true);
    setError(null);

    const { error: requestError } = await DataService.createRequest({
      client_id: user.id,
      freelancer_id: id,
      project_name: formData.projectName,
      description: formData.description,
      budget,
      message: formData.description,
      status: 'pending',
    } as any);

    if (requestError) {
      setError((requestError as any).message || 'Unable to send booking request.');
      setIsSubmittingRequest(false);
      return;
    }

    setSuccessMessage('Booking request sent successfully.');
    setShowBookingForm(false);
    setFormData({ projectName: '', budget: '', description: '' });
    setIsSubmittingRequest(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 p-6">
        <div className="mx-auto max-w-[960px] rounded-3xl bg-white p-6 shadow-xl border border-red-200">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3 md:gap-6">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
              </button>
              <img src={logoImage} alt="CreativeHUB" className="h-12 md:h-14 w-auto object-contain" />
            </div>
            {successMessage && <span className="hidden md:block text-sm text-green-700">{successMessage}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 md:py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 md:hidden">
            {successMessage}
          </div>
        )}

        <section className="mb-8 rounded-3xl bg-white p-6 md:p-8 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="w-32 h-32 md:w-40 md:h-40 overflow-hidden rounded-full ring-4 ring-gray-100 shrink-0">
              <ImageWithFallback src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{displayName}</h1>
                  <p className="mt-2 text-lg text-gray-600">{title}</p>
                  <div className="mt-4 flex flex-col gap-2 text-sm md:text-base text-gray-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                      <span>{location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                      <span>{availability}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                      <span>{profile?.email || 'Email unavailable'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {user?.id !== id && (
                    <button
                      onClick={handleFavoriteToggle}
                      className={`p-3 rounded-full transition-all ${isFavorited ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {requestStatus === 'accepted' ? (
                    <button
                      onClick={onOpenChat}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg transition-all"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Open Chat
                    </button>
                  ) : (
                    user?.id !== id && (
                      <button
                        onClick={() => setShowBookingForm(true)}
                        className="px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg transition-all"
                      >
                        Request Booking
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-y border-gray-200 py-5">
                <div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-gray-900">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{totalReviews} reviews</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                    <span className="font-semibold text-gray-900">{portfolioCount}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">portfolio items</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                    <span className="font-semibold text-gray-900">{freelancerProfile?.experience_years || 0} yrs</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">experience</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                    <span className="font-semibold text-gray-900">{freelancerProfile?.hourly_rate ? `฿${freelancerProfile.hourly_rate}/hr` : 'Custom'}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">starting rate</p>
                </div>
              </div>

              <p className="mt-6 text-gray-700 leading-7">{bio}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
            {featuredPortfolio.length === 0 ? (
              <p className="mt-4 text-gray-600">No portfolio items have been added yet.</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {featuredPortfolio.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <div className="aspect-[4/3] bg-white">
                      <ImageWithFallback
                        src={item.image_urls?.[0] || avatarUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <p className="mt-2 text-sm text-gray-600">{item.description || 'No description provided.'}</p>
                      {item.tools_used?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.tools_used.map((tool: string) => (
                            <span key={tool} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Specialties</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {skills.length > 0 ? skills.map((skill: string) => (
                  <span key={skill} className="rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                    {skill}
                  </span>
                )) : <p className="text-sm text-gray-600">No skills listed yet.</p>}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Creative Style</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {styles.length > 0 ? styles.map((style: string) => (
                  <span key={style} className="rounded-full bg-gray-900 px-3 py-2 text-sm font-semibold text-white">
                    {style}
                  </span>
                )) : <p className="text-sm text-gray-600">No style tags listed yet.</p>}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Working Details</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p><span className="font-semibold text-gray-900">Availability:</span> {availability}</p>
                <p><span className="font-semibold text-gray-900">Hourly rate:</span> {freelancerProfile?.hourly_rate ? `฿${freelancerProfile.hourly_rate}` : 'Discuss per project'}</p>
                <p><span className="font-semibold text-gray-900">Experience:</span> {freelancerProfile?.experience_years || 0} years</p>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {showBookingForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm md:p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 md:px-8 md:py-6 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-gray-900">Request Booking</h2>
              <button onClick={() => setShowBookingForm(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-4 md:p-8 space-y-6">
              <div className="rounded-2xl bg-gray-50 p-5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-gray-200">
                    <ImageWithFallback src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                    <p className="text-gray-600">{title}</p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="projectName" className="mb-2 block text-sm font-semibold text-gray-900">Project Name</label>
                <input
                  id="projectName"
                  required
                  value={formData.projectName}
                  onChange={(event) => setFormData((current) => ({ ...current, projectName: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="e.g. Editorial shoot, brand campaign, portrait session"
                />
              </div>

              <div>
                <label htmlFor="budget" className="mb-2 block text-sm font-semibold text-gray-900">Budget</label>
                <input
                  id="budget"
                  required
                  inputMode="decimal"
                  value={formData.budget}
                  onChange={(event) => setFormData((current) => ({ ...current, budget: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-2 block text-sm font-semibold text-gray-900">Project Description</label>
                <textarea
                  id="description"
                  required
                  rows={6}
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Describe the deliverables, schedule, references, and any location requirements."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBookingForm(false)} className="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingRequest} className="flex-1 rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3 font-semibold text-white hover:shadow-lg transition-all disabled:opacity-60">
                  {isSubmittingRequest ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
