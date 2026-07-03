import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, Bookmark, Briefcase, Heart, Mail, MapPin, MessageCircle, Share2, Sparkles, Star, Trash2, Users, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import {
  appendBudgetMeta,
  formatBudgetRange,
  inferCurrencyFromLocation,
  SUPPORTED_CURRENCIES,
  type BudgetMeta,
} from '../../lib/requestBudget';
import logoImage from '../../imports/logo.png';

interface FreelancerProfileProps {
  onBack: () => void;
  requestStatus?: 'accepted' | 'pending' | 'rejected' | null;
  onOpenChat?: () => void;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;

export function FreelancerProfile({ onBack, requestStatus = null, onOpenChat }: FreelancerProfileProps) {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [profilePosts, setProfilePosts] = useState<any[]>([]);
  const [postEngagement, setPostEngagement] = useState<Record<string, { likes: number; comments: number; shares: number; saves: number; liked: boolean; saved: boolean }>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, any[]>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<string, boolean>>({});
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [isFollowingTarget, setIsFollowingTarget] = useState(false);
  const [isFollowedByTarget, setIsFollowedByTarget] = useState(false);
  const [isFollowActionPending, setIsFollowActionPending] = useState(false);
  const [activeProjects, setActiveProjects] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectName: '',
    budgetMin: '',
    budgetMax: '',
    currency: 'THB',
    description: '',
  });

  const targetFreelancerUserId = profile?.id || freelancerProfile?.user_id || id || null;

  useEffect(() => {
    let isMounted = true;

    async function loadClientCurrency() {
      if (!user?.id) return;

      const response = await DataService.getUser(user.id);
      if (!isMounted) return;

      const inferredCurrency = inferCurrencyFromLocation(response.data?.location || null);
      setFormData((current) => ({ ...current, currency: inferredCurrency }));
    }

    loadClientCurrency();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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

      let userResponse = await DataService.getUser(id);
      let freelancerResponse = await DataService.getFreelancerProfile(id);

      if (!userResponse.data && freelancerResponse.error) {
        const profileIdResponse = await DataService.getFreelancerProfileById(id);
        if (profileIdResponse.data?.user_id) {
          freelancerResponse = profileIdResponse;
          userResponse = await DataService.getUser(profileIdResponse.data.user_id);
        }
      }

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

      const targetId = userResponse.data?.id || freelancerResponse.data?.user_id || id;

      if (user?.id && user.id !== targetId) {
        const favoriteResponse = await DataService.isFavorited(user.id, targetId);
        if (isMounted && !favoriteResponse.error) {
          setIsFavorited(favoriteResponse.isFavorited);
        }

        const followingResponse = await DataService.isFollowing(user.id, targetId);
        if (isMounted && !followingResponse.error) {
          setIsFollowingTarget(followingResponse.isFollowing);
        }

        const followedByResponse = await DataService.isFollowing(targetId, user.id);
        if (isMounted && !followedByResponse.error) {
          setIsFollowedByTarget(followedByResponse.isFollowing);
        }
      } else {
        setIsFavorited(false);
        setIsFollowingTarget(false);
        setIsFollowedByTarget(false);
      }

      const followCountsResponse = await DataService.getFollowCounts(targetId);
      if (isMounted && !followCountsResponse.error) {
        setFollowCounts({
          followers: followCountsResponse.followerCount,
          following: followCountsResponse.followingCount,
        });
      }

      const bookingsResponse = await DataService.getFreelancerBookings(targetId);
      if (isMounted && !bookingsResponse.error) {
        const bookingRows = bookingsResponse.data || [];
        setActiveProjects(
          bookingRows.filter((booking: any) => ['pending', 'confirmed', 'in_progress'].includes(booking.status)).length
        );
        setCompletedProjects(bookingRows.filter((booking: any) => booking.status === 'completed').length);
      }

      const postsResponse = await DataService.getClientPostsByClientId(targetId, 12);
      if (isMounted && !postsResponse.error) {
        const loadedPosts = postsResponse.data || [];
        setProfilePosts(loadedPosts);
        const statsResponse = await DataService.getClientPostEngagementStats(
          loadedPosts.map((post: any) => String(post.id)),
          user?.id
        );

        const statsById = new Map((statsResponse.data || []).map((item: any) => [String(item.post_id), item]));
        const seed: Record<string, { likes: number; comments: number; shares: number; saves: number; liked: boolean; saved: boolean }> = {};
        loadedPosts.forEach((post: any) => {
          const stats = statsById.get(String(post.id));
          seed[String(post.id)] = {
            likes: Math.max(0, Number(stats?.likes || 0)),
            comments: Math.max(0, Number(stats?.comments || 0)),
            shares: Math.max(0, Number(stats?.shares || 0)),
            saves: Math.max(0, Number(stats?.saves || 0)),
            liked: !!stats?.liked_by_me,
            saved: !!stats?.saved_by_me,
          };
        });
        setPostEngagement(seed);
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
  const isTargetFreelancer = profile?.role === 'freelancer' || !!freelancerProfile;

  const featuredPortfolio = useMemo(() => portfolioItems.length > 0 ? portfolioItems : [], [portfolioItems]);
  const focusedPost = useMemo(
    () => profilePosts.find((post) => String(post.id) === focusedPostId) || null,
    [profilePosts, focusedPostId]
  );

  const handleFavoriteToggle = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    setError(null);

    const response = isFavorited
      ? await DataService.removeFavorite(user.id, targetFreelancerUserId)
      : await DataService.addFavorite(user.id, targetFreelancerUserId);

    if (response.error) {
      setError((response.error as any).message || 'Unable to update favorites.');
      return;
    }

    setIsFavorited((current) => !current);
  };

  const handleFollowToggle = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    setError(null);
    setIsFollowActionPending(true);

    try {
      const targetIsFollowingMe = isFollowedByTarget;
      if (isFollowingTarget) {
        const response = await DataService.unfollowUser(user.id, targetFreelancerUserId);
        if (response.error) throw response.error;
        setIsFollowingTarget(false);
      } else {
        const response = await DataService.followUser(user.id, targetFreelancerUserId);
        if (response.error) throw response.error;
        setIsFollowingTarget(true);
        if (targetIsFollowingMe) {
          setIsFollowedByTarget(true);
        }
      }

      setFollowCounts((current) => ({
        followers: current.followers + (isFollowingTarget ? -1 : 1),
        following: current.following,
      }));

      if (!isFollowingTarget && targetIsFollowingMe) {
        setSuccessMessage('You are now connected.');
      }
    } catch (followError) {
      setError((followError as any).message || 'Unable to update follow status.');
    } finally {
      setIsFollowActionPending(false);
    }
  };

  const handleSubmitRequest = async (event: FormEvent) => {
    event.preventDefault();

    if (!user?.id || !targetFreelancerUserId) {
      setError('You must be signed in to send a booking request.');
      return;
    }

    if (user.role !== 'client') {
      setError('Only client accounts can submit booking requests.');
      return;
    }

    const budgetMin = Number(formData.budgetMin);
    const budgetMax = Number(formData.budgetMax);

    if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin <= 0 || budgetMax <= 0) {
      setError('Enter a valid budget range.');
      return;
    }

    if (budgetMax < budgetMin) {
      setError('Maximum budget must be greater than or equal to minimum budget.');
      return;
    }

    const budgetMeta: BudgetMeta = {
      currency: formData.currency,
      min: budgetMin,
      max: budgetMax,
    };

    const requestMessage = appendBudgetMeta(formData.description, budgetMeta);

    setIsSubmittingRequest(true);
    setError(null);

    const { error: requestError } = await DataService.createRequest({
      client_id: user.id,
      freelancer_id: targetFreelancerUserId,
      project_name: formData.projectName,
      description: requestMessage,
      budget: budgetMax,
      message: requestMessage,
      status: 'pending',
    } as any);

    if (requestError) {
      setError((requestError as any).message || 'Unable to send booking request.');
      setIsSubmittingRequest(false);
      return;
    }

    setSuccessMessage('Booking request sent successfully.');
    setShowBookingForm(false);
    setFormData((current) => ({
      ...current,
      projectName: '',
      budgetMin: '',
      budgetMax: '',
      description: '',
    }));
    setIsSubmittingRequest(false);
  };

  const togglePostLike = async (postId: string) => {
    const engagement = postEngagement[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
    setPostEngagement((current) => {
      const existing = current[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [postId]: {
          ...existing,
          liked: !existing.liked,
          likes: existing.liked ? Math.max(0, existing.likes - 1) : existing.likes + 1,
        },
      };
    });

    if (!user?.id) {
      return;
    }

    const response = await DataService.toggleClientPostLike(user.id, postId, engagement.liked);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update like status.');
      setPostEngagement((current) => {
        const existing = current[postId] || engagement;
        return {
          ...current,
          [postId]: {
            ...existing,
            liked: engagement.liked,
            likes: engagement.liked ? existing.likes + 1 : Math.max(0, existing.likes - 1),
          },
        };
      });
    }
  };

  const togglePostSave = async (postId: string) => {
    const engagement = postEngagement[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
    setPostEngagement((current) => {
      const existing = current[postId] || engagement;
      return {
        ...current,
        [postId]: {
          ...existing,
          saved: !existing.saved,
          saves: existing.saved ? Math.max(0, existing.saves - 1) : existing.saves + 1,
        },
      };
    });

    if (!user?.id) {
      return;
    }

    const response = await DataService.toggleClientPostSave(user.id, postId, engagement.saved);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update save status.');
      setPostEngagement((current) => {
        const existing = current[postId] || engagement;
        return {
          ...current,
          [postId]: {
            ...existing,
            saved: engagement.saved,
            saves: engagement.saved ? existing.saves + 1 : Math.max(0, existing.saves - 1),
          },
        };
      });
    }
  };

  const sharePost = async (postId: string) => {
    const shareUrl = `${window.location.origin}/profile/${targetFreelancerUserId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore clipboard errors.
    }

    setPostEngagement((current) => {
      const existing = current[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [postId]: {
          ...existing,
          shares: existing.shares + 1,
        },
      };
    });

    if (!user?.id) {
      return;
    }

    const response = await DataService.recordClientPostShare(user.id, postId);
    if (response.error) {
      setError((response.error as any).message || 'Unable to record share.');
      setPostEngagement((current) => {
        const existing = current[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
        return {
          ...current,
          [postId]: {
            ...existing,
            shares: Math.max(0, existing.shares - 1),
          },
        };
      });
    }
  };

  const openPostFocus = async (postId: string) => {
    setFocusedPostId(postId);
    const response = await DataService.getClientPostComments(postId, 100);
    if (response.error) {
      setError((response.error as any).message || 'Unable to load comments.');
      return;
    }
    setCommentsByPostId((current) => ({ ...current, [postId]: response.data || [] }));
  };

  const submitComment = async (postId: string) => {
    const draft = (commentDraftByPostId[postId] || '').trim();
    if (!draft || !user?.id) {
      return;
    }

    setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: true }));
    const response = await DataService.addClientPostComment(user.id, postId, draft);
    if (response.error) {
      setError((response.error as any).message || 'Unable to add comment.');
      setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: false }));
      return;
    }

    setCommentsByPostId((current) => ({
      ...current,
      [postId]: [...(current[postId] || []), response.data],
    }));
    setPostEngagement((current) => {
      const existing = current[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [postId]: {
          ...existing,
          comments: existing.comments + 1,
        },
      };
    });
    setCommentDraftByPostId((current) => ({ ...current, [postId]: '' }));
    setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: false }));
  };

  const deletePost = async (postId: string) => {
    if (!user?.id) {
      return;
    }

    const targetPost = profilePosts.find((post) => String(post.id) === postId);
    if (!targetPost || String(targetPost.client_id) !== user.id) {
      return;
    }

    const confirmed = window.confirm('Delete this post? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    const response = await DataService.deleteClientPost(postId, user.id);
    if (response.error) {
      setError((response.error as any).message || 'Unable to delete post.');
      return;
    }

    setProfilePosts((current) => current.filter((post) => String(post.id) !== postId));
    setPostEngagement((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setCommentsByPostId((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setCommentDraftByPostId((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setIsSubmittingCommentByPostId((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setFocusedPostId(null);
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

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{followCounts.followers}</span>
                      <span>Followers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{followCounts.following}</span>
                      <span>Following</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  {user?.id !== targetFreelancerUserId && (
                    <button
                      type="button"
                      onClick={handleFavoriteToggle}
                      className={`p-3 rounded-full transition-all ${isFavorited ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {requestStatus === 'accepted' && isTargetFreelancer ? (
                    <button
                      onClick={onOpenChat}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg transition-all"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Open Chat
                    </button>
                  ) : (
                    user?.id !== targetFreelancerUserId && isTargetFreelancer && (
                      <button
                        onClick={() => setShowBookingForm(true)}
                        className="px-6 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl text-base font-semibold hover:shadow-lg transition-all"
                      >
                        Request Booking
                      </button>
                    )
                  )}

                  {user?.id && user.id !== targetFreelancerUserId && (
                    <button
                      type="button"
                      onClick={handleFollowToggle}
                      disabled={isFollowActionPending}
                      className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                        isFollowingTarget
                          ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          : 'bg-gray-900 text-white hover:bg-black'
                      } ${isFollowActionPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isFollowingTarget ? 'Following' : isFollowedByTarget ? 'Follow back' : 'Follow'}
                    </button>
                  )}
                  {user?.id && user.id !== targetFreelancerUserId && isFollowedByTarget && !isFollowingTarget && (
                    <span className="rounded-full bg-green-100 px-3 py-2 text-xs font-semibold text-green-700">
                      Follows you
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-4 border-y border-gray-200 py-5">
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
                <div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                    <span className="font-semibold text-gray-900">{activeProjects}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">active projects</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
                    <span className="font-semibold text-gray-900">{completedProjects}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">completed projects</p>
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

        {profilePosts.length > 0 && (
          <section className="mt-8 rounded-3xl bg-white p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
            <p className="mt-1 text-sm text-gray-600">Posts from this profile also visible in For You feed.</p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {profilePosts.map((post) => {
                const postId = String(post.id);
                const engagement = postEngagement[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
                return (
                  <article key={post.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <button type="button" onClick={() => void openPostFocus(postId)} className="aspect-[4/3] w-full bg-white text-left">
                      <ImageWithFallback
                        src={post.image_url || avatarUrl}
                        alt={post.caption || 'Post image'}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <div className="p-4">
                      <p className="text-sm text-gray-700">{post.caption || 'No caption'}</p>
                      <div className="mt-3 flex items-center gap-3 text-sm text-gray-700 flex-wrap">
                        <button
                          type="button"
                          onClick={() => void togglePostLike(postId)}
                          className="inline-flex items-center gap-1"
                        >
                          <Heart className={`h-4 w-4 ${engagement.liked ? 'fill-red-500 text-red-500' : ''}`} />
                          {engagement.likes}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openPostFocus(postId)}
                          className="inline-flex items-center gap-1"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {engagement.comments}
                        </button>
                        <button type="button" onClick={() => void sharePost(postId)} className="inline-flex items-center gap-1">
                          <Share2 className="h-4 w-4" />
                          {engagement.shares}
                        </button>
                        <button type="button" onClick={() => void togglePostSave(postId)} className="inline-flex items-center gap-1">
                          <Bookmark className={`h-4 w-4 ${engagement.saved ? 'fill-gray-900 text-gray-900' : ''}`} />
                          {engagement.saves}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {focusedPost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setFocusedPostId(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-gray-700 shadow"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="max-h-[55vh] overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={focusedPost.image_url || avatarUrl}
                alt={focusedPost.caption || 'Post image'}
                className="h-full max-h-[55vh] w-full object-contain"
              />
            </div>

            <div className="max-h-[40vh] overflow-y-auto p-5">
              <p className="mb-4 whitespace-pre-line text-sm text-gray-800">{focusedPost.caption || 'No caption'}</p>
              {(() => {
                const postId = String(focusedPost.id);
                const engagement = postEngagement[postId] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
                return (
                  <>
                    {user?.id && String(focusedPost.client_id) === user.id && (
                      <div className="mb-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void deletePost(postId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                    <div className="mb-4 flex items-center gap-4 border-y border-gray-200 py-3">
                      <button onClick={() => void togglePostLike(postId)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Heart className={`h-5 w-5 ${engagement.liked ? 'fill-red-500 text-red-500' : ''}`} />
                        {engagement.likes}
                      </button>
                      <button onClick={() => void openPostFocus(postId)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <MessageCircle className="h-5 w-5" />
                        {engagement.comments}
                      </button>
                      <button onClick={() => void sharePost(postId)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Share2 className="h-5 w-5" />
                        {engagement.shares}
                      </button>
                      <button onClick={() => void togglePostSave(postId)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Bookmark className={`h-5 w-5 ${engagement.saved ? 'fill-gray-900 text-gray-900' : ''}`} />
                        {engagement.saves}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(commentsByPostId[postId] || []).length === 0 ? (
                        <p className="text-sm text-gray-500">No comments yet.</p>
                      ) : (
                        (commentsByPostId[postId] || []).map((comment: any) => (
                          <div key={comment.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="font-semibold text-gray-800">{comment.user?.full_name || 'User'}</span>
                              <span>•</span>
                              <span>{new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-800">{comment.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        value={commentDraftByPostId[postId] || ''}
                        onChange={(event) =>
                          setCommentDraftByPostId((current) => ({
                            ...current,
                            [postId]: event.target.value,
                          }))
                        }
                        placeholder="Write a comment..."
                        className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => void submitComment(postId)}
                        disabled={!!isSubmittingCommentByPostId[postId]}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {isSubmittingCommentByPostId[postId] ? 'Sending...' : 'Comment'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
                <label className="mb-2 block text-sm font-semibold text-gray-900">Budget Range</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <select
                    value={formData.currency}
                    onChange={(event) => setFormData((current) => ({ ...current, currency: event.target.value }))}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {SUPPORTED_CURRENCIES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} - {item.label}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    inputMode="decimal"
                    value={formData.budgetMin}
                    onChange={(event) => setFormData((current) => ({ ...current, budgetMin: event.target.value }))}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Min budget"
                  />
                  <input
                    required
                    inputMode="decimal"
                    value={formData.budgetMax}
                    onChange={(event) => setFormData((current) => ({ ...current, budgetMax: event.target.value }))}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Max budget"
                  />
                </div>
                {formData.budgetMin && formData.budgetMax && (
                  <p className="mt-2 text-xs text-gray-600">
                    Requested range: {formatBudgetRange({
                      currency: formData.currency,
                      min: Number(formData.budgetMin || 0),
                      max: Number(formData.budgetMax || 0),
                    })}
                  </p>
                )}
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
