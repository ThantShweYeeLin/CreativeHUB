import { Briefcase, Calendar, Camera, ChevronLeft, Edit, Heart, ImagePlus, MapPin, MessageCircle, Save, Star } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { LeafletLocationPreview } from '../../components/common/LeafletLocationPreview';
import { LeafletLocationPicker } from '../../components/common/LeafletLocationPicker';

interface ClientProfilePageProps {
  onBack: () => void;
}

export function ClientProfilePage({ onBack }: ClientProfilePageProps) {
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [postEngagement, setPostEngagement] = useState<Record<string, { likes: number; comments: number; liked: boolean }>>({});
  const [formValues, setFormValues] = useState({
    full_name: '',
    location: '',
    location_latitude: null as number | null,
    location_longitude: null as number | null,
    location_place_id: null as string | null,
    bio: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImageType, setUploadingImageType] = useState<'avatar' | 'cover' | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const [profileResponse, bookingsResponse] = await Promise.all([
        DataService.getUser(user.id),
        DataService.getClientBookings(user.id),
      ]);

      const postsResponse = await DataService.getClientPostsByClientId(user.id, 20);

      if (!isMounted) {
        return;
      }

      if (profileResponse.error) {
        setError((profileResponse.error as any).message || 'Unable to load your profile.');
      } else {
        setProfile(profileResponse.data);
        setFormValues({
          full_name: profileResponse.data?.full_name || '',
          location: profileResponse.data?.location || '',
          location_latitude: profileResponse.data?.location_latitude ?? null,
          location_longitude: profileResponse.data?.location_longitude ?? null,
          location_place_id: profileResponse.data?.location_place_id ?? null,
          bio: profileResponse.data?.bio || '',
        });
      }

      if (bookingsResponse.error) {
        setError((bookingsResponse.error as any).message || 'Unable to load your bookings.');
      } else {
        setBookings(bookingsResponse.data || []);
      }

      if (!postsResponse.error) {
        const loadedPosts = postsResponse.data || [];
        setPosts(loadedPosts);
        const nextEngagement: Record<string, { likes: number; comments: number; liked: boolean }> = {};
        loadedPosts.forEach((post: any) => {
          nextEngagement[post.id] = {
            likes: Math.max(0, Number(post.likes_count || 0)),
            comments: Math.max(0, Number(post.comments_count || 0)),
            liked: false,
          };
        });
        setPostEngagement(nextEngagement);
      }

      setIsLoading(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const completedBookings = bookings.filter((booking) => booking.status === 'completed').length;
  const activeBookings = bookings.filter((booking) =>
    ['pending', 'confirmed', 'in_progress'].includes(booking.status)
  ).length;
  const recentBookings = bookings.slice(0, 3);
  const displayName = profile?.full_name || user?.fullName || 'CreativeHUB Client';
  const username = profile?.email ? `@${profile.email.split('@')[0]}` : '@client';
  const avatarUrl = profile?.avatar_url || user?.avatar_url || DEFAULT_AVATAR_URL;
  const coverUrl = profile?.cover_url || '';
  const location = profile?.location || 'Location not added';
  const rating = Number(profile?.rating || 0);
  const totalReviews = Number(profile?.total_reviews || 0);
  const locationLatitude = profile?.location_latitude ?? formValues.location_latitude;
  const locationLongitude = profile?.location_longitude ?? formValues.location_longitude;
  const hasPreciseLocation = locationLatitude !== null && locationLongitude !== null;

  const resolveLocation = async (locationText: string) => {
    const result = await geocodeAddress(locationText.trim());
    if (!result) {
      throw new Error('Unable to resolve that location. Try a more specific address.');
    }

    return result;
  };

  const handleResolveLocation = async () => {
    const nextLocation = formValues.location.trim();

    if (!nextLocation) {
      setError('Add a location before resolving it on the map.');
      return;
    }

    setIsResolvingLocation(true);
    setError(null);

    try {
      const resolved = await resolveLocation(nextLocation);
      setFormValues((current) => ({
        ...current,
        location: resolved.formattedAddress,
        location_latitude: resolved.latitude,
        location_longitude: resolved.longitude,
        location_place_id: resolved.placeId,
      }));
      setProfile((current: any) => ({
        ...(current || {}),
        location: resolved.formattedAddress,
        location_latitude: resolved.latitude,
        location_longitude: resolved.longitude,
        location_place_id: resolved.placeId,
      }));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve location.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handleLocationPicked = (point: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
    placeId: string | null;
  }) => {
    setFormValues((current) => ({
      ...current,
      location: point.formattedAddress,
      location_latitude: point.latitude,
      location_longitude: point.longitude,
      location_place_id: point.placeId,
    }));

    setProfile((current: any) => ({
      ...(current || {}),
      location: point.formattedAddress,
      location_latitude: point.latitude,
      location_longitude: point.longitude,
      location_place_id: point.placeId,
    }));

    setIsLocationPickerOpen(false);
  };

  const formatDate = (date: string | null) => {
    if (!date) {
      return 'Date not set';
    }

    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number | string | null) => {
    if (amount === null || amount === undefined) {
      return 'Budget not set';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const togglePostLike = (postId: string) => {
    setPostEngagement((current) => {
      const existing = current[postId] || { likes: 0, comments: 0, liked: false };
      return {
        ...current,
        [postId]: {
          ...existing,
          liked: !existing.liked,
          likes: existing.liked ? Math.max(0, existing.likes - 1) : existing.likes + 1,
        },
      };
    });
  };

  const addPostComment = (postId: string) => {
    setPostEngagement((current) => {
      const existing = current[postId] || { likes: 0, comments: 0, liked: false };
      return {
        ...current,
        [postId]: {
          ...existing,
          comments: existing.comments + 1,
        },
      };
    });
  };

  const handleSaveProfile = async () => {
    if (!user?.id) {
      return;
    }

    if (!isEditMode) {
      setIsEditMode(true);
      return;
    }

    setIsSaving(true);
    setError(null);

    const locationText = formValues.location.trim();
    let resolvedLocation = locationText || null;
    let resolvedLatitude = formValues.location_latitude;
    let resolvedLongitude = formValues.location_longitude;
    let resolvedPlaceId = formValues.location_place_id;

    if (locationText) {
      const locationChanged = locationText !== (profile?.location || '').trim();
      if (locationChanged || resolvedLatitude === null || resolvedLongitude === null) {
        try {
          const resolved = await resolveLocation(locationText);
          resolvedLocation = resolved.formattedAddress;
          resolvedLatitude = resolved.latitude;
          resolvedLongitude = resolved.longitude;
          resolvedPlaceId = resolved.placeId;
        } catch (resolveError) {
          setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve location.');
          setIsSaving(false);
          return;
        }
      }
    }

    const { data, error: saveError } = await DataService.updateUser(user.id, {
      full_name: formValues.full_name,
      location: resolvedLocation,
      location_latitude: resolvedLatitude,
      location_longitude: resolvedLongitude,
      location_place_id: resolvedPlaceId,
      bio: formValues.bio,
      updated_at: new Date().toISOString(),
    } as any);

    if (saveError) {
      setError((saveError as any).message || 'Unable to save your profile.');
    } else {
      setProfile(data);
      setIsEditMode(false);
    }

    setIsSaving(false);
  };

  const getUploadErrorMessage = (uploadError: any) => {
    const message = uploadError?.message || '';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('bucket') && lowerMessage.includes('not found')) {
      return 'Profile uploads need a public Supabase Storage bucket named "avatars". Create it or run the storage SQL in SUPABASE_SETUP.md.';
    }

    if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
      return 'Supabase blocked this upload. Add the "avatars" storage policies from SUPABASE_SETUP.md, then try again.';
    }

    return message || 'Unable to upload image.';
  };

  const handleImageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    imageType: 'avatar' | 'cover'
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user?.id) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }

    setUploadingImageType(imageType);
    setError(null);

    const uploadResponse = await DataService.uploadUserProfileImage(user.id, file, imageType);

    if (uploadResponse.error || !uploadResponse.publicUrl) {
      setError(getUploadErrorMessage(uploadResponse.error));
      setUploadingImageType(null);
      return;
    }

    const updates = imageType === 'avatar'
      ? { avatar_url: uploadResponse.publicUrl }
      : { cover_url: uploadResponse.publicUrl };

    const { data, error: saveError } = await DataService.updateUser(user.id, {
      ...updates,
      updated_at: new Date().toISOString(),
    } as any);

    if (saveError) {
      setError((saveError as any).message || `Uploaded image, but could not save your ${imageType}.`);
    } else {
      setProfile((current: any) => ({
        ...(current || {}),
        ...(data || {}),
        ...updates,
      }));
    }

    setUploadingImageType(null);
  };

  const renderField = (label: string, value: string, key: 'full_name' | 'location' | 'bio') => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      {isEditMode ? (
        key === 'bio' ? (
          <textarea
            value={formValues[key]}
            onChange={(event) => setFormValues((current) => ({ ...current, [key]: event.target.value }))}
            className="min-h-28 w-full px-4 py-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        ) : (
          <input
            value={formValues[key]}
            onChange={(event) => setFormValues((current) => ({ ...current, [key]: event.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        )
      ) : (
        <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{value || 'Not added yet'}</div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
          <p className="text-sm text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

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
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              {isEditMode ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              <span className="hidden md:inline">{isSaving ? 'Saving...' : isEditMode ? 'Save Profile' : 'Edit Profile'}</span>
              <span className="md:hidden">{isSaving ? 'Saving' : isEditMode ? 'Save' : 'Edit'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6 md:mb-8">
          <div className="relative h-24 md:h-32 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900">
            {coverUrl && (
              <ImageWithFallback
                src={coverUrl}
                alt="Profile background"
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/20" />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleImageUpload(event, 'cover')}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingImageType !== null}
              className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-gray-900 shadow-md backdrop-blur hover:bg-white"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">{uploadingImageType === 'cover' ? 'Uploading...' : 'Background'}</span>
            </button>
          </div>
          <div className="px-4 md:px-8 pb-6 md:pb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 -mt-12 md:-mt-16">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden ring-4 ring-white shadow-xl bg-gray-200">
                  <ImageWithFallback
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageUpload(event, 'avatar')}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingImageType !== null}
                  className="absolute bottom-1 right-1 md:bottom-2 md:right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-gray-900 text-white shadow-lg hover:bg-black"
                  aria-label="Upload profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              {/* Profile Info */}
              <div className="flex-1 w-full text-center md:text-left pt-0 md:pt-16">
                <div className="mb-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{displayName}</h2>
                  <p className="text-lg md:text-xl text-gray-600 mb-3">{username}</p>
                  <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 text-sm md:text-base text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                      <span>{location}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-8 text-xs md:text-sm">
                  <div>
                    <span className="font-semibold text-gray-900">Active Projects:</span>{' '}
                    <span className="text-green-600 font-bold">{activeBookings}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Completed Projects:</span>{' '}
                    <span className="text-gray-900 font-bold">{completedBookings}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{rating > 0 ? rating.toFixed(1) : 'No ratings yet'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {hasPreciseLocation && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Precise Location</h2>
                <p className="text-sm text-gray-600">Your profile location as shown on the map.</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{locationLatitude?.toFixed(6)}</p>
                <p>{locationLongitude?.toFixed(6)}</p>
              </div>
            </div>
            <div className="h-[260px] md:h-[360px]">
              <LeafletLocationPreview
                latitude={locationLatitude as number}
                longitude={locationLongitude as number}
                title={displayName}
                subtitle={location}
              />
            </div>
          </div>
        )}

        {/* Personal Info Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-8 mb-6 md:mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Personal Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {renderField('Full Name', displayName, 'full_name')}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 capitalize">{profile?.role || user?.role || 'client'}</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Precise Location</label>
              {isEditMode ? (
                <div className="space-y-3">
                  <input
                    value={formValues.location}
                    onChange={(event) => setFormValues((current) => ({ ...current, location: event.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Street address, district, city, country"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Pick Exact Point
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResolveLocation()}
                      disabled={isResolvingLocation}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                    >
                      {isResolvingLocation ? 'Resolving...' : 'Resolve Address'}
                    </button>
                    {hasPreciseLocation && (
                      <span className="text-xs text-gray-500">
                        {locationLatitude?.toFixed(6)}, {locationLongitude?.toFixed(6)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter an exact address so the map can place your profile precisely.
                  </p>
                </div>
              ) : (
                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                  {location}
                  {hasPreciseLocation && (
                    <p className="mt-1 text-xs text-gray-500">
                      {locationLatitude?.toFixed(6)}, {locationLongitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 text-sm md:text-base truncate">{profile?.email || user?.email || 'Not added yet'}</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reviews</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{totalReviews}</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Joined</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{formatDate(profile?.created_at)}</div>
            </div>
            <div className="md:col-span-2">
              {renderField('Bio', profile?.bio || '', 'bio')}
            </div>
          </div>
        </div>

        {/* Activity Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-xl md:text-2xl font-bold text-gray-900">Recent Booking Activity</h3>
          </div>

          {recentBookings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-md transition-shadow hover:shadow-xl"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <Briefcase className="h-5 w-5 text-gray-900" />
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                      {booking.status?.replace('_', ' ') || 'pending'}
                    </span>
                  </div>
                  <h4 className="mb-2 font-semibold text-gray-900">{booking.project_name}</h4>
                  <p className="mb-4 line-clamp-2 text-sm text-gray-600">{booking.description || 'No description provided.'}</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Freelancer</span>
                      <span className="font-semibold text-gray-900">{booking.freelancer?.full_name || 'Assigned freelancer'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Budget</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(booking.budget)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(booking.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-10 h-10 text-gray-900" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">No bookings yet</h4>
              <p className="text-gray-600 mb-4">Your booked projects will appear here.</p>
            </div>
          )}
        </div>

        {posts.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:mt-8 md:p-8">
            <h3 className="text-xl font-bold text-gray-900 md:text-2xl">My For You Posts</h3>
            <p className="mt-1 text-sm text-gray-600">Posts published from your client account.</p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {posts.map((post) => {
                const engagement = postEngagement[post.id] || { likes: 0, comments: 0, liked: false };
                return (
                  <article key={post.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    <div className="aspect-[4/3] bg-white">
                      <ImageWithFallback
                        src={post.image_url || avatarUrl}
                        alt={post.caption || 'Post'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-700">{post.caption || 'No caption'}</p>
                      <div className="mt-3 flex items-center gap-3 text-sm text-gray-700">
                        <button type="button" onClick={() => togglePostLike(post.id)} className="inline-flex items-center gap-1">
                          <Heart className={`h-4 w-4 ${engagement.liked ? 'fill-red-500 text-red-500' : ''}`} />
                          {engagement.likes}
                        </button>
                        <button type="button" onClick={() => addPostComment(post.id)} className="inline-flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          {engagement.comments}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isLocationPickerOpen && (
        <LeafletLocationPicker
          initialPoint={
            formValues.location_latitude !== null && formValues.location_longitude !== null
              ? {
                  latitude: formValues.location_latitude,
                  longitude: formValues.location_longitude,
                  formattedAddress: formValues.location,
                  placeId: formValues.location_place_id,
                }
              : null
          }
          onCancel={() => setIsLocationPickerOpen(false)}
          onConfirm={handleLocationPicked}
        />
      )}
    </div>
  );
}
