import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, Bookmark, Briefcase, Heart, Mail, MapPin, MessageCircle, Share2, Sparkles, Star, Users, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { dispatchClientPostUpdated } from '../../lib/clientPostSync';
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

type FollowRelationship = 'follow' | 'following' | 'follow_back' | 'friends';

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
  const [likedUsersByPostId, setLikedUsersByPostId] = useState<Record<string, any[]>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [loadingCommentsByPostId, setLoadingCommentsByPostId] = useState<Record<string, boolean>>({});
  const [loadingLikesByPostId, setLoadingLikesByPostId] = useState<Record<string, boolean>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<string, boolean>>({});
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [activeProjects, setActiveProjects] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedByTarget, setIsFollowedByTarget] = useState(false);
  const [friendshipState, setFriendshipState] = useState<'none' | 'outgoing' | 'incoming' | 'friends'>('none');
  const [isFriendLoading, setIsFriendLoading] = useState(false);
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
        const [favoriteResponse, followResponse, followedByTargetResponse, friendshipResponse] = await Promise.all([
          DataService.isFavorited(user.id, targetId),
          DataService.isFollowing(user.id, targetId),
          DataService.isFollowing(targetId, user.id),
          DataService.getFriendshipState(user.id, targetId),
        ]);

        if (isMounted && !favoriteResponse.error) {
          setIsFavorited(favoriteResponse.isFavorited);
        }

        if (isMounted && !followResponse.error) {
          setIsFollowing(followResponse.isFollowing);
        }

        if (isMounted && !followedByTargetResponse.error) {
          setIsFollowedByTarget(followedByTargetResponse.isFollowing);
        }

        if (isMounted && !friendshipResponse.error) {
          setFriendshipState(friendshipResponse.state);
        }
      } else {
        setIsFavorited(false);
        setIsFollowing(false);
        setIsFollowedByTarget(false);
        setFriendshipState('none');
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
        setProfilePosts(postsResponse.data || []);
        const seed: Record<string, { likes: number; comments: number; shares: number; saves: number; liked: boolean; saved: boolean }> = {};
        (postsResponse.data || []).forEach((post: any) => {
          seed[post.id] = {
            likes: Math.max(0, Number(post.likes_count || 0)),
            comments: Math.max(0, Number(post.comments_count || 0)),
            shares: Math.max(0, Number(post.shares_count || 0)),
            saves: Math.max(0, Number(post.saves_count || 0)),
            liked: false,
            saved: false,
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
  const coverUrl = profile?.cover_url || freelancerProfile?.cover_image_url || freelancerProfile?.image_urls?.[0] || '';
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
  const focusedPost = useMemo(() => profilePosts.find((post: any) => String(post.id) === focusedPostId) || null, [profilePosts, focusedPostId]);

  const followRelationship: FollowRelationship = isFollowing
    ? (isFollowedByTarget ? 'friends' : 'following')
    : (isFollowedByTarget ? 'follow_back' : 'follow');

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

  const refreshFriendshipState = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    const response = await DataService.getFriendshipState(user.id, targetFreelancerUserId);
    if (!response.error) {
      setFriendshipState(response.state);
    }

    const followCountsResponse = await DataService.getFollowCounts(targetFreelancerUserId);
    if (!followCountsResponse.error) {
      setFollowCounts({
        followers: followCountsResponse.followerCount,
        following: followCountsResponse.followingCount,
      });
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    setError(null);
    setIsFriendLoading(true);

    const response = await DataService.sendFriendRequest(user.id, targetFreelancerUserId);

    if (response.error) {
      setError((response.error as any).message || 'Unable to send friend request.');
      setIsFriendLoading(false);
      return;
    }

    setFriendshipState('outgoing');
    setSuccessMessage('Friend request sent.');
    setIsFriendLoading(false);
  };

  const handleAcceptFriendRequest = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    setError(null);
    setIsFriendLoading(true);

    const response = await DataService.acceptFriendRequest(targetFreelancerUserId, user.id);

    if (response.error) {
      setError((response.error as any).message || 'Unable to accept friend request.');
      setIsFriendLoading(false);
      return;
    }

    await refreshFriendshipState();
    setSuccessMessage('Friend request accepted.');
    setIsFriendLoading(false);
  };

  const handleDenyFriendRequest = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    setError(null);
    setIsFriendLoading(true);

    const response = await DataService.denyFriendRequest(targetFreelancerUserId, user.id);

    if (response.error) {
      setError((response.error as any).message || 'Unable to decline friend request.');
      setIsFriendLoading(false);
      return;
    }

    await refreshFriendshipState();
    setSuccessMessage('Friend request declined.');
    setIsFriendLoading(false);
  };

  const handleUnfriend = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    setError(null);
    setIsFriendLoading(true);

    const response = await DataService.removeFriendship(user.id, targetFreelancerUserId);

    if (response.error) {
      setError((response.error as any).message || 'Unable to remove friendship.');
      setIsFriendLoading(false);
      return;
    }

    await refreshFriendshipState();
    setSuccessMessage('Friendship removed.');
    setIsFriendLoading(false);
  };

  const handleSubmitRequest = async (event: FormEvent) => {
    event.preventDefault();

    if (!user?.id || !targetFreelancerUserId) {
      setError('You must be signed in to send a booking request.');
      return;
    }

    if (user.role !== 'client' && user.role !== 'freelancer') {
      setError('Only client or freelancer accounts can submit booking requests.');
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

  const openPostFocus = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    setFocusedPostId(stateKey);

    if (commentsByPostId[stateKey]) {
      return;
    }

    setLoadingCommentsByPostId((current) => ({ ...current, [stateKey]: true }));
    const response = await DataService.getClientPostComments(apiPostId, 100);
    if (response.error) {
      setError((response.error as any).message || 'Unable to load comments.');
      setCommentsByPostId((current) => ({ ...current, [stateKey]: [] }));
    } else {
      setCommentsByPostId((current) => ({ ...current, [stateKey]: response.data || [] }));
    }
    setLoadingCommentsByPostId((current) => ({ ...current, [stateKey]: false }));

    const likesResponse = await DataService.getClientPostLikeUsers(apiPostId);
    if (!likesResponse.error) {
      setLikedUsersByPostId((current) => ({ ...current, [stateKey]: likesResponse.data || [] }));
    }
  };

  const loadFreelancerPostLikes = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    setLoadingLikesByPostId((current) => ({ ...current, [stateKey]: true }));
    const response = await DataService.getClientPostLikeUsers(apiPostId);
    if (response.error) {
      setError((response.error as any).message || 'Unable to load likes.');
      setLikedUsersByPostId((current) => ({ ...current, [stateKey]: [] }));
    } else {
      setLikedUsersByPostId((current) => ({ ...current, [stateKey]: response.data || [] }));
    }
    setLoadingLikesByPostId((current) => ({ ...current, [stateKey]: false }));
  };

  const closePostFocus = () => {
    setFocusedPostId(null);
  };

  const togglePostLike = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [stateKey]: {
          ...existing,
          liked: !existing.liked,
          likes: existing.liked ? Math.max(0, existing.likes - 1) : existing.likes + 1,
        },
      };
    });

    if (!user?.id) {
      return;
    }

    const engagement = postEngagement[stateKey] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
    const response = await DataService.toggleClientPostLike(user.id, apiPostId, engagement.liked);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update like status.');
      setPostEngagement((current) => {
        const existing = current[stateKey] || engagement;
        return {
          ...current,
          [stateKey]: {
            ...existing,
            liked: engagement.liked,
            likes: engagement.liked ? existing.likes + 1 : Math.max(0, existing.likes - 1),
          },
        };
      });
      return;
    }

    const likesResponse = await DataService.getClientPostLikeUsers(apiPostId);
    if (!likesResponse.error) {
      setLikedUsersByPostId((current) => ({ ...current, [stateKey]: likesResponse.data || [] }));
    }

    dispatchClientPostUpdated(apiPostId);
  };

  const togglePostSave = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [stateKey]: {
          ...existing,
          saved: !existing.saved,
          saves: existing.saved ? Math.max(0, existing.saves - 1) : existing.saves + 1,
        },
      };
    });

    if (!user?.id) {
      return;
    }

    const engagement = postEngagement[stateKey] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
    const response = await DataService.toggleClientPostSave(user.id, apiPostId, engagement.saved);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update save status.');
      setPostEngagement((current) => {
        const existing = current[stateKey] || engagement;
        return {
          ...current,
          [stateKey]: {
            ...existing,
            saved: engagement.saved,
            saves: engagement.saved ? existing.saves + 1 : Math.max(0, existing.saves - 1),
          },
        };
      });
    }
  };

  const sharePost = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [stateKey]: {
          ...existing,
          shares: existing.shares + 1,
        },
      };
    });

    if (user?.id) {
      await DataService.recordClientPostShare(user.id, apiPostId);
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${id}`);
    } catch {
      // ignore clipboard failures
    }
  };

  const submitComment = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    const draft = (commentDraftByPostId[stateKey] || '').trim();
    if (!draft || !user?.id) {
      return;
    }

    setIsSubmittingCommentByPostId((current) => ({ ...current, [stateKey]: true }));
    const response = await DataService.addClientPostComment(user.id, apiPostId, draft);
    if (response.error) {
      setError((response.error as any).message || 'Unable to add comment.');
      setIsSubmittingCommentByPostId((current) => ({ ...current, [stateKey]: false }));
      return;
    }

    setCommentsByPostId((current) => ({
      ...current,
      [stateKey]: [...(current[stateKey] || []), response.data],
    }));
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
      return {
        ...current,
        [stateKey]: {
          ...existing,
          comments: existing.comments + 1,
        },
      };
    });
    setCommentDraftByPostId((current) => ({ ...current, [stateKey]: '' }));
    setIsSubmittingCommentByPostId((current) => ({ ...current, [stateKey]: false }));
    dispatchClientPostUpdated(apiPostId);
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

        <section className="mb-8 overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="relative h-44 md:h-64 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900">
            {coverUrl ? (
              <ImageWithFallback src={coverUrl} alt={`${displayName} background`} className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-white bg-gray-200 shadow-xl md:h-32 md:w-32">
                    <ImageWithFallback src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  </div>
                  <div className="text-white">
                    <h1 className="text-2xl font-bold md:text-3xl">{displayName}</h1>
                    <p className="mt-1 text-base text-white/90 md:text-lg">{title}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {user?.id !== targetFreelancerUserId && (
                    <button
                      onClick={handleFavoriteToggle}
                      className={`rounded-full p-3 transition-all ${isFavorited ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white/90 text-gray-700 hover:bg-white'}`}
                    >
                      <Heart className={`h-6 w-6 ${isFavorited ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {requestStatus === 'accepted' ? (
                    <button
                      onClick={onOpenChat}
                      className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:shadow-lg"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Open Chat
                    </button>
                  ) : (
                    user?.id !== targetFreelancerUserId && (
                      <button
                        onClick={() => setShowBookingForm(true)}
                        className="rounded-xl bg-gradient-to-r from-gray-900 to-black px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg"
                      >
                        Request Booking
                      </button>
                    )
                  )}

                  {user?.id !== targetFreelancerUserId && (
                    <div className="flex flex-wrap gap-2">
                      {friendshipState === 'incoming' ? (
                        <>
                          <button
                            onClick={() => void handleAcceptFriendRequest()}
                            disabled={isFriendLoading}
                            className="rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60"
                          >
                            {isFriendLoading ? 'Updating...' : 'Confirm Request'}
                          </button>
                          <button
                            onClick={() => void handleDenyFriendRequest()}
                            disabled={isFriendLoading}
                            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:bg-gray-50 disabled:opacity-60"
                          >
                            {isFriendLoading ? 'Updating...' : 'Deny'}
                          </button>
                        </>
                      ) : friendshipState === 'friends' ? (
                        <button
                          onClick={() => void handleUnfriend()}
                          disabled={isFriendLoading}
                          className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:bg-gray-50 disabled:opacity-60"
                        >
                          {isFriendLoading ? 'Updating...' : 'Unfriend'}
                        </button>
                      ) : friendshipState === 'outgoing' ? (
                        <button
                          disabled
                          className="cursor-default rounded-xl bg-gray-200 px-6 py-3 text-base font-semibold text-gray-900"
                        >
                          Request Sent
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleSendFriendRequest()}
                          disabled={isFriendLoading}
                          className="rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60"
                        >
                          {isFriendLoading ? 'Updating...' : 'Send Friend Request'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mt-4 flex flex-col gap-2 text-sm text-gray-700 md:text-base">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                    <span>{location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                    <span>{availability}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
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
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-y border-gray-200 py-5 md:grid-cols-6">
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{totalReviews} reviews</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{portfolioCount}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">portfolio items</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Briefcase className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{freelancerProfile?.experience_years || 0} yrs</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">experience</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Sparkles className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{freelancerProfile?.hourly_rate ? `฿${freelancerProfile.hourly_rate}/hr` : 'Custom'}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">starting rate</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{activeProjects}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">active projects</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{completedProjects}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">completed projects</p>
              </div>
            </div>

            <p className="mt-6 text-gray-700 leading-7">{bio}</p>
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
                const engagement = postEngagement[post.id] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
                return (
                  <article key={post.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <button type="button" onClick={() => void openPostFocus(post.id)} className="aspect-[4/3] w-full bg-white text-left">
                      <ImageWithFallback
                        src={post.image_url || avatarUrl}
                        alt={post.caption || 'Post image'}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <div className="p-4">
                      <p className="text-sm text-gray-700">{post.caption || 'No caption'}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
                        <button
                          type="button"
                          onClick={() => void togglePostLike(post.id)}
                          className="inline-flex items-center gap-1"
                        >
                          <Heart className={`h-4 w-4 ${engagement.liked ? 'fill-red-500 text-red-500' : ''}`} />
                          {engagement.likes}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openPostFocus(post.id)}
                          className="inline-flex items-center gap-1"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {engagement.comments}
                        </button>
                        <button type="button" onClick={() => void sharePost(post.id)} className="inline-flex items-center gap-1">
                          <Share2 className="h-4 w-4" />
                          Share
                        </button>
                        <button type="button" onClick={() => void togglePostSave(post.id)} className="inline-flex items-center gap-1">
                          <Bookmark className={`h-4 w-4 ${engagement.saved ? 'fill-gray-900 text-gray-900' : ''}`} />
                          Save
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={closePostFocus}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-gray-700 shadow"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="max-h-[60vh] overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={focusedPost.image_url || avatarUrl}
                alt={focusedPost.caption || 'Post image'}
                className="max-h-[60vh] w-full object-contain"
              />
            </div>

            <div className="max-h-[35vh] overflow-y-auto p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-gray-200">
                    <ImageWithFallback src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-500">{title}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{focusedPost.created_at ? new Date(focusedPost.created_at).toLocaleString() : ''}</span>
              </div>

              <p className="whitespace-pre-line text-sm text-gray-800">{focusedPost.caption || 'No caption'}</p>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-y border-gray-200 py-3">
                <button onClick={() => void togglePostLike(focusedPost.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Heart className={`h-5 w-5 ${postEngagement[focusedPost.id]?.liked ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                  {postEngagement[focusedPost.id]?.likes || 0}
                </button>
                <button onClick={() => void loadFreelancerPostLikes(focusedPost.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  {loadingLikesByPostId[focusedPost.id] ? 'Loading...' : 'View likes'}
                </button>
                <button onClick={() => void openPostFocus(focusedPost.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <MessageCircle className="h-5 w-5 text-gray-700" />
                  {postEngagement[focusedPost.id]?.comments || 0}
                </button>
                <button onClick={() => void sharePost(focusedPost.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Share2 className="h-5 w-5 text-gray-700" />
                  Share
                </button>
                <button onClick={() => void togglePostSave(focusedPost.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Bookmark className={`h-5 w-5 ${postEngagement[focusedPost.id]?.saved ? 'fill-gray-900 text-gray-900' : 'text-gray-700'}`} />
                  Save
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {likedUsersByPostId[focusedPost.id] && likedUsersByPostId[focusedPost.id].length > 0 ? (
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="mb-2 font-semibold text-gray-900">Liked by</p>
                    <div className="flex flex-wrap gap-3">
                      {likedUsersByPostId[focusedPost.id].map((likedUser: any) => (
                        <div key={likedUser.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                          <ImageWithFallback
                            src={likedUser.avatar_url || fallbackProfileImage}
                            alt={likedUser.full_name || likedUser.email || 'User'}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{likedUser.full_name || likedUser.email || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">@{String(likedUser.email || '').split('@')[0]}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="text-sm font-semibold text-gray-900">Comments</p>
                {loadingCommentsByPostId[focusedPost.id] ? (
                  <p className="text-sm text-gray-500">Loading comments...</p>
                ) : (commentsByPostId[focusedPost.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                ) : (
                  (commentsByPostId[focusedPost.id] || []).map((comment: any) => (
                    <div key={comment.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                      <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-semibold text-gray-900">{comment.user?.full_name || 'User'}</span>
                        <span>•</span>
                        <span>{new Date(comment.created_at).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={commentDraftByPostId[focusedPost.id] || ''}
                  onChange={(event) =>
                    setCommentDraftByPostId((current) => ({
                      ...current,
                      [focusedPost.id]: event.target.value,
                    }))
                  }
                  placeholder="Write a comment..."
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                />
                <button
                  type="button"
                  onClick={() => void submitComment(focusedPost.id)}
                  disabled={!!isSubmittingCommentByPostId[focusedPost.id]}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmittingCommentByPostId[focusedPost.id] ? 'Sending...' : 'Comment'}
                </button>
              </div>
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
