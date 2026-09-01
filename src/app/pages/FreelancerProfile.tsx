import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Ban, Bookmark, Briefcase, Edit, Flag, Heart, Info, Mail, MapPin, MessageCircle, Share2, Sparkles, Star, Trash2, Users, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { SocialLinksRow } from '../../components/common/SocialLinksRow';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { DataService } from '../../lib/dataService';
import { dispatchClientPostUpdated } from '../../lib/clientPostSync';
import { computeTrustLevel } from '../../lib/trustLevel';
import { TrustBadge } from '../../components/common/TrustBadge';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { shouldDisplayPronouns } from '../../lib/pronouns';
import FollowersModal from '../components/FollowersModal';
import {
  appendBudgetMeta,
  inferCurrencyFromLocation,
  SUPPORTED_CURRENCIES,
  type BudgetMeta,
} from '../../lib/requestBudget';
import { appendScheduleMeta, generateTimeSlots, formatTimeLabel } from '../../lib/requestSchedule';
import { appendLocationMeta } from '../../lib/requestLocation';
import { isDateBlocked, isFreelancerFreeAt, isTimeSlotTaken } from '../../lib/availability';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import logoImage from '../../imports/logo.png';

interface FreelancerProfileProps {
  onBack: () => void;
  requestStatus?: 'accepted' | 'pending' | 'rejected' | null;
  onOpenChat?: () => void;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;
const OTHER_PURPOSE_VALUE = '__other__';
const OTHER_LOCATION_VALUE = '__other__';

export function FreelancerProfile({ onBack, requestStatus = null, onOpenChat }: FreelancerProfileProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const [profile, setProfile] = useState<any | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [freelancerBookings, setFreelancerBookings] = useState<any[]>([]);
  const [freelancerBlockedDates, setFreelancerBlockedDates] = useState<any[]>([]);
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
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isBlockedProfile, setIsBlockedProfile] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<'harassment' | 'scam_fraud' | 'fake_information' | 'inappropriate_content' | 'unprofessional_behavior' | 'other'>('harassment');
  const [reportDescription, setReportDescription] = useState('');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState<null | { type: 'followers' | 'following' }>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showBidTip, setShowBidTip] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
    customPurpose: '',
    location: '',
    customLocation: '',
    notes: '',
    offerAmount: '',
    currency: normalizeCurrencyCode(preferredCurrency, 'THB'),
    scheduleDate: '',
    scheduleTime: '',
  });

  const targetFreelancerUserId = profile?.id || freelancerProfile?.user_id || id || null;

  useEffect(() => {
    let isMounted = true;

    async function loadClientCurrency() {
      if (!user?.id) return;

      const response = await DataService.getUser(user.id);
      if (!isMounted) return;

      const profileCurrency = normalizeCurrencyCode((response.data as any)?.preferred_currency, '');
      const inferredCurrency = inferCurrencyFromLocation(response.data?.location || null);
      setFormData((current) => ({ ...current, currency: profileCurrency || inferredCurrency }));
    }

    loadClientCurrency();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      currency: normalizeCurrencyCode(current.currency || preferredCurrency, 'THB'),
    }));
  }, [preferredCurrency]);

  const freelancerRateCurrency = normalizeCurrencyCode((profile as any)?.preferred_currency || (freelancerProfile as any)?.preferred_currency || 'THB', 'THB');
  const viewerCurrency = normalizeCurrencyCode(preferredCurrency, 'THB');
  const convertedHourlyRate = freelancerProfile?.hourly_rate
    ? convertAmount(Number(freelancerProfile.hourly_rate), freelancerRateCurrency, viewerCurrency)
    : null;
  const minimumOffer = freelancerProfile?.hourly_rate
    ? convertAmount(Number(freelancerProfile.hourly_rate), freelancerRateCurrency, formData.currency)
    : 0;

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
        const profileIdResponse = await DataService.getFreelancerById(id);
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
        setIsLoading(false);
        return;
      }

      const targetIdForBlockCheck = userResponse.data?.id || freelancerResponse.data?.user_id || id;
      if (user?.id && targetIdForBlockCheck && user.id !== targetIdForBlockCheck) {
        const blockCheck = await DataService.isBlockedEither(user.id, targetIdForBlockCheck);
        if (!isMounted) {
          return;
        }
        if (blockCheck.isBlocked) {
          setIsBlockedProfile(true);
          setProfile(null);
          setFreelancerProfile(null);
          setIsLoading(false);
          return;
        }
      }
      setIsBlockedProfile(false);

      setProfile(userResponse.data);
      setFreelancerProfile(freelancerResponse.data || null);

      if (freelancerResponse.data?.id) {
        const [servicesResponse, blockedDatesResponse] = await Promise.all([
          DataService.getFreelancerServices(freelancerResponse.data.id),
          DataService.getFreelancerBlockedDates(freelancerResponse.data.id),
        ]);
        if (isMounted) {
          setServices(servicesResponse.data || []);
          setFreelancerBlockedDates(blockedDatesResponse.data || []);
        }
      }

      const reviewsTargetId = userResponse.data?.id || freelancerResponse.data?.user_id || id;
      if (reviewsTargetId) {
        const [reviewsResponse, bookingsResponse] = await Promise.all([
          DataService.getFreelancerReviews(reviewsTargetId),
          DataService.getFreelancerBookings(reviewsTargetId),
        ]);
        if (isMounted) {
          setReviews(reviewsResponse.data || []);
          setFreelancerBookings(bookingsResponse.data || []);
        }
      }

      const targetId = userResponse.data?.id || freelancerResponse.data?.user_id || id;

      if (user?.id && user.id !== targetId) {
        const [favoriteResponse, followResponse, followedByTargetResponse] = await Promise.all([
          DataService.isFavorited(user.id, targetId),
          DataService.isFollowing(user.id, targetId),
          DataService.isFollowing(targetId, user.id),
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
      } else {
        setIsFavorited(false);
        setIsFollowing(false);
        setIsFollowedByTarget(false);
      }

      const followCountsResponse = await DataService.getFollowCounts(targetId);
      if (isMounted && !followCountsResponse.error) {
        setFollowCounts({
          followers: followCountsResponse.followerCount,
          following: followCountsResponse.followingCount,
        });
      }

      if (userResponse.data.role === 'freelancer' && freelancerResponse.data) {
        const bookingsResponse = await DataService.getFreelancerBookings(targetId);
        if (isMounted && !bookingsResponse.error) {
          const bookingRows = bookingsResponse.data || [];
          setActiveProjects(
            bookingRows.filter((booking: any) => ['pending', 'confirmed', 'in_progress'].includes(booking.status)).length
          );
          setCompletedProjects(bookingRows.filter((booking: any) => booking.status === 'completed').length);
        }
      } else if (isMounted) {
        setActiveProjects(0);
        setCompletedProjects(0);
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
  const isBookableFreelancer = profile?.role === 'freelancer' && Boolean(freelancerProfile?.id);
  // Bio is canonical from freelancer_profiles.description for freelancers,
  // users.bio for everyone else — this must match the priority Edit Profile
  // saves to, or the two pages would show different bios again.
  const bio = (isBookableFreelancer ? freelancerProfile?.description : profile?.bio) || 'No bio added yet.';
  const isOwner = Boolean(user?.id && targetFreelancerUserId && user.id === targetFreelancerUserId);
  const title = isBookableFreelancer ? (freelancerProfile?.title || 'Freelancer') : 'Client';
  const rating = Number(profile?.rating || 0);
  const totalReviews = Number(profile?.total_reviews || 0);
  const availability = freelancerProfile?.is_available === false ? 'Currently unavailable' : 'Available for new bookings';
  const skills = freelancerProfile?.skills || [];
  const styles = freelancerProfile?.styles || [];
  const studioName: string = freelancerProfile?.studio_name || '';
  const studioLocations: Array<{ formattedAddress: string }> = freelancerProfile?.studio_locations || [];
  const preferredLocations: Array<{ formattedAddress: string }> = freelancerProfile?.locations || [];
  const studioLocationOptions = studioLocations.map((loc) => (studioName ? `${studioName} — ${loc.formattedAddress}` : loc.formattedAddress));
  const bookingLocations = [...studioLocationOptions, ...preferredLocations.map((loc) => loc.formattedAddress)];
  const socialLinks = freelancerProfile?.social_links || [];
  const pronouns = profile?.pronouns;
  const todayDateString = new Date().toISOString().slice(0, 10);
  const allTimeSlots = useMemo(
    () => generateTimeSlots(freelancerProfile?.working_hours_start, freelancerProfile?.working_hours_end),
    [freelancerProfile?.working_hours_start, freelancerProfile?.working_hours_end]
  );
  const isSelectedDateBlocked = formData.scheduleDate ? isDateBlocked(freelancerBlockedDates, formData.scheduleDate) : false;
  const availableTimeSlots = useMemo(
    () =>
      allTimeSlots.map((slot) => ({
        value: slot,
        taken: formData.scheduleDate ? isTimeSlotTaken(freelancerBookings, formData.scheduleDate, slot) : false,
      })),
    [allTimeSlots, freelancerBookings, formData.scheduleDate]
  );
  const trust = useMemo(
    () =>
      computeTrustLevel({
        rating,
        totalReviews,
        portfolioCount: Number(freelancerProfile?.portfolio_count || socialLinks.length || 0),
        phoneVerified: Boolean(freelancerProfile?.phone_verified),
        identityStatus: freelancerProfile?.identity_status || 'not_submitted',
        profileCompletenessFields: {
          hasBio: Boolean(freelancerProfile?.description),
          hasAvatar: Boolean(profile?.avatar_url),
          hasServices: Boolean(freelancerProfile?.title),
          hasSkills: skills.length > 0,
          hasPricing: Boolean(freelancerProfile?.pricing_type || freelancerProfile?.hourly_rate),
          hasAvailability: (freelancerProfile?.working_days || []).length > 0,
        },
      }),
    [rating, totalReviews, freelancerProfile, socialLinks, profile, skills]
  );

  const focusedPost = useMemo(() => profilePosts.find((post: any) => String(post.id) === focusedPostId) || null, [profilePosts, focusedPostId]);

  const showMessageButton = Boolean(user?.id && targetFreelancerUserId && (isFollowing || isFollowedByTarget));

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
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) return;

    setError(null);
    setIsFollowLoading(true);

    if (isFollowing) {
      const resp = await DataService.unfollowUser(user.id, targetFreelancerUserId);
      if (resp.error) {
        setError((resp.error as any).message || 'Unable to unfollow.');
        setIsFollowLoading(false);
        return;
      }
      setIsFollowing(false);
      setFollowCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      setIsFollowLoading(false);
      return;
    }

    const resp = await DataService.followUser(user.id, targetFreelancerUserId);
    if (resp.error) {
      setError((resp.error as any).message || 'Unable to follow.');
      setIsFollowLoading(false);
      return;
    }

    setIsFollowing(true);
    setFollowCounts((c) => ({ ...c, followers: c.followers + 1 }));
    setIsFollowLoading(false);
  };

  const handleBlockUser = async () => {
    if (!user?.id || !targetFreelancerUserId || user.id === targetFreelancerUserId) {
      return;
    }

    if (!window.confirm(`Block ${displayName}? You won't be able to message or send requests to each other, and won't see each other's content.`)) {
      return;
    }

    setError(null);
    setIsBlockingUser(true);
    const response = await DataService.blockUser(user.id, targetFreelancerUserId);
    if (response.error) {
      setError((response.error as any).message || 'Unable to block this user.');
      setIsBlockingUser(false);
      return;
    }

    setIsBlockedProfile(true);
    setIsBlockingUser(false);
  };

  const handleSubmitReport = async () => {
    if (!user?.id || !targetFreelancerUserId || !reportDescription.trim()) {
      setError('Describe what happened before submitting.');
      return;
    }

    setIsSubmittingReport(true);
    setError(null);

    const photoPaths: string[] = [];
    for (const file of reportFiles) {
      const uploadResponse = await DataService.uploadReportEvidencePhoto(user.id, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setError('Unable to upload one of the evidence photos.');
        setIsSubmittingReport(false);
        return;
      }
      photoPaths.push(uploadResponse.path);
    }

    const response = await DataService.submitUserReport({
      reporterId: user.id,
      reportedUserId: targetFreelancerUserId,
      reason: reportReason,
      description: reportDescription.trim(),
      evidencePhotoPaths: photoPaths,
    });

    setIsSubmittingReport(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit report.');
      return;
    }

    setReportSubmitted(true);
    setReportDescription('');
    setReportFiles([]);
  };

  const handleSubmitRequest = async (event: FormEvent) => {
    event.preventDefault();

    if (!isBookableFreelancer) {
      setError('Booking requests can only be sent to freelancer profiles.');
      setShowBookingForm(false);
      return;
    }

    if (!user?.id || !targetFreelancerUserId) {
      setError('You must be signed in to send a booking request.');
      return;
    }

    if (user.role !== 'client' && user.role !== 'freelancer') {
      setError('Only client or freelancer accounts can submit booking requests.');
      return;
    }

    const resolvedPurpose = formData.projectName === OTHER_PURPOSE_VALUE
      ? formData.customPurpose.trim()
      : formData.projectName;

    if (!resolvedPurpose) {
      setError('Enter or select a purpose for this booking.');
      return;
    }

    const resolvedLocation = formData.location === OTHER_LOCATION_VALUE
      ? formData.customLocation.trim()
      : formData.location;

    if (!resolvedLocation) {
      setError('Enter or select a location for this booking.');
      return;
    }

    const offerAmount = Number(formData.offerAmount);

    if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
      setError('Enter your offer amount.');
      return;
    }

    if (offerAmount < minimumOffer) {
      setError(`Your offer must be at least ${formatCurrencyAmount(minimumOffer, formData.currency)}.`);
      return;
    }

    if (!formData.scheduleDate || !formData.scheduleTime) {
      setError('Choose a date and time for this booking.');
      return;
    }

    if (!isFreelancerFreeAt(freelancerBookings, freelancerBlockedDates, formData.scheduleDate, formData.scheduleTime)) {
      setError('This freelancer is already occupied at that date and time. Please choose a different slot.');
      return;
    }

    const budgetMeta: BudgetMeta = {
      currency: formData.currency,
      min: minimumOffer,
      max: offerAmount,
    };

    const requestMessage = appendLocationMeta(
      appendScheduleMeta(
        appendBudgetMeta(formData.notes, budgetMeta),
        { date: formData.scheduleDate, time: formData.scheduleTime }
      ),
      resolvedLocation
    );

    setIsSubmittingRequest(true);
    setError(null);

    const { error: requestError } = await DataService.createBookingRequests({
      clientId: user.id,
      recipientIds: [targetFreelancerUserId],
      projectName: resolvedPurpose,
      description: requestMessage,
      budget: offerAmount,
    });

    if (requestError) {
      setError((requestError as any).message || 'Unable to send booking request.');
      setIsSubmittingRequest(false);
      return;
    }

    setSuccessMessage('Booking request sent successfully.');
    setShowBookingForm(false);
    // Land on the plain requests list, not the edit box — the client just
    // submitted this, they don't need to immediately edit it.
    navigate('/requests');
    setFormData((current) => ({
      ...current,
      projectName: '',
      customPurpose: '',
      location: '',
      customLocation: '',
      notes: '',
      offerAmount: '',
      scheduleDate: '',
      scheduleTime: '',
    }));
    setIsSubmittingRequest(false);
  };

  // Carries over whatever the client already filled in here (this
  // freelancer, plus any purpose/location/notes/schedule/budget entered so
  // far) into the standalone Group Request page, rather than making them
  // start over — nothing here is validated/required, Group Request handles
  // its own validation on submit.
  const handleAddMoreFreelancer = () => {
    const resolvedPurpose = formData.projectName === OTHER_PURPOSE_VALUE ? formData.customPurpose.trim() : formData.projectName;
    const resolvedLocation = formData.location === OTHER_LOCATION_VALUE ? formData.customLocation.trim() : formData.location;

    navigate('/group-request', {
      state: {
        prefillFreelancer: targetFreelancerUserId
          ? {
              userId: targetFreelancerUserId,
              fullName: displayName,
              title,
              skills,
              hourlyRate: freelancerProfile?.hourly_rate ? Number(freelancerProfile.hourly_rate) : null,
              rateCurrency: freelancerRateCurrency,
              avatarUrl: profile?.avatar_url || null,
              gender: profile?.gender || null,
            }
          : undefined,
        prefillPurpose: resolvedPurpose || undefined,
        prefillBudget: formData.offerAmount || undefined,
        prefillLocation: resolvedLocation || undefined,
        prefillNotes: formData.notes || undefined,
        prefillScheduleDate: formData.scheduleDate || undefined,
        prefillScheduleTime: formData.scheduleTime || undefined,
        prefillCurrency: formData.currency || undefined,
      },
    });
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

  const deletePost = async (postId: string) => {
    if (!user?.id) return;

    const targetPost = profilePosts.find((post) => String(post.id) === postId);
    if (!targetPost || String(targetPost.client_id) !== user.id) return;

    const confirmed = window.confirm('Delete this post? This action cannot be undone.');
    if (!confirmed) return;

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

  if (isBlockedProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 p-6">
        <div className="mx-auto max-w-[960px] rounded-3xl bg-white p-6 shadow-xl border border-gray-200">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <p className="text-sm text-gray-700">This profile isn't available.</p>
        </div>
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
              <img src={logoImage} alt="CreativeHUB" className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover" />
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
                  <Avatar
                    src={avatarUrl}
                    alt={displayName}
                    sizeClassName="h-24 w-24 ring-4 ring-white bg-gray-200 shadow-xl md:h-32 md:w-32 rounded-full"
                    badgeSize="md"
                  />
                  <div className="text-white">
                    <h1 className="text-2xl font-bold md:text-3xl">
                      {displayName}
                      {shouldDisplayPronouns(pronouns) && <span className="ml-2 text-base font-normal text-white/70 md:text-lg">· {pronouns}</span>}
                    </h1>
                    <p className="mt-1 text-base text-white/90 md:text-lg">{title}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {isOwner ? (
                    <button
                      onClick={() => navigate('/edit-profile')}
                      className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:shadow-lg"
                    >
                      <Edit className="h-5 w-5" />
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleFavoriteToggle}
                        className={`rounded-full p-3 transition-all ${isFavorited ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white/90 text-gray-700 hover:bg-white'}`}
                      >
                        <Heart className={`h-6 w-6 ${isFavorited ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        onClick={() => void handleBlockUser()}
                        disabled={isBlockingUser}
                        className="rounded-full bg-white/90 p-3 text-gray-700 transition-all hover:bg-white disabled:opacity-60"
                        title="Block this user"
                      >
                        <Ban className="h-6 w-6" />
                      </button>

                      <button
                        onClick={() => {
                          setReportSubmitted(false);
                          setShowReportModal(true);
                        }}
                        className="rounded-full bg-white/90 p-3 text-gray-700 transition-all hover:bg-white"
                        title="Report this user"
                      >
                        <Flag className="h-6 w-6" />
                      </button>

                      {showMessageButton && (
                        <button
                          onClick={onOpenChat}
                          className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:shadow-lg"
                        >
                          <MessageCircle className="h-5 w-5" />
                          Message
                        </button>
                      )}

                      {isBookableFreelancer && (
                        <button
                          onClick={() => {
                            // Pre-fill with the minimum so the field never
                            // starts empty behind a placeholder that reads
                            // like a real value ("Minimum THB 1,510") -
                            // that misled people into submitting with
                            // nothing typed, which always failed validation.
                            setFormData((current) => ({
                              ...current,
                              offerAmount: current.offerAmount || (minimumOffer > 0 ? String(minimumOffer) : ''),
                            }));
                            setShowBookingForm(true);
                          }}
                          className="rounded-xl bg-gradient-to-r from-gray-900 to-black px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg"
                        >
                          Request Booking
                        </button>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleFollowToggle()}
                          disabled={isFollowLoading}
                          className={
                            isFollowing
                              ? 'rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:bg-gray-50 disabled:opacity-60'
                              : 'rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60'
                          }
                        >
                          {isFollowLoading
                            ? 'Updating...'
                            : isFollowing
                            ? 'Following'
                            : isFollowedByTarget
                            ? 'Follow back'
                            : 'Follow'
                          }
                        </button>
                      </div>
                    </>
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
                  {isBookableFreelancer && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                      <span>{availability}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-900 md:h-5 md:w-5" />
                    <span>{profile?.email || 'Email unavailable'}</span>
                  </div>
                  {isBookableFreelancer && (
                    <div>
                      <TrustBadge trust={trust} />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <button onClick={() => setShowFollowersModal({ type: 'followers' })} className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{followCounts.followers}</span>
                    <span>Followers</span>
                  </button>
                  <button onClick={() => setShowFollowersModal({ type: 'following' })} className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{followCounts.following}</span>
                    <span>Following</span>
                  </button>
                </div>
              </div>
            </div>

            {isBookableFreelancer && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-y border-gray-200 py-5 md:grid-cols-5">
              <div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 md:h-5 md:w-5" />
                  <span className="font-semibold text-gray-900">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{totalReviews} reviews</p>
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
                  <span className="font-semibold text-gray-900">{convertedHourlyRate !== null ? `${formatCurrencyAmount(convertedHourlyRate, viewerCurrency)}/hr` : 'Custom'}</span>
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
            )}

            <p className="mt-6 text-gray-700 leading-7">{bio}</p>
          </div>
        </section>

        {isBookableFreelancer && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Social Links</h2>
            {socialLinks.length === 0 ? (
              <p className="mt-4 text-gray-600">No social links added yet.</p>
            ) : (
              <SocialLinksRow links={socialLinks} className="mt-4 flex flex-wrap gap-3" />
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Skills</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {skills.length > 0 ? skills.map((skill: string) => (
                  <span key={skill} className="rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                    {skill}
                  </span>
                )) : <p className="text-sm text-gray-600">No skills listed yet.</p>}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Styles</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {styles.length > 0 ? styles.map((style: string) => (
                  <span key={style} className="rounded-full bg-gray-900 px-3 py-2 text-sm font-semibold text-white">
                    {style}
                  </span>
                )) : <p className="text-sm text-gray-600">No styles listed yet.</p>}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Working Details</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p><span className="font-semibold text-gray-900">Availability:</span> {availability}</p>
                <p><span className="font-semibold text-gray-900">Hourly rate:</span> {convertedHourlyRate !== null ? formatCurrencyAmount(convertedHourlyRate, viewerCurrency) : 'Discuss per project'}</p>
                <p><span className="font-semibold text-gray-900">Experience:</span> {freelancerProfile?.experience_years || 0} years</p>
                {studioName && (
                  <p>
                    <span className="font-semibold text-gray-900">Studio:</span> {studioName}
                    {studioLocations.length > 0 ? ` — ${studioLocations.map((loc) => loc.formattedAddress).join(', ')}` : ''}
                  </p>
                )}
                {bookingLocations.length > 0 && (
                  <p><span className="font-semibold text-gray-900">Shoot locations:</span> {bookingLocations.join(', ')}</p>
                )}
              </div>
            </div>
          </aside>
        </section>
        )}

        {isBookableFreelancer && services.length > 0 && (
          <section className="mt-8 rounded-3xl bg-white p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Services</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {services.map((service) => (
                <div key={service.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900">{service.name}</h3>
                    <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                      {service.pricing_type === 'custom_quote'
                        ? 'Custom quote'
                        : service.starting_price != null
                        ? `${service.pricing_type === 'fixed' ? '' : 'From '}${formatCurrencyAmount(convertAmount(Number(service.starting_price), 'THB', viewerCurrency), viewerCurrency)}`
                        : 'Price on request'}
                    </span>
                  </div>
                  {service.description && <p className="mt-2 text-sm text-gray-700">{service.description}</p>}
                  {service.duration && <p className="mt-2 text-xs text-gray-500"><span className="font-semibold text-gray-700">Duration:</span> {service.duration}</p>}
                  {service.included && <p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-700">Included:</span> {service.included}</p>}
                  {Array.isArray(service.extras) && service.extras.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {service.extras.map((extra: any, index: number) => (
                        <span key={index} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          {extra.label} +{formatCurrencyAmount(convertAmount(Number(extra.price || 0), 'THB', viewerCurrency), viewerCurrency)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {isBookableFreelancer && (
          <section className="mt-8">
            <AvailabilityCalendar bookings={freelancerBookings} blockedDates={freelancerBlockedDates} />
          </section>
        )}

        {isBookableFreelancer && (freelancerProfile?.requirements || (freelancerProfile?.limitation_days || []).length > 0 || freelancerProfile?.limitation_note) && (
          <section className="mt-8 rounded-3xl bg-white p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Requirements & Limitations</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              {freelancerProfile?.requirements && <p>{freelancerProfile.requirements}</p>}
              {(freelancerProfile?.limitation_days || []).length > 0 && (
                <p>
                  <span className="font-semibold text-gray-900">Doesn't work on:</span> {(freelancerProfile.limitation_days as string[]).join(', ')}
                </p>
              )}
              {freelancerProfile?.limitation_note && <p>{freelancerProfile.limitation_note}</p>}
            </div>
          </section>
        )}

        {isBookableFreelancer && reviews.length > 0 && (
          <section className="mt-8 rounded-3xl bg-white p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Reviews</h2>
            <div className="mt-5 space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={review.reviewer?.avatar_url || avatarUrl}
                        alt={review.reviewer?.full_name || 'Client'}
                        gender={review.reviewer?.gender}
                        sizeClassName="w-9 h-9"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{review.reviewer?.full_name || 'Client'}</p>
                        <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {Number(review.rating).toFixed(1)}
                    </div>
                  </div>
                  {review.comment && <p className="mt-3 text-sm text-gray-700">{review.comment}</p>}
                  {review.reply && (
                    <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-gray-200">
                      <p className="text-xs font-semibold text-gray-900">Response from {profile?.full_name || 'the freelancer'}</p>
                      <p className="mt-1 text-sm text-gray-700">{review.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

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

      {showFollowersModal && targetFreelancerUserId && (
        <FollowersModal
          userId={String(targetFreelancerUserId)}
          type={showFollowersModal.type}
          onClose={() => setShowFollowersModal(null)}
        />
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {reportSubmitted ? (
              <>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Report submitted</h3>
                <p className="mb-4 text-sm text-gray-600">Thanks — our team will review this report.</p>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-black"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Report {displayName}</h3>
                  <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-900">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as any)}
                  className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="harassment">Harassment</option>
                  <option value="scam_fraud">Scam / Fraud</option>
                  <option value="fake_information">Fake information</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="unprofessional_behavior">Unprofessional behavior</option>
                  <option value="other">Other</option>
                </select>
                <label className="mb-1 block text-xs font-semibold text-gray-600">What happened?</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <label className="mb-1 block text-xs font-semibold text-gray-600">Evidence (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setReportFiles(Array.from(e.target.files || []).slice(0, 6))}
                  className="mb-4 text-xs"
                />
                <button
                  onClick={() => void handleSubmitReport()}
                  disabled={isSubmittingReport}
                  className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
                  <Avatar src={avatarUrl} alt={displayName} gender={profile?.gender} sizeClassName="h-10 w-10 ring-2 ring-gray-200 rounded-full" />
                  <div>
                    <p className="font-semibold text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-500">{title}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{focusedPost.created_at ? new Date(focusedPost.created_at).toLocaleString() : ''}</span>
              </div>

              {isOwner && (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void deletePost(String(focusedPost.id))}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}

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
                          <Avatar
                            src={likedUser.avatar_url || fallbackProfileImage}
                            alt={likedUser.full_name || likedUser.email || 'User'}
                            gender={likedUser.gender}
                            sizeClassName="h-8 w-8 rounded-full"
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

      {showBookingForm && isBookableFreelancer && (
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
                  <Avatar src={avatarUrl} alt={displayName} gender={profile?.gender} sizeClassName="h-16 w-16 ring-2 ring-gray-200 rounded-full" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                    <p className="text-gray-600">{title}</p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="projectName" className="mb-2 block text-sm font-semibold text-gray-900">The Purpose</label>
                <select
                  id="projectName"
                  required
                  value={formData.projectName}
                  onChange={(event) => setFormData((current) => ({ ...current, projectName: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="" disabled>Select a purpose</option>
                  {skills.map((skill: string) => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                  <option value={OTHER_PURPOSE_VALUE}>Other (please specify)</option>
                </select>
                {formData.projectName === OTHER_PURPOSE_VALUE && (
                  <input
                    required
                    value={formData.customPurpose}
                    onChange={(event) => setFormData((current) => ({ ...current, customPurpose: event.target.value }))}
                    className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Type the purpose of this booking"
                  />
                )}
              </div>

              <div>
                <label htmlFor="location" className="mb-2 block text-sm font-semibold text-gray-900">Location</label>
                <select
                  id="location"
                  required
                  value={formData.location}
                  onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="" disabled>Select a location</option>
                  {bookingLocations.map((option: string) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={OTHER_LOCATION_VALUE}>Other (please specify)</option>
                </select>
                {formData.location === OTHER_LOCATION_VALUE && (
                  <input
                    required
                    value={formData.customLocation}
                    onChange={(event) => setFormData((current) => ({ ...current, customLocation: event.target.value }))}
                    className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Type the location for this booking"
                  />
                )}
              </div>

              <div>
                <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-gray-900">Notes <span className="font-normal text-gray-500">(optional)</span></label>
                <textarea
                  id="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Anything else the freelancer should know?"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Schedule</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <input
                      type="date"
                      required
                      min={todayDateString}
                      value={formData.scheduleDate}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduleDate: event.target.value, scheduleTime: '' }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <select
                      required
                      disabled={!formData.scheduleDate || isSelectedDateBlocked}
                      value={formData.scheduleTime}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduleTime: event.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {!formData.scheduleDate ? 'Choose a date first' : isSelectedDateBlocked ? 'Not available this day' : 'Select a time'}
                      </option>
                      {availableTimeSlots.map((slot) => (
                        <option key={slot.value} value={slot.value} disabled={slot.taken}>
                          {formatTimeLabel(slot.value)}{slot.taken ? ' — Already booked' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {isSelectedDateBlocked ? (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    This freelancer isn't available on this date. Please choose a different day.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-gray-600">
                    Available {formatTimeLabel(freelancerProfile?.working_hours_start || '09:00')} – {formatTimeLabel(freelancerProfile?.working_hours_end || '18:00')}, this freelancer's working hours. Times already booked are grayed out.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Budget</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <input
                      value={formData.currency}
                      onChange={(event) => setFormData((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                      list="booking-currency-suggestions"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Type any currency code"
                    />
                    <datalist id="booking-currency-suggestions">
                      {SUPPORTED_CURRENCIES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Minimum</span>
                    <span className="font-semibold text-gray-900">{formatCurrencyAmount(minimumOffer, formData.currency)}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="offerAmount" className="text-sm font-semibold text-gray-900">Offer Amount</label>
                    <span className="relative">
                      <button
                        type="button"
                        onClick={() => setShowBidTip((current) => !current)}
                        className="text-gray-400 transition-colors hover:text-gray-700"
                        aria-label="Bidding tip"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {showBidTip && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowBidTip(false)} />
                          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-white shadow-xl">
                            Suggestion: Bid Higher for High Acceptance
                          </div>
                        </>
                      )}
                    </span>
                  </div>
                  <input
                    id="offerAmount"
                    required
                    inputMode="decimal"
                    value={formData.offerAmount}
                    onChange={(event) => setFormData((current) => ({ ...current, offerAmount: event.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder={`Minimum ${formatCurrencyAmount(minimumOffer, formData.currency)}`}
                  />
                  {formData.offerAmount && Number(formData.offerAmount) < minimumOffer && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      Your offer must be at least {formatCurrencyAmount(minimumOffer, formData.currency)}.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddMoreFreelancer}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                <Users className="h-4 w-4" />
                Add More Freelancer
              </button>

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
