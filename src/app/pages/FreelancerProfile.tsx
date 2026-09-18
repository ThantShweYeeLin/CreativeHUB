import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Ban, Briefcase, Check, ChevronLeft, Edit, Flag, Heart, Info, Mail, MapPin, MessageCircle, Send, Share2, Sparkles, Star, Users, X } from 'lucide-react';
import type { PostShareMethod } from '../../lib/database.types';
import { PostShareMenu } from '../../components/PostShareMenu';
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
import { appendScheduleMeta, generateTimeSlots, formatTimeLabel, addMinutesToTime } from '../../lib/requestSchedule';
import { appendLocationMeta } from '../../lib/requestLocation';
import { isDateBlocked, isRangeAvailable, isTimeSlotTaken } from '../../lib/availability';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { PostCard } from '../../components/posts/PostCard';
import { PostDetailModal } from '../../components/posts/PostDetailModal';
import { LikesListModal } from '../../components/posts/LikesListModal';
import { PhotoViewerModal } from '../../components/posts/PhotoViewerModal';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { buildCommentThreads, buildMentionPrefill, getReplyKey, hasReplyContent } from '../../lib/commentThreads';
import logoImage from '../../imports/logo.png';

interface FreelancerProfileProps {
  onBack: () => void;
  requestStatus?: 'accepted' | 'pending' | 'rejected' | null;
  onOpenChat?: (targetUserId: string) => void;
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
  const [minorSkills, setMinorSkills] = useState<Array<{ name: string; experienceLevel: string | null }>>([]);
  const [majorSkillExperienceLevel, setMajorSkillExperienceLevel] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [freelancerBookings, setFreelancerBookings] = useState<any[]>([]);
  const [freelancerBlockedDates, setFreelancerBlockedDates] = useState<any[]>([]);
  const [profilePosts, setProfilePosts] = useState<any[]>([]);
  const [postEngagement, setPostEngagement] = useState<Record<string, { likes: number; comments: number; shares: number; saves: number; liked: boolean; saved: boolean }>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, any[]>>({});
  const [likedUsersByPostId, setLikedUsersByPostId] = useState<Record<string, any[]>>({});
  const [likesModalPostId, setLikesModalPostId] = useState<string | null>(null);
  const [loadingLikesByPostId, setLoadingLikesByPostId] = useState<Record<string, boolean>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [loadingCommentsByPostId, setLoadingCommentsByPostId] = useState<Record<string, boolean>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<string, boolean>>({});
  const [replyTargetByPostId, setReplyTargetByPostId] = useState<Record<string, string | null>>({});
  const [replyDraftByCommentKey, setReplyDraftByCommentKey] = useState<Record<string, string>>({});
  const [isSubmittingReplyByCommentKey, setIsSubmittingReplyByCommentKey] = useState<Record<string, boolean>>({});
  const [expandedReplyThreadsByKey, setExpandedReplyThreadsByKey] = useState<Record<string, boolean>>({});
  const [commentFocusToken, setCommentFocusToken] = useState(0);
  const [showPostContentOnOpen, setShowPostContentOnOpen] = useState(true);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; alt?: string } | null>(null);
  const [sharingPost, setSharingPost] = useState<any | null>(null);
  const [mutualUsers, setMutualUsers] = useState<Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>>([]);
  const [selectedShareRecipientIds, setSelectedShareRecipientIds] = useState<string[]>([]);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isLoadingMutualUsers, setIsLoadingMutualUsers] = useState(false);
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(null);
  const [copyLinkError, setCopyLinkError] = useState<string | null>(null);
  const savedScrollYRef = useRef<number | null>(null);
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
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
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
    scheduleEndTime: '',
  });

  const targetFreelancerUserId = profile?.id || freelancerProfile?.user_id || id || null;

  // The booking form overlays this page while it stays mounted underneath
  // (unlike a route, which fully unmounts) - without pinning the body,
  // `overflow: hidden` alone doesn't stop touch-scrolling on iOS Safari, so
  // a drag inside the modal can scroll the long page behind it instead of
  // the modal's own content, which is what made its bottom buttons feel
  // unreachable. Same lock SearchFilterPanel uses over Explore.
  useEffect(() => {
    if (!showBookingForm) {
      return;
    }

    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [showBookingForm]);

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
  // freelancer_profiles.hourly_rate actually stores whatever number the
  // freelancer entered as "Starting Price" during onboarding (StepPricing),
  // regardless of pricing_type — the column name predates pricing_type
  // existing. pricing_type is what tells us the correct unit/label to
  // display that same number with.
  const pricingUnitSuffix: Record<string, string> = { hourly: '/hr', daily: '/day', per_project: '/project', custom_quote: '' };
  const pricingRateLabel: Record<string, string> = {
    hourly: 'hourly rate',
    daily: 'daily rate',
    per_project: 'starting price',
    custom_quote: 'custom quote',
  };
  const pricingRateFieldLabel: Record<string, string> = {
    hourly: 'Hourly rate',
    daily: 'Daily rate',
    per_project: 'Starting price',
    custom_quote: 'Custom quote',
  };
  const pricingType = freelancerProfile?.pricing_type || 'hourly';
  const formattedRate = convertedHourlyRate !== null ? `${formatCurrencyAmount(convertedHourlyRate, viewerCurrency)}${pricingUnitSuffix[pricingType] ?? '/hr'}` : 'Custom';
  const rateCaption = pricingRateLabel[pricingType] ?? 'starting rate';
  const rateFieldLabel = pricingRateFieldLabel[pricingType] ?? 'Hourly rate';
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

      // Independent of each other — fetching them one at a time (as this
      // used to) doubles this first round-trip for no reason.
      let [userResponse, freelancerResponse] = await Promise.all([
        DataService.getUser(id),
        DataService.getFreelancerProfile(id),
      ]);

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
        if (userResponse.error) {
          // Log the raw error (e.g. a malformed id producing a Postgres
          // "invalid input syntax for type uuid" message) for debugging —
          // showing that verbatim to the user would be a confusing leak.
          console.error('Failed to load freelancer profile:', userResponse.error);
        }
        setError('This profile could not be found.');
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

      const targetId = userResponse.data?.id || freelancerResponse.data?.user_id || id;
      const shouldCheckFollowState = !!(user?.id && user.id !== targetId);

      // Every one of these ten only depends on data already resolved above
      // (freelancerResponse.data.id / targetId / user?.id) — never on each
      // other's results — so they run as one parallel batch instead of the
      // ~7 sequential round trips this used to be (including one call to
      // getFreelancerBookings fetching the exact same data a second time,
      // further down). That serialized waterfall was the actual cause of a
      // profile page taking noticeably longer to load than it should.
      const [
        blockedDatesResponse,
        skillsResponse,
        reviewsResponse,
        bookingsResponse,
        favoriteResponse,
        followResponse,
        followedByTargetResponse,
        followCountsResponse,
        postsResponse,
      ] = await Promise.all([
        freelancerResponse.data?.id ? DataService.getFreelancerBlockedDates(freelancerResponse.data.id) : Promise.resolve({ data: null, error: null }),
        freelancerResponse.data?.id ? DataService.getFreelancerSkills(freelancerResponse.data.id) : Promise.resolve({ data: null, error: null }),
        DataService.getFreelancerReviews(targetId),
        DataService.getFreelancerBookings(targetId),
        user?.id && user.id !== targetId ? DataService.isFavorited(user.id, targetId) : Promise.resolve({ isFavorited: false, error: null }),
        user?.id && user.id !== targetId ? DataService.isFollowing(user.id, targetId) : Promise.resolve({ isFollowing: false, error: null }),
        user?.id && user.id !== targetId ? DataService.isFollowing(targetId, user.id) : Promise.resolve({ isFollowing: false, error: null }),
        DataService.getFollowCounts(targetId),
        DataService.getClientPostsByClientId(targetId, 12, user?.id),
      ]);

      if (!isMounted) {
        return;
      }

      setFreelancerBlockedDates(blockedDatesResponse.data || []);
      setMinorSkills((skillsResponse.data?.minor || []).map((skill: any) => ({ name: skill.name, experienceLevel: skill.experienceLevel })));
      setMajorSkillExperienceLevel(skillsResponse.data?.major?.experienceLevel ?? null);

      setReviews(reviewsResponse.data || []);
      setFreelancerBookings(bookingsResponse.data || []);

      if (shouldCheckFollowState) {
        if (!favoriteResponse.error) {
          setIsFavorited(favoriteResponse.isFavorited);
        }
        if (!followResponse.error) {
          setIsFollowing(followResponse.isFollowing);
        }
        if (!followedByTargetResponse.error) {
          setIsFollowedByTarget(followedByTargetResponse.isFollowing);
        }
      } else {
        setIsFavorited(false);
        setIsFollowing(false);
        setIsFollowedByTarget(false);
      }

      if (!followCountsResponse.error) {
        setFollowCounts({
          followers: followCountsResponse.followerCount,
          following: followCountsResponse.followingCount,
        });
      }

      if (userResponse.data.role === 'freelancer' && freelancerResponse.data) {
        const bookingRows = bookingsResponse.data || [];
        setActiveProjects(
          bookingRows.filter((booking: any) => ['pending', 'confirmed', 'in_progress'].includes(booking.status)).length
        );
        setCompletedProjects(bookingRows.filter((booking: any) => booking.status === 'completed').length);
      } else {
        setActiveProjects(0);
        setCompletedProjects(0);
      }

      if (!postsResponse.error) {
        setProfilePosts(postsResponse.data || []);
        const seed: Record<string, { likes: number; comments: number; shares: number; saves: number; liked: boolean; saved: boolean }> = {};
        (postsResponse.data || []).forEach((post: any) => {
          seed[post.id] = {
            likes: Math.max(0, Number(post.likes_count || 0)),
            comments: Math.max(0, Number(post.comments_count || 0)),
            shares: Math.max(0, Number(post.shares_count || 0)),
            saves: Math.max(0, Number(post.saves_count || 0)),
            liked: !!post.liked_by_me,
            saved: !!post.saved_by_me,
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
  // Reviews of a client are only ever useful to another freelancer deciding
  // whether to work with them, and must never be visible to the client
  // themselves or to any other client — RLS (see supabase/review_visibility.sql)
  // already enforces this server-side; this just controls whether the
  // section renders at all for someone it wouldn't apply to.
  const canViewClientReviews = profile?.role === 'client' && user?.role === 'freelancer';
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
  const performerType: string[] = freelancerProfile?.performer_type || [];
  // "Band" is the one performer type worth calling out right beside the
  // name (a client deciding who to book needs to know upfront whether
  // they'd be booking a group act) - the rest (Solo Artist, Singer/
  // Vocalist, Acoustic Duo, Instrumentalist, DJ) read more like additional
  // specialties, so they show under Primary specialty instead, alongside
  // minorSkills there.
  const bandPerformerTypes = performerType.filter((type) => type === 'Band');
  const otherPerformerTypes = performerType.filter((type) => type !== 'Band');
  // Other full categories ("also skilled in" at onboarding) this freelancer
  // also provides services in, each with its own optional experience
  // level - shown alongside minorSkills/otherPerformerTypes under Primary
  // specialty, same reasoning as those two.
  const minorCategories: string[] = freelancerProfile?.minor_categories || [];
  const minorCategoryExperienceLevels: Record<string, string> = freelancerProfile?.minor_category_experience_levels || {};
  const studioName: string = freelancerProfile?.studio_name || '';
  const studioLocations: Array<{ formattedAddress: string }> = freelancerProfile?.studio_locations || [];
  const preferredLocations: Array<{ formattedAddress: string }> = freelancerProfile?.locations || [];
  const studioLocationOptions = studioLocations.map((loc) => (studioName ? `${studioName} — ${loc.formattedAddress}` : loc.formattedAddress));
  // Most freelancers only ever fill their basic city/area during onboarding
  // and never touch the optional "pin on map" studio/preferred-location
  // pickers, which left this dropdown showing nothing but "Other" for the
  // common case — forcing clients to hand-type a location on every booking
  // even though the freelancer already told the app where they are.
  const bookingLocationOptions = [...studioLocationOptions, ...preferredLocations.map((loc) => loc.formattedAddress)];
  if (profile?.location && !bookingLocationOptions.includes(profile.location)) {
    bookingLocationOptions.unshift(profile.location);
  }
  const bookingLocations = bookingLocationOptions;
  const socialLinks = freelancerProfile?.social_links || [];
  const pronouns = profile?.pronouns;
  const todayDateString = new Date().toISOString().slice(0, 10);
  const allTimeSlots = useMemo(
    () => generateTimeSlots(freelancerProfile?.working_hours_start, freelancerProfile?.working_hours_end),
    [freelancerProfile?.working_hours_start, freelancerProfile?.working_hours_end]
  );
  const isSelectedDateBlocked = formData.scheduleDate ? isDateBlocked(freelancerBlockedDates, formData.scheduleDate) : false;
  const availableTimeSlots = useMemo(() => {
    // A slot list generated purely from working hours has no idea what time
    // it is "right now" — without this, picking today's date still offered
    // start times hours in the past. Only applies when the chosen date is
    // actually today; any other date keeps the full working-hours range.
    const isToday = formData.scheduleDate === todayDateString;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return allTimeSlots
      .filter((slot) => {
        if (!isToday) return true;
        const [hour, minute] = slot.split(':').map(Number);
        return hour * 60 + minute > currentMinutes;
      })
      .map((slot) => ({
        value: slot,
        taken: formData.scheduleDate ? isTimeSlotTaken(freelancerBookings, formData.scheduleDate, slot) : false,
      }));
  }, [allTimeSlots, freelancerBookings, formData.scheduleDate, todayDateString]);
  // Bounded by the same working-hours slot list as the start time — an end
  // time must be after the chosen start, within that same range.
  const availableEndTimeSlots = useMemo(
    () => (formData.scheduleTime ? allTimeSlots.filter((slot) => slot > formData.scheduleTime) : []),
    [allTimeSlots, formData.scheduleTime]
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

  const focusedCommentThreads = useMemo(
    () => buildCommentThreads(focusedPostId ? commentsByPostId[focusedPostId] || [] : []),
    [commentsByPostId, focusedPostId]
  );

  const showMessageButton = Boolean(user?.id && targetFreelancerUserId && (isFollowing || isFollowedByTarget));

  const handleFavoriteToggle = async () => {
    if (!targetFreelancerUserId || user?.id === targetFreelancerUserId) {
      return;
    }

    if (!user?.id) {
      setAuthPromptMessage('Create an account to save your favorite freelancers.');
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
    if (!targetFreelancerUserId || user?.id === targetFreelancerUserId) return;

    if (!user?.id) {
      setAuthPromptMessage('Create an account to follow freelancers and see their updates.');
      return;
    }

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
    if (!targetFreelancerUserId || user?.id === targetFreelancerUserId) {
      return;
    }

    if (!user?.id) {
      setAuthPromptMessage('Create an account to block or report other users.');
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

    if (!formData.scheduleDate || !formData.scheduleTime || !formData.scheduleEndTime) {
      setError('Choose a start and end time for this booking.');
      return;
    }

    if (formData.scheduleEndTime <= formData.scheduleTime) {
      setError('End time must be after the start time.');
      return;
    }

    // Instant client-side pre-check only — the real, race-safe enforcement
    // is the database's bookings_no_overlap exclusion constraint, applied
    // once the freelancer actually accepts (see DataService.createBooking).
    if (!isRangeAvailable(freelancerBookings, freelancerBlockedDates, formData.scheduleDate, formData.scheduleTime, formData.scheduleEndTime)) {
      setError('This freelancer is already occupied during that time range. Please choose a different slot.');
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
        { date: formData.scheduleDate, time: formData.scheduleTime, endTime: formData.scheduleEndTime }
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
      scheduleEndTime: '',
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
        prefillScheduleEndTime: formData.scheduleEndTime || undefined,
        prefillCurrency: formData.currency || undefined,
      },
    });
  };

  const openPostFocus = async (postId: string, options?: { focusComment?: boolean }) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    if (savedScrollYRef.current === null) {
      savedScrollYRef.current = window.scrollY;
    }
    setFocusedPostId(stateKey);
    // Clicking the post opens the full detail; clicking Comment opens the
    // same lightweight comments-only overlay the For You feed uses.
    setShowPostContentOnOpen(!options?.focusComment);
    if (options?.focusComment) {
      setCommentFocusToken((token) => token + 1);
    }

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
  };

  const loadFreelancerPostLikes = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    setLikesModalPostId(stateKey);
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
    if (savedScrollYRef.current !== null) {
      const y = savedScrollYRef.current;
      savedScrollYRef.current = null;
      window.scrollTo(0, y);
    }
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
    if (!user?.id) {
      setAuthPromptMessage('Create an account to like and save creative work.');
      return;
    }

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

    dispatchClientPostUpdated(apiPostId);
  };

  const togglePostSave = async (postId: string) => {
    if (!user?.id) {
      setAuthPromptMessage('Create an account to like and save creative work.');
      return;
    }

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

  const handleShare = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    const post = profilePosts.find((item: any) => String(item.id) === stateKey);
    if (!post) {
      return;
    }

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

    setSharingPost(post);
    setIsShareSheetOpen(true);
    setIsLoadingMutualUsers(true);
    setSelectedShareRecipientIds([]);
    setShareStatusMessage(null);
    setCopyLinkError(null);

    if (user?.id) {
      const response = await DataService.getMutualUsers(user.id);
      if (response.error) {
        setMutualUsers([]);
        setError((response.error as any).message || 'Unable to load mutuals for sharing.');
      } else {
        setMutualUsers(response.data || []);
      }
    }

    setIsLoadingMutualUsers(false);
  };

  const copyShareLink = async () => {
    if (!sharingPost) {
      return;
    }

    const shareUrl = `${window.location.origin}/profile/${targetFreelancerUserId || id}`;
    setCopyLinkError(null);

    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareStatusMessage('Post link copied to clipboard.');
      return;
    } catch {
      // Fall through to the legacy fallback below (older browsers, or a
      // non-HTTPS/non-localhost origin where the async Clipboard API doesn't exist).
    }

    const textarea = document.createElement('textarea');
    textarea.value = shareUrl;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let fallbackWorked = false;
    try {
      fallbackWorked = document.execCommand('copy');
    } catch {
      fallbackWorked = false;
    }
    document.body.removeChild(textarea);

    if (fallbackWorked) {
      setShareStatusMessage('Post link copied to clipboard.');
    } else {
      setCopyLinkError('Could not copy automatically — select and copy the link below.');
    }
  };

  const sendShareToMutuals = async () => {
    if (!user?.id || !sharingPost || selectedShareRecipientIds.length === 0) {
      return;
    }

    setIsSendingShare(true);
    setError(null);

    const authorId = targetFreelancerUserId || id;
    const shareUrl = `${window.location.origin}/profile/${authorId}`;
    const sharedPostPayload = {
      postId: sharingPost.id,
      authorName: displayName,
      authorId,
      shareUrl,
      caption: sharingPost.caption,
      imageUrl: sharingPost.image_url || null,
    };
    const message = `SHARED_POST::${JSON.stringify(sharedPostPayload)}`;

    const recipients = mutualUsers.filter((mutual) => selectedShareRecipientIds.includes(mutual.id));

    for (const mutual of recipients) {
      const conversationResponse = await DataService.ensureConversation(user.id, mutual.id);
      if (conversationResponse.error || !conversationResponse.data) {
        continue;
      }

      await DataService.sendMessage({
        conversation_id: conversationResponse.data.id,
        sender_id: user.id,
        recipient_id: mutual.id,
        content: message,
        read: false,
      } as any);
    }

    setIsSendingShare(false);
    setIsShareSheetOpen(false);
    setSharingPost(null);
    setMutualUsers([]);
    setSelectedShareRecipientIds([]);
    setShareStatusMessage(
      recipients.length === 1
        ? `Shared with ${recipients[0].full_name || recipients[0].email}.`
        : `Shared with ${recipients.length} mutuals.`
    );
  };

  const submitComment = async (postId: string) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    const draft = (commentDraftByPostId[stateKey] || '').trim();
    if (!draft) {
      return;
    }

    if (!user?.id) {
      setAuthPromptMessage('Sign up to join the conversation.');
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

  const replyToComment = (postId: string, rootComment: any, mentionAuthor?: any) => {
    const targetCommentId = String(rootComment.id);
    const threadKey = getReplyKey(postId, targetCommentId);
    const isRootReplyClick = !mentionAuthor;
    const alreadyOpenForThisRoot = replyTargetByPostId[postId] === targetCommentId;

    if (isRootReplyClick && alreadyOpenForThisRoot) {
      setReplyTargetByPostId((current) => ({ ...current, [postId]: null }));
      return;
    }

    const mentionSource = mentionAuthor || rootComment;
    setReplyTargetByPostId((current) => ({ ...current, [postId]: targetCommentId }));
    setReplyDraftByCommentKey((current) => ({
      ...current,
      [threadKey]: buildMentionPrefill(mentionSource.user?.full_name),
    }));
  };

  const submitReply = async (postId: string, comment: any) => {
    const stateKey = String(postId);
    const apiPostId = stateKey.replace(/^client-post-/, '');
    if (!user?.id) {
      setAuthPromptMessage('Sign up to join the conversation.');
      return;
    }

    const commentId = String(comment.id);
    const threadKey = getReplyKey(stateKey, commentId);
    const draft = replyDraftByCommentKey[threadKey] || '';
    if (!hasReplyContent(draft)) {
      return;
    }

    const content = draft.trim();
    setIsSubmittingReplyByCommentKey((current) => ({ ...current, [threadKey]: true }));

    const response = await DataService.addClientPostComment(user.id, apiPostId, content);
    if (response.error) {
      setError((response.error as any).message || 'Unable to add reply.');
      setIsSubmittingReplyByCommentKey((current) => ({ ...current, [threadKey]: false }));
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
    setReplyDraftByCommentKey((current) => ({ ...current, [threadKey]: '' }));
    setReplyTargetByPostId((current) => ({ ...current, [stateKey]: null }));
    setIsSubmittingReplyByCommentKey((current) => ({ ...current, [threadKey]: false }));
    dispatchClientPostUpdated(apiPostId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-sky-50">
        <div className="h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
      </div>
    );
  }

  if (isBlockedProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-sky-50 p-6">
        <div className="mx-auto max-w-[960px] rounded-3xl bg-white/80 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100">
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
      <div className="min-h-screen bg-gradient-to-b from-white to-sky-50 p-6">
        <div className="mx-auto max-w-[960px] rounded-3xl bg-white/80 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-red-200">
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
    <div className="relative min-h-screen pb-20 md:pb-0">
      <PageBackdrop />
      <div className="relative z-10">
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-sky-100">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3 md:gap-6">
              <button onClick={onBack} className="p-2 hover:bg-sky-50 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
              </button>
              <img src={logoImage} alt="CreativeHUB" className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover shadow-sm ring-2 ring-white" />
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

        <section className="mb-8 overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          {/* Desktop header — unchanged from before. Hidden below md; the
              mobile-only header right after this block replaces it there
              because this overlay-on-cover layout, when the button row
              wraps to several lines on a narrow screen, grows taller than
              the cover's fixed height and gets clipped by this section's
              overflow-hidden (that's the "can't see my profile picture on
              phone" bug). */}
          <div className="relative hidden h-64 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 md:block">
            {coverUrl ? (
              <ImageWithFallback src={coverUrl} alt={`${displayName} background`} className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <Avatar
                    src={avatarUrl}
                    alt={displayName}
                    sizeClassName="h-24 w-24 ring-4 ring-white bg-gray-200 shadow-xl md:h-32 md:w-32 rounded-full"
                    badgeSize="md"
                  />
                  <div className="text-white">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold md:text-3xl">
                        {displayName}
                        {shouldDisplayPronouns(pronouns) && <span className="ml-2 text-base font-normal text-white/70 md:text-lg">· {pronouns}</span>}
                      </h1>
                      {bandPerformerTypes.map((type: string) => (
                        <span key={type} className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold text-white md:text-sm">
                          {type}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-base text-white/90 md:text-lg">{title}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {isOwner ? (
                    <button
                      onClick={() => navigate('/edit-profile')}
                      className="flex items-center gap-2 rounded-xl border border-white/30 bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg"
                    >
                      <Edit className="h-5 w-5" />
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleFavoriteToggle}
                        className={`rounded-full p-3 transition-all ${isFavorited ? 'bg-blue-50 text-blue-500 hover:bg-blue-100' : 'bg-white/90 text-gray-700 hover:bg-white'}`}
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
                          if (!user?.id) {
                            setAuthPromptMessage('Create an account to block or report other users.');
                            return;
                          }
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
                          onClick={() => targetFreelancerUserId && onOpenChat?.(targetFreelancerUserId)}
                          className="flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur-xl px-6 py-3 text-base font-semibold text-gray-900 shadow-sm transition-all hover:shadow-lg"
                        >
                          <MessageCircle className="h-5 w-5" />
                          Message
                        </button>
                      )}

                      {isBookableFreelancer && (
                        <button
                          onClick={() => {
                            if (!user?.id) {
                              setAuthPromptMessage('Create an account to send a booking request to this freelancer.');
                              return;
                            }
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
                          className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg"
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
                              ? 'rounded-xl border border-sky-200 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-all hover:bg-sky-50 disabled:opacity-60'
                              : 'rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg disabled:opacity-60'
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

          {/* Mobile header — the avatar sits below the cover in normal
              document flow (pulled up over it with a negative margin)
              instead of being absolutely positioned inside it, so it can
              never get clipped no matter how many action buttons wrap
              below the name. Desktop block above is untouched. */}
          <div className="md:hidden">
            <div className="relative h-28 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500">
              {coverUrl ? (
                <ImageWithFallback src={coverUrl} alt={`${displayName} background`} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="px-5 pb-5">
              <div className="-mt-10 mb-3">
                <Avatar
                  src={avatarUrl}
                  alt={displayName}
                  sizeClassName="h-20 w-20 ring-4 ring-white bg-gray-200 shadow-xl rounded-full"
                  badgeSize="md"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {displayName}
                  {shouldDisplayPronouns(pronouns) && <span className="ml-2 text-sm font-normal text-gray-500">· {pronouns}</span>}
                </h1>
                {bandPerformerTypes.map((type: string) => (
                  <span key={type} className="rounded-full border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-900">
                    {type}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-sm text-gray-600">{title}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {isOwner ? (
                  <button
                    onClick={() => navigate('/edit-profile')}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleFavoriteToggle}
                      className={`rounded-full p-2.5 transition-all ${isFavorited ? 'bg-blue-50 text-blue-500 hover:bg-blue-100' : 'bg-sky-50 text-gray-700 hover:bg-sky-100'}`}
                    >
                      <Heart className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => void handleBlockUser()}
                      disabled={isBlockingUser}
                      className="rounded-full bg-sky-50 p-2.5 text-gray-700 transition-all hover:bg-sky-100 disabled:opacity-60"
                      title="Block this user"
                    >
                      <Ban className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => {
                        if (!user?.id) {
                          setAuthPromptMessage('Create an account to block or report other users.');
                          return;
                        }
                        setReportSubmitted(false);
                        setShowReportModal(true);
                      }}
                      className="rounded-full bg-sky-50 p-2.5 text-gray-700 transition-all hover:bg-sky-100"
                      title="Report this user"
                    >
                      <Flag className="h-5 w-5" />
                    </button>

                    {showMessageButton && (
                      <button
                        onClick={() => targetFreelancerUserId && onOpenChat?.(targetFreelancerUserId)}
                        className="flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-sky-100"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </button>
                    )}

                    {isBookableFreelancer && (
                      <button
                        onClick={() => {
                          if (!user?.id) {
                            setAuthPromptMessage('Create an account to send a booking request to this freelancer.');
                            return;
                          }
                          setFormData((current) => ({
                            ...current,
                            offerAmount: current.offerAmount || (minimumOffer > 0 ? String(minimumOffer) : ''),
                          }));
                          setShowBookingForm(true);
                        }}
                        className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg"
                      >
                        Request Booking
                      </button>
                    )}

                    <button
                      onClick={() => void handleFollowToggle()}
                      disabled={isFollowLoading}
                      className={
                        isFollowing
                          ? 'rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-sky-50 disabled:opacity-60'
                          : 'rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg disabled:opacity-60'
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
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-3 md:px-8 md:pb-8 md:pt-4">
            <p className="text-gray-700 leading-7">{bio}</p>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mt-2 flex flex-col gap-2 text-sm text-gray-700 md:text-base">
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
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-sm text-gray-500">{totalReviews} reviews</p>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 md:h-5 md:w-5" />
                  <span className="font-semibold">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
                </div>
              </div>
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-sm text-gray-500">experience level</p>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <Briefcase className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="font-semibold">{majorSkillExperienceLevel || 'New'}</span>
                </div>
              </div>
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-sm text-gray-500">{rateCaption}</p>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="font-semibold">{formattedRate}</span>
                </div>
              </div>
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-sm text-gray-500">active projects</p>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="font-semibold">{activeProjects}</span>
                </div>
              </div>
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-sm text-gray-500">completed projects</p>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="font-semibold">{completedProjects}</span>
                </div>
              </div>
            </div>
            )}
          </div>
        </section>

        {isBookableFreelancer && (
        <section className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <h2 className="text-2xl font-bold text-gray-900">Social Links</h2>
              {socialLinks.length === 0 ? (
                <p className="mt-4 text-gray-600">No social links added yet.</p>
              ) : (
                <SocialLinksRow links={socialLinks} className="mt-4 flex flex-wrap gap-3" />
              )}
            </div>

            <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <h2 className="text-xl font-bold text-gray-900">Working Details</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p><span className="font-semibold text-gray-900">Availability:</span> {availability}</p>
                <p><span className="font-semibold text-gray-900">{rateFieldLabel}:</span> {convertedHourlyRate !== null ? formattedRate : 'Discuss per project'}</p>
                {majorSkillExperienceLevel && (
                  <p><span className="font-semibold text-gray-900">Experience level:</span> {majorSkillExperienceLevel}</p>
                )}
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
          </div>

          <aside className="space-y-6">
            {/* One consolidated card instead of three separate boxes -
                Primary specialty (plus any additional specialties from
                minorSkills, appended right alongside it rather than in
                their own separate "Also skilled in" section) sits above
                Skills and Styles inside the same card, each still always
                rendered - it used to be hidden entirely whenever both
                majorSkillExperienceLevel and minorSkills were empty, since
                both are independently-optional inputs (an "(optional)"
                experience-level picker in onboarding, and a minor-skills
                picker that only lives in Edit Profile, never onboarding) -
                most accounts never had either and it silently vanished. */}
            <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Primary specialty</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white">
                    {title}
                    {majorSkillExperienceLevel && <span className="text-white/80"> · {majorSkillExperienceLevel}</span>}
                  </span>
                  {minorSkills.map((skill) => (
                    <span key={skill.name} className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white">
                      {skill.name}
                      {skill.experienceLevel && <span className="text-white/80"> · {skill.experienceLevel}</span>}
                    </span>
                  ))}
                  {otherPerformerTypes.map((type) => (
                    <span key={type} className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white">
                      {type}
                    </span>
                  ))}
                  {minorCategories.map((minorCategory) => (
                    <span key={minorCategory} className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white">
                      {minorCategory}
                      {minorCategoryExperienceLevels[minorCategory] && (
                        <span className="text-white/80"> · {minorCategoryExperienceLevels[minorCategory]}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-xl font-bold text-gray-900">Skills</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {skills.length > 0 ? skills.map((skill: string) => (
                    <span key={skill} className="rounded-full border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
                      {skill}
                    </span>
                  )) : <p className="text-sm text-gray-600">No skills listed yet.</p>}
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-xl font-bold text-gray-900">Styles</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {styles.length > 0 ? styles.map((style: string) => (
                    <span key={style} className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white">
                      {style}
                    </span>
                  )) : <p className="text-sm text-gray-600">No styles listed yet.</p>}
                </div>
              </div>
            </div>
          </aside>
        </section>
        )}

        {isBookableFreelancer && (
          <section className="mt-8">
            <AvailabilityCalendar bookings={freelancerBookings} blockedDates={freelancerBlockedDates} />
          </section>
        )}

        {isBookableFreelancer && (freelancerProfile?.requirements || (freelancerProfile?.limitation_days || []).length > 0 || freelancerProfile?.limitation_note) && (
          <section className="mt-8 rounded-3xl bg-white/90 backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
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

        {(isBookableFreelancer || canViewClientReviews) && reviews.length > 0 && (
          <section className="mt-8 rounded-3xl bg-white/90 backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <h2 className="text-2xl font-bold text-gray-900">{canViewClientReviews ? 'Reviews from Freelancers' : 'Reviews'}</h2>
            {canViewClientReviews && (
              <p className="mt-1 text-sm text-gray-500">Only visible to freelancers — {displayName} can't see these.</p>
            )}
            <div className="mt-5 space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={review.reviewer?.avatar_url || avatarUrl}
                        alt={review.reviewer?.full_name || (canViewClientReviews ? 'Freelancer' : 'Client')}
                        gender={review.reviewer?.gender}
                        sizeClassName="w-9 h-9"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{review.reviewer?.full_name || (canViewClientReviews ? 'Freelancer' : 'Client')}</p>
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
                    <div className="mt-3 rounded-r-xl border-l-4 border-sky-400 bg-sky-50 p-4">
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
          <section className="mt-8 rounded-3xl bg-white/90 backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
            <p className="mt-1 text-sm text-gray-600">Posts from this profile also visible in For You feed.</p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {profilePosts.map((post) => {
                const engagement = postEngagement[post.id] || { likes: 0, comments: 0, shares: 0, saves: 0, liked: false, saved: false };
                return (
                  <PostCard
                    key={post.id}
                    authorName={displayName}
                    authorAvatarUrl={avatarUrl}
                    authorSubtitle={title}
                    createdAtLabel={post.created_at ? new Date(post.created_at).toLocaleDateString() : undefined}
                    imageUrl={post.image_url || undefined}
                    onOpenPost={() => void openPostFocus(post.id)}
                    caption={post.caption || undefined}
                    likesCount={engagement.likes}
                    liked={engagement.liked}
                    onToggleLike={() => void togglePostLike(post.id)}
                    commentsCount={engagement.comments}
                    onOpenComment={() => void openPostFocus(post.id, { focusComment: true })}
                    shareSlot={
                      <PostShareMenu
                        postId={String(post.id).replace(/^client-post-/, '')}
                        title={`CreativeHUB post by @${displayName}`}
                        description={post.caption || undefined}
                        align="right"
                        triggerClassName="group flex items-center gap-2 rounded-full bg-sky-50 px-3 py-2 transition-all hover:bg-sky-100"
                        onShared={(method: PostShareMethod) => {
                          if (user?.id) {
                            void DataService.recordClientPostShare(user.id, String(post.id).replace(/^client-post-/, ''), method);
                          }
                        }}
                        extraItems={(close) => (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              close();
                              void handleShare(post.id);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-sky-50"
                          >
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-700 text-white">
                              <Send className="h-4 w-4" />
                            </span>
                            Send in Messages
                          </button>
                        )}
                      >
                        <Share2 className="h-6 w-6 text-gray-700 transition-transform group-hover:scale-110" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Share</span>
                      </PostShareMenu>
                    }
                    saved={engagement.saved}
                    onToggleSave={() => void togglePostSave(post.id)}
                  />
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(56,189,248,0.2)]">
            {reportSubmitted ? (
              <>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Report submitted</h3>
                <p className="mb-4 text-sm text-gray-600">Thanks — our team will review this report.</p>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-semibold text-white hover:shadow-lg"
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
                  className="mb-3 w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
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
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
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
                  className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {focusedPost && (
        <PostDetailModal
          onClose={closePostFocus}
          showPostContent={showPostContentOnOpen}
          onOpenComments={() => void openPostFocus(focusedPost.id, { focusComment: true })}
          authorName={displayName}
          authorAvatarUrl={avatarUrl}
          authorSubtitle={title}
          createdAtLabel={focusedPost.created_at ? new Date(focusedPost.created_at).toLocaleString() : undefined}
          caption={focusedPost.caption || undefined}
          imageUrl={focusedPost.image_url || undefined}
          onOpenPhoto={() => setViewingPhoto({ url: focusedPost.image_url || avatarUrl, alt: focusedPost.caption || 'Post image' })}
          likesCount={postEngagement[focusedPost.id]?.likes || 0}
          liked={!!postEngagement[focusedPost.id]?.liked}
          onToggleLike={() => void togglePostLike(focusedPost.id)}
          saved={!!postEngagement[focusedPost.id]?.saved}
          onToggleSave={() => void togglePostSave(focusedPost.id)}
          onShare={() => void handleShare(focusedPost.id)}
          onToggleShowLikedUsers={() => void loadFreelancerPostLikes(focusedPost.id)}
          canDelete={isOwner}
          onDelete={() => void deletePost(String(focusedPost.id))}
          commentsCount={postEngagement[focusedPost.id]?.comments || 0}
          comments={focusedCommentThreads.roots}
          loadingComments={!!loadingCommentsByPostId[focusedPost.id]}
          canComment
          fallbackAvatarUrl={fallbackProfileImage}
          threadedComments
          postId={focusedPost.id}
          repliesByParent={focusedCommentThreads.repliesByParent}
          expandedReplyThreadsByKey={expandedReplyThreadsByKey}
          onToggleReplyThread={(threadKey) =>
            setExpandedReplyThreadsByKey((current) => ({
              ...current,
              [threadKey]: !current[threadKey],
            }))
          }
          replyTarget={replyTargetByPostId[focusedPost.id] || null}
          onReply={(comment, mentionAuthor) => replyToComment(focusedPost.id, comment, mentionAuthor)}
          replyDraft={(threadKey) => replyDraftByCommentKey[threadKey] || ''}
          onReplyDraftChange={(threadKey, value) =>
            setReplyDraftByCommentKey((current) => ({
              ...current,
              [threadKey]: value,
            }))
          }
          onSubmitReply={(comment) => void submitReply(focusedPost.id, comment)}
          isSubmittingReply={(threadKey) => !!isSubmittingReplyByCommentKey[threadKey]}
          getReplyKey={getReplyKey}
          currentUserAvatarUrl={user?.avatar_url || fallbackProfileImage}
          commentDraft={commentDraftByPostId[focusedPost.id] || ''}
          onCommentDraftChange={(value) =>
            setCommentDraftByPostId((current) => ({
              ...current,
              [focusedPost.id]: value,
            }))
          }
          onSubmitComment={() => void submitComment(focusedPost.id)}
          isSubmittingComment={!!isSubmittingCommentByPostId[focusedPost.id]}
          commentFocusToken={commentFocusToken}
        />
      )}

      {likesModalPostId && (
        <LikesListModal
          totalCount={postEngagement[likesModalPostId]?.likes || 0}
          users={likedUsersByPostId[likesModalPostId] || []}
          isLoading={!!loadingLikesByPostId[likesModalPostId]}
          fallbackAvatarUrl={fallbackProfileImage}
          onClose={() => setLikesModalPostId(null)}
          onViewUser={(userId) => navigate(`/profile/${userId}`)}
        />
      )}

      {viewingPhoto && (
        <PhotoViewerModal url={viewingPhoto.url} alt={viewingPhoto.alt} onClose={() => setViewingPhoto(null)} />
      )}

      {isShareSheetOpen && sharingPost && (
        <div className="fixed inset-0 z-[1400] animate-in fade-in-0 bg-black/50 backdrop-blur-sm">
          <div className="fixed inset-x-4 top-20 mx-auto max-w-xl rounded-3xl border border-sky-100 bg-white p-5 shadow-[0_20px_60px_rgba(56,189,248,0.25)] md:top-24 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Share post</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">Send this post</h3>
                <p className="mt-1 text-sm text-gray-600">Choose specific mutuals, copy a link, or send to selected users in messages.</p>
              </div>
              <button onClick={() => setIsShareSheetOpen(false)} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-sky-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0">
                  <div className="h-full w-full overflow-hidden rounded-xl">
                    <ImageWithFallback src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
                  <p className="line-clamp-2 text-xs text-gray-600">{sharingPost.caption}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void copyShareLink()}
                className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-left transition-colors hover:bg-sky-50"
              >
                <p className="text-sm font-semibold text-gray-900">Copy link</p>
                <p className="mt-1 text-xs text-gray-500">Copies the post link so you can paste it anywhere.</p>
              </button>

              <button
                type="button"
                onClick={() => void sendShareToMutuals()}
                disabled={isLoadingMutualUsers || isSendingShare || selectedShareRecipientIds.length === 0}
                className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-left text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-semibold">Send in messages</p>
                <p className="mt-1 text-xs text-white/75">
                  {isLoadingMutualUsers
                    ? 'Loading mutuals...'
                    : selectedShareRecipientIds.length > 0
                      ? `Send to ${selectedShareRecipientIds.length} selected user${selectedShareRecipientIds.length === 1 ? '' : 's'}.`
                      : 'Pick recipients first.'}
                </p>
              </button>
            </div>

            {shareStatusMessage && (
              <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">{shareStatusMessage}</p>
            )}
            {copyLinkError && (
              <div className="mt-3 space-y-2">
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{copyLinkError}</p>
                <input
                  readOnly
                  value={`${window.location.origin}/profile/${targetFreelancerUserId || id}`}
                  onFocus={(event) => event.target.select()}
                  className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs text-gray-700"
                />
              </div>
            )}

            <div className="mt-4 max-h-56 overflow-y-auto rounded-2xl border border-sky-100 bg-white">
              {isLoadingMutualUsers ? (
                <p className="px-4 py-3 text-sm text-gray-500">Finding mutual connections...</p>
              ) : mutualUsers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">You do not have any mutual connections yet.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedShareRecipientIds(mutualUsers.map((mutual) => mutual.id))}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedShareRecipientIds([])}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Clear
                    </button>
                  </div>

                  {mutualUsers.map((mutual) => {
                    const isSelected = selectedShareRecipientIds.includes(mutual.id);
                    return (
                      <button
                        key={mutual.id}
                        type="button"
                        onClick={() =>
                          setSelectedShareRecipientIds((current) =>
                            current.includes(mutual.id)
                              ? current.filter((mid) => mid !== mutual.id)
                              : [...current, mutual.id]
                          )
                        }
                        className={`flex w-full items-center gap-3 border-b border-sky-100 px-4 py-3 text-left transition-colors last:border-b-0 ${isSelected ? 'bg-sky-50' : 'hover:bg-sky-50'}`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'border-sky-200 bg-white text-transparent'}`}>
                          <Check className="h-3 w-3" />
                        </div>
                        <Avatar src={mutual.avatar_url || fallbackProfileImage} alt={mutual.full_name || mutual.email} sizeClassName="h-9 w-9 ring-1 ring-sky-100 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{mutual.full_name || mutual.email}</p>
                          <p className="truncate text-xs text-gray-500">{mutual.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsShareSheetOpen(false)} className="rounded-xl border border-sky-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">
                Close
              </button>
              <button
                type="button"
                onClick={() => void sendShareToMutuals()}
                disabled={isLoadingMutualUsers || isSendingShare || selectedShareRecipientIds.length === 0}
                className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingShare ? 'Sending...' : 'Send to selected users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookingForm && isBookableFreelancer && createPortal(
        <div className="fixed inset-0 z-[1400] overflow-y-auto bg-white">
          <div className="relative min-h-full">
            <PageBackdrop />
            <div className="relative z-10">
              <div className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 backdrop-blur-lg">
                <div className="mx-auto max-w-2xl px-4 py-4">
                  <button
                    onClick={() => setShowBookingForm(false)}
                    className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Request Booking</h2>
                      <p className="text-sm text-gray-600">Send {displayName} the details for your project.</p>
                    </div>
                  </div>
                </div>
              </div>

            <form onSubmit={handleSubmitRequest} className="mx-auto max-w-2xl space-y-6 px-4 py-6">
              <div className="rounded-2xl bg-sky-50/60 p-5">
                <div className="flex items-center gap-4">
                  <Avatar src={avatarUrl} alt={displayName} gender={profile?.gender} sizeClassName="h-16 w-16 ring-2 ring-sky-100 rounded-full" />
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
                  className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                    className="mt-3 w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                  className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                    className="mt-3 w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                  className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="Anything else the freelancer should know?"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Schedule</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <input
                      type="date"
                      required
                      min={todayDateString}
                      value={formData.scheduleDate}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduleDate: event.target.value, scheduleTime: '', scheduleEndTime: '' }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                  <div>
                    <select
                      required
                      disabled={!formData.scheduleDate || isSelectedDateBlocked}
                      value={formData.scheduleTime}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduleTime: event.target.value, scheduleEndTime: '' }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {!formData.scheduleDate ? 'Choose a date first' : isSelectedDateBlocked ? 'Not available this day' : 'Start time'}
                      </option>
                      {availableTimeSlots.map((slot) => (
                        <option key={slot.value} value={slot.value} disabled={slot.taken}>
                          {formatTimeLabel(slot.value)}{slot.taken ? ' — Already booked' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      required
                      disabled={!formData.scheduleTime}
                      value={formData.scheduleEndTime}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduleEndTime: event.target.value }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {!formData.scheduleTime ? 'Choose a start time first' : 'End time'}
                      </option>
                      {availableEndTimeSlots.map((slot) => (
                        <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
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
                    Available {formatTimeLabel(freelancerProfile?.working_hours_start || '09:00')} – {formatTimeLabel(freelancerProfile?.working_hours_end || '18:00')}, this freelancer's working hours. Times already booked are grayed out, and times already passed today aren't shown.
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
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                  <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
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
                          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-sky-800 bg-gray-900/90 px-3 py-2 text-xs text-white shadow-xl">
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
                    className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-sky-100 px-4 py-3 font-semibold text-gray-700 transition-colors hover:border-sky-300 hover:bg-sky-50"
              >
                <Users className="h-4 w-4" />
                Add More Freelancer
              </button>

              <div className="flex items-center justify-between border-t border-sky-100 pt-6">
                <button type="button" onClick={() => setShowBookingForm(false)} className="rounded-xl px-6 py-3.5 font-semibold text-gray-700 transition-colors hover:bg-sky-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:shadow-lg disabled:opacity-60"
                >
                  <Send className="h-5 w-5" />
                  {isSubmittingRequest ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {authPromptMessage && (
        <AuthPromptModal message={authPromptMessage} onClose={() => setAuthPromptMessage(null)} />
      )}
      </div>
    </div>
  );
}
