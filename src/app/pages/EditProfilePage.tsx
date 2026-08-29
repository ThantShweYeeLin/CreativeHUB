import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { LeafletLocationPicker, type LocationPoint } from '../../components/common/LeafletLocationPicker';
import { LocationChipList } from '../../components/common/LocationChipList';
import { TagSelector } from '../../components/common/TagSelector';
import { FREELANCER_CATEGORIES, isFreelancerCategory, suggestedSkillsForCategory, suggestedStylesForCategory } from '../../lib/categories';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { PRONOUN_OPTIONS } from '../../lib/pronouns';
import { isValidSocialUrl, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_ICONS, type SocialPlatform } from '../../lib/socialPlatforms';
import { LIMITATION_DAY_OPTIONS, WORKING_DAY_OPTIONS, toggle } from './freelancer-onboarding/types';
import type { Gender } from '../../lib/database.types';

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'lgbtq_plus', label: 'LGBTQ+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface SocialLinkFormEntry {
  id: string | null;
  platform: SocialPlatform;
  url: string;
}

// Same shape as LocationPoint, but latitude/longitude are nullable to allow
// the "Open to travel anywhere" preset, which has no real map coordinate.
interface StoredLocation {
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  city: string | null;
  district: string | null;
}

interface EditProfilePageProps {
  onBack: () => void;
}

export function EditProfilePage({ onBack }: EditProfilePageProps) {
  const { user } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImageType, setUploadingImageType] = useState<'avatar' | 'cover' | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationPickerTarget, setLocationPickerTarget] = useState<'basic' | 'studio' | 'preferred' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isFreelancer, setIsFreelancer] = useState(false);
  const [freelancerProfileId, setFreelancerProfileId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const [basicForm, setBasicForm] = useState({
    full_name: '',
    pronouns: '',
    pronounsCustom: '',
    gender: '' as Gender | '',
    bio: '',
    location: '',
    location_latitude: null as number | null,
    location_longitude: null as number | null,
    location_place_id: null as string | null,
  });

  const [freelancerForm, setFreelancerForm] = useState({
    title: '',
    experience_years: 0,
    hourly_rate: 0,
    is_available: true,
    skills: [] as string[],
    styles: [] as string[],
  });
  const [pendingCategoryChange, setPendingCategoryChange] = useState<string | null>(null);

  const [workingForm, setWorkingForm] = useState({
    studio_name: '',
    studio_locations: [] as StoredLocation[],
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    working_days: [] as string[],
    locations: [] as StoredLocation[],
    requirements: '',
    limitation_days: [] as string[],
    limitation_note: '',
  });

  const [socialLinks, setSocialLinks] = useState<SocialLinkFormEntry[]>([]);
  const [originalSocialLinkIds, setOriginalSocialLinkIds] = useState<string[]>([]);
  const [newSocialPlatform, setNewSocialPlatform] = useState<SocialPlatform>('Instagram');
  const [newSocialUrl, setNewSocialUrl] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const userResponse = await DataService.getUser(user.id);
      if (!isMounted) return;

      if (userResponse.error || !userResponse.data) {
        setError((userResponse.error as any)?.message || 'Unable to load your profile.');
        setIsLoading(false);
        return;
      }

      const profile = userResponse.data as any;
      const freelancer = profile.role === 'freelancer';
      setIsFreelancer(freelancer);
      setAvatarUrl(profile.avatar_url || DEFAULT_AVATAR_URL);
      setCoverUrl(profile.cover_url || '');

      const storedPronouns: string = profile.pronouns || '';
      const isFixedPronoun = (PRONOUN_OPTIONS as readonly string[]).includes(storedPronouns) && storedPronouns !== 'Custom';

      let freelancerProfile: any = null;
      if (freelancer) {
        const freelancerResponse = await DataService.getFreelancerProfile(user.id);
        if (!isMounted) return;
        freelancerProfile = freelancerResponse.data || null;
        setFreelancerProfileId(freelancerProfile?.id || null);
      }

      setBasicForm({
        full_name: profile.full_name || '',
        pronouns: storedPronouns ? (isFixedPronoun ? storedPronouns : 'Custom') : '',
        pronounsCustom: storedPronouns && !isFixedPronoun ? storedPronouns : '',
        gender: (profile.gender as Gender | null) || '',
        // Bio is canonical from freelancer_profiles.description for freelancers,
        // users.bio for everyone else — this is the single source both this
        // form and the shared profile view read from.
        bio: freelancer ? (freelancerProfile?.description || '') : (profile.bio || ''),
        location: profile.location || '',
        location_latitude: profile.location_latitude ?? null,
        location_longitude: profile.location_longitude ?? null,
        location_place_id: profile.location_place_id ?? null,
      });

      if (freelancer && freelancerProfile) {
        setFreelancerForm({
          title: freelancerProfile.title || '',
          experience_years: Number(freelancerProfile.experience_years || 0),
          hourly_rate: Number(freelancerProfile.hourly_rate || 0),
          is_available: freelancerProfile.is_available !== false,
          skills: freelancerProfile.skills || [],
          styles: freelancerProfile.styles || [],
        });
        setWorkingForm({
          studio_name: freelancerProfile.studio_name || '',
          studio_locations: freelancerProfile.studio_locations || [],
          working_hours_start: freelancerProfile.working_hours_start || '09:00',
          working_hours_end: freelancerProfile.working_hours_end || '18:00',
          working_days: freelancerProfile.working_days || [],
          locations: freelancerProfile.locations || [],
          requirements: freelancerProfile.requirements || '',
          limitation_days: freelancerProfile.limitation_days || [],
          limitation_note: freelancerProfile.limitation_note || '',
        });
        const links = (freelancerProfile.social_links || []).map((link: any) => ({ id: link.id as string, platform: link.platform, url: link.url }));
        setSocialLinks(links);
        setOriginalSocialLinkIds(links.map((link: SocialLinkFormEntry) => link.id as string));
      }

      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>, imageType: 'avatar' | 'cover') => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user?.id) return;

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

    const updates = imageType === 'avatar' ? { avatar_url: uploadResponse.publicUrl } : { cover_url: uploadResponse.publicUrl };
    const { error: saveError } = await DataService.updateUser(user.id, { ...updates, updated_at: new Date().toISOString() } as any);

    if (saveError) {
      setError((saveError as any).message || `Uploaded image, but could not save your ${imageType}.`);
    } else if (imageType === 'avatar') {
      setAvatarUrl(uploadResponse.publicUrl);
    } else {
      setCoverUrl(uploadResponse.publicUrl);
    }

    setUploadingImageType(null);
  };

  const handleResolveLocation = async () => {
    const nextLocation = basicForm.location.trim();
    if (!nextLocation) {
      setError('Add a location before resolving it on the map.');
      return;
    }

    setIsResolvingLocation(true);
    setError(null);

    const resolved = await geocodeAddress(nextLocation);
    if (!resolved) {
      setError('Unable to resolve that location. Try a more specific address.');
      setIsResolvingLocation(false);
      return;
    }

    setBasicForm((current) => ({
      ...current,
      location: resolved.formattedAddress,
      location_latitude: resolved.latitude,
      location_longitude: resolved.longitude,
      location_place_id: resolved.placeId,
    }));
    setIsResolvingLocation(false);
  };

  const handleLocationPicked = (point: LocationPoint) => {
    const storedPoint: StoredLocation = {
      formattedAddress: point.formattedAddress,
      latitude: point.latitude,
      longitude: point.longitude,
      placeId: point.placeId,
      city: point.city ?? null,
      district: point.district ?? null,
    };

    if (locationPickerTarget === 'studio') {
      setWorkingForm((current) => ({
        ...current,
        studio_locations: current.studio_locations.some((item) => item.formattedAddress === storedPoint.formattedAddress)
          ? current.studio_locations
          : [...current.studio_locations, storedPoint],
      }));
    } else if (locationPickerTarget === 'preferred') {
      setWorkingForm((current) => ({
        ...current,
        locations: current.locations.some((item) => item.formattedAddress === storedPoint.formattedAddress)
          ? current.locations
          : [...current.locations, storedPoint],
      }));
    } else {
      setBasicForm((current) => ({
        ...current,
        location: point.formattedAddress,
        location_latitude: point.latitude,
        location_longitude: point.longitude,
        location_place_id: point.placeId,
      }));
    }
    setLocationPickerTarget(null);
  };

  const handleAddPresetLocation = (label: string) => {
    setWorkingForm((current) => ({
      ...current,
      locations: current.locations.some((item) => item.formattedAddress === label)
        ? current.locations
        : [...current.locations, { formattedAddress: label, latitude: null, longitude: null, placeId: null, city: null, district: null }],
    }));
  };

  const handleRemoveStudioLocation = (address: string) => {
    setWorkingForm((current) => ({ ...current, studio_locations: current.studio_locations.filter((item) => item.formattedAddress !== address) }));
  };

  const handleRemovePreferredLocation = (address: string) => {
    setWorkingForm((current) => ({ ...current, locations: current.locations.filter((item) => item.formattedAddress !== address) }));
  };

  // Switching category means the current Skills/Styles almost certainly
  // don't apply to the new one (a Makeup Artist's "Bridal Makeup" skill
  // makes no sense on a Fashion Designer profile), so this asks first, then
  // clears everything and lets suggestedSkillsForCategory/
  // suggestedStylesForCategory populate the new category's chips.
  const applyCategoryChange = (nextCategory: string) => {
    if (freelancerForm.title && freelancerForm.title !== nextCategory && (freelancerForm.skills.length > 0 || freelancerForm.styles.length > 0)) {
      setPendingCategoryChange(nextCategory);
      return;
    }
    setFreelancerForm((current) => ({ ...current, title: nextCategory }));
  };

  const confirmCategoryChange = () => {
    if (!pendingCategoryChange) return;
    setFreelancerForm((current) => ({ ...current, title: pendingCategoryChange, skills: [], styles: [] }));
    setPendingCategoryChange(null);
  };

  const handleAddSocialLink = () => {
    if (!newSocialUrl.trim()) {
      setError('Enter a URL for this social link.');
      return;
    }
    if (!isValidSocialUrl(newSocialUrl)) {
      setError('Enter a valid URL, e.g. https://instagram.com/username.');
      return;
    }
    if (socialLinks.some((link) => link.platform === newSocialPlatform)) {
      setError(`You already added a ${newSocialPlatform} link. Edit or remove it instead.`);
      return;
    }

    setError(null);
    setSocialLinks((current) => [...current, { id: null, platform: newSocialPlatform, url: newSocialUrl.trim() }]);
    setNewSocialUrl('');
  };

  const handleSocialLinkUrlChange = (platform: SocialPlatform, url: string) => {
    setSocialLinks((current) => current.map((link) => (link.platform === platform ? { ...link, url } : link)));
  };

  const handleRemoveSocialLink = (platform: SocialPlatform) => {
    setSocialLinks((current) => current.filter((link) => link.platform !== platform));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    if (isFreelancer && !isFreelancerCategory(freelancerForm.title)) {
      setError('Select a freelancer category before saving.');
      return;
    }
    if (isFreelancer && freelancerForm.skills.length === 0) {
      setError('Select or add at least one skill.');
      return;
    }
    if (isFreelancer && freelancerForm.styles.length === 0) {
      setError('Select or add at least one style.');
      return;
    }
    if (isFreelancer && workingForm.working_hours_start >= workingForm.working_hours_end) {
      setError('Working hours end time must be after the start time.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const locationText = basicForm.location.trim();
    let locationLatitude = basicForm.location_latitude;
    let locationLongitude = basicForm.location_longitude;
    let locationPlaceId = basicForm.location_place_id;

    if (locationText && (locationLatitude === null || locationLongitude === null)) {
      const resolved = await geocodeAddress(locationText);
      if (!resolved) {
        setError('Unable to resolve your location. Please use a more specific address.');
        setIsSaving(false);
        return;
      }
      locationLatitude = resolved.latitude;
      locationLongitude = resolved.longitude;
      locationPlaceId = resolved.placeId;
    }

    const resolvedPronouns = basicForm.pronouns === 'Custom' ? basicForm.pronounsCustom.trim() : basicForm.pronouns;

    const userUpdate = await DataService.updateUser(user.id, {
      full_name: basicForm.full_name,
      pronouns: resolvedPronouns || null,
      gender: basicForm.gender || null,
      location: locationText || null,
      location_latitude: locationLatitude,
      location_longitude: locationLongitude,
      location_place_id: locationPlaceId,
      bio: isFreelancer ? undefined : basicForm.bio,
      updated_at: new Date().toISOString(),
    } as any);

    if (userUpdate.error) {
      setError((userUpdate.error as any).message || 'Unable to save your profile.');
      setIsSaving(false);
      return;
    }

    if (isFreelancer) {
      const freelancerPayload = {
        title: freelancerForm.title,
        description: basicForm.bio,
        hourly_rate: freelancerForm.hourly_rate,
        experience_years: freelancerForm.experience_years,
        is_available: freelancerForm.is_available,
        skills: freelancerForm.skills,
        styles: freelancerForm.styles,
        studio_name: workingForm.studio_name.trim() || null,
        studio_locations: workingForm.studio_locations,
        locations: workingForm.locations,
        working_hours_start: workingForm.working_hours_start,
        working_hours_end: workingForm.working_hours_end,
        working_days: workingForm.working_days,
        requirements: workingForm.requirements,
        limitation_days: workingForm.limitation_days,
        limitation_note: workingForm.limitation_note,
        updated_at: new Date().toISOString(),
      };

      const profileUpdate = freelancerProfileId
        ? await DataService.updateFreelancerProfile(user.id, freelancerPayload as any)
        : await DataService.createFreelancerProfile(user.id, freelancerPayload as any);

      if (profileUpdate.error) {
        setError((profileUpdate.error as any)?.message || 'Unable to save your freelancer profile.');
        setIsSaving(false);
        return;
      }

      const savedProfileId = freelancerProfileId || (profileUpdate.data as any)?.id || null;
      setFreelancerProfileId(savedProfileId);

      if (savedProfileId) {
        const currentIds = socialLinks.filter((link) => link.id).map((link) => link.id as string);
        const toDelete = originalSocialLinkIds.filter((id) => !currentIds.includes(id));
        const toCreate = socialLinks.filter((link) => !link.id);
        const toUpdate = socialLinks.filter((link) => link.id);

        const socialLinkResults = await Promise.all([
          ...toDelete.map((id) => DataService.deleteSocialLink(id)),
          ...toCreate.map((link) => DataService.addSocialLink(savedProfileId, link.platform, link.url)),
          ...toUpdate.map((link) => DataService.updateSocialLink(link.id as string, { url: link.url })),
        ]);

        const socialLinkError = socialLinkResults.find((result) => result.error);
        if (socialLinkError) {
          setError((socialLinkError.error as any)?.message || 'Profile saved, but some social links could not be saved.');
        }

        const refreshedLinks = await DataService.getFreelancerSocialLinks(savedProfileId);
        if (!refreshedLinks.error) {
          const links = (refreshedLinks.data || []).map((link: any) => ({ id: link.id as string, platform: link.platform, url: link.url }));
          setSocialLinks(links);
          setOriginalSocialLinkIds(links.map((link) => link.id));
        }
      }
    }

    setSuccess('Profile saved.');
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      <div className="sticky top-0 z-10 mb-6 border-b border-gray-200 bg-white/80 backdrop-blur-lg md:mb-8">
        <div className="mx-auto max-w-[900px] px-4 py-4 md:px-8 md:py-6">
          <button onClick={onBack} className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-black md:mb-4 md:text-base">
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            Back
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Edit Profile</h1>
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60 md:px-6 md:py-3"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}
        </div>
      </div>

      <div className="mx-auto max-w-[900px] space-y-6 px-4 md:space-y-8 md:px-8">

        {/* Basic Profile */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="relative h-32 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 md:h-40">
            {coverUrl && <ImageWithFallback src={coverUrl} alt="Cover" className="h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-black/20" />
            <input ref={coverInputRef} type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'cover')} className="hidden" />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingImageType !== null}
              className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-gray-900 shadow-md hover:bg-white"
            >
              <ImagePlus className="h-4 w-4" />
              {uploadingImageType === 'cover' ? 'Uploading...' : 'Cover'}
            </button>
          </div>

          <div className="px-4 pb-6 pt-0 md:px-8 md:pb-8">
            <div className="relative -mt-12 mb-6 inline-block md:-mt-16">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-gray-200 shadow-xl ring-4 ring-white md:h-32 md:w-32">
                <ImageWithFallback src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={(event) => handleImageUpload(event, 'avatar')} className="hidden" />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingImageType !== null}
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-gray-900 text-white shadow-lg hover:bg-black md:bottom-2 md:right-2"
                aria-label="Upload profile picture"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            <h2 className="mb-4 text-lg font-bold text-gray-900 md:text-xl">Basic Profile</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
                <input
                  value={basicForm.full_name}
                  onChange={(event) => setBasicForm((current) => ({ ...current, full_name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Pronouns</label>
                <select
                  value={basicForm.pronouns}
                  onChange={(event) => setBasicForm((current) => ({ ...current, pronouns: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Not set</option>
                  {PRONOUN_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {basicForm.pronouns === 'Custom' && (
                  <input
                    value={basicForm.pronounsCustom}
                    onChange={(event) => setBasicForm((current) => ({ ...current, pronounsCustom: event.target.value }))}
                    placeholder="e.g. ze/zir"
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Gender</label>
                <select
                  value={basicForm.gender}
                  onChange={(event) => setBasicForm((current) => ({ ...current, gender: event.target.value as Gender }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Not set</option>
                  {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Location</label>
                <input
                  value={basicForm.location}
                  onChange={(event) => setBasicForm((current) => ({ ...current, location: event.target.value, location_latitude: null, location_longitude: null, location_place_id: null }))}
                  placeholder="Street address, district, city, country"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setLocationPickerTarget('basic')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Pick Exact Point
                  </button>
                  <button type="button" onClick={() => void handleResolveLocation()} disabled={isResolvingLocation} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60">
                    {isResolvingLocation ? 'Resolving...' : 'Resolve Address'}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Bio</label>
                <textarea
                  value={basicForm.bio}
                  onChange={(event) => setBasicForm((current) => ({ ...current, bio: event.target.value }))}
                  className="min-h-28 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
          </div>
        </section>

        {isFreelancer && (
          <>
            {/* Freelancer Profile */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-8">
              <h2 className="mb-4 text-lg font-bold text-gray-900 md:text-xl">Freelancer Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Category</label>
                  <select
                    value={freelancerForm.title}
                    onChange={(event) => applyCategoryChange(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="" disabled>Select a category</option>
                    {FREELANCER_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.label}>{category.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Your category determines which clients find you in Explore, search, and the AI Matcher.
                  </p>

                  {pendingCategoryChange && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">
                        Changing your freelancer category will require you to update your Skills and Styles.
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        Your current Skills and Styles don't apply to {pendingCategoryChange} and will be cleared.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={confirmCategoryChange}
                          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                        >
                          Change category
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingCategoryChange(null)}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Experience (years)</label>
                    <input
                      type="number"
                      value={freelancerForm.experience_years}
                      onChange={(event) => setFreelancerForm((current) => ({ ...current, experience_years: Number(event.target.value) }))}
                      placeholder="e.g. 3"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Starting Rate (THB/hr)</label>
                    <input
                      type="number"
                      value={freelancerForm.hourly_rate}
                      onChange={(event) => setFreelancerForm((current) => ({ ...current, hourly_rate: Number(event.target.value) }))}
                      placeholder="e.g. 800"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Skills</label>
                  <p className="mb-2 text-xs text-gray-500">What you can do.</p>
                  <TagSelector
                    suggestions={suggestedSkillsForCategory(freelancerForm.title)}
                    selected={freelancerForm.skills}
                    onChange={(next) => setFreelancerForm((current) => ({ ...current, skills: next }))}
                    otherPlaceholder="e.g. Voiceover Direction"
                    emptyHint="Select at least one skill."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Styles</label>
                  <p className="mb-2 text-xs text-gray-500">What your work looks like — the AI Matcher searches by these.</p>
                  <TagSelector
                    suggestions={suggestedStylesForCategory(freelancerForm.title)}
                    selected={freelancerForm.styles}
                    onChange={(next) => setFreelancerForm((current) => ({ ...current, styles: next }))}
                    otherPlaceholder="e.g. Fantasy Fairy Makeup"
                    emptyHint="Select at least one style."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={freelancerForm.is_available}
                    onChange={(event) => setFreelancerForm((current) => ({ ...current, is_available: event.target.checked }))}
                  />
                  Available for new bookings
                </label>

                <div className="border-t border-gray-100 pt-4">
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Social Links</label>
                  <p className="mb-3 text-xs text-gray-500">Shown on your public profile so clients can see your work.</p>

                  {socialLinks.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {socialLinks.map((link) => {
                        const Icon = SOCIAL_PLATFORM_ICONS[link.platform];
                        return (
                          <div key={link.platform} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <Icon className="h-4 w-4 flex-shrink-0 text-gray-700" />
                            <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-900">{link.platform}</span>
                            <input
                              value={link.url}
                              onChange={(event) => handleSocialLinkUrlChange(link.platform, event.target.value)}
                              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <button onClick={() => handleRemoveSocialLink(link.platform)} className="flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600" aria-label={`Remove ${link.platform} link`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={newSocialPlatform}
                      onChange={(event) => setNewSocialPlatform(event.target.value as SocialPlatform)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 sm:w-40"
                    >
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform} disabled={socialLinks.some((link) => link.platform === platform)}>{platform}</option>
                      ))}
                    </select>
                    <input
                      value={newSocialUrl}
                      onChange={(event) => setNewSocialUrl(event.target.value)}
                      placeholder={`https://${newSocialPlatform.toLowerCase()}.com/username`}
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <button onClick={handleAddSocialLink} className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:shadow-lg">
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Working Information */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-8">
              <h2 className="mb-4 text-lg font-bold text-gray-900 md:text-xl">Working Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Studio name</label>
                  <input
                    value={workingForm.studio_name}
                    onChange={(event) => setWorkingForm((current) => ({ ...current, studio_name: event.target.value }))}
                    placeholder="e.g. Vipa Creative Studio"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Studio location</label>
                  <LocationChipList
                    locations={workingForm.studio_locations}
                    onRemove={handleRemoveStudioLocation}
                    onAddFromMap={() => setLocationPickerTarget('studio')}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Preferred service locations</label>
                  <LocationChipList
                    locations={workingForm.locations}
                    onRemove={handleRemovePreferredLocation}
                    onAddFromMap={() => setLocationPickerTarget('preferred')}
                    presetLabel="Open to travel anywhere"
                    onAddPreset={() => handleAddPresetLocation('Open to travel anywhere')}
                    presetDisabled={workingForm.locations.some((loc) => loc.formattedAddress === 'Open to travel anywhere')}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Pick real places from the map (e.g. Bangkok only, or Bangkok + Chiang Mai), or mark yourself open to travel anywhere. Clients see these options (plus your studio) when choosing a shoot location for a booking.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Working hours start</label>
                    <input
                      type="time"
                      value={workingForm.working_hours_start}
                      onChange={(event) => setWorkingForm((current) => ({ ...current, working_hours_start: event.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Working hours end</label>
                    <input
                      type="time"
                      value={workingForm.working_hours_end}
                      onChange={(event) => setWorkingForm((current) => ({ ...current, working_hours_end: event.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Days you're generally available</label>
                  <div className="flex flex-wrap gap-2">
                    {WORKING_DAY_OPTIONS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setWorkingForm((current) => ({ ...current, working_days: toggle(current.working_days, day) }))}
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all md:text-sm ${
                          workingForm.working_days.includes(day) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Things I require from clients</label>
                  <textarea
                    value={workingForm.requirements}
                    onChange={(event) => setWorkingForm((current) => ({ ...current, requirements: event.target.value }))}
                    rows={3}
                    placeholder="Minimum 3 days advance booking. 30% deposit required."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">I don't work on</label>
                  <div className="flex flex-wrap gap-2">
                    {LIMITATION_DAY_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setWorkingForm((current) => ({ ...current, limitation_days: toggle(current.limitation_days, option) }))}
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all md:text-sm ${
                          workingForm.limitation_days.includes(option) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Other limitations (optional)</label>
                  <input
                    value={workingForm.limitation_note}
                    onChange={(event) => setWorkingForm((current) => ({ ...current, limitation_note: event.target.value }))}
                    placeholder="I only accept outdoor shoots within Bangkok."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {locationPickerTarget && (
        <LeafletLocationPicker
          initialPoint={
            locationPickerTarget === 'basic' && basicForm.location_latitude !== null && basicForm.location_longitude !== null
              ? { latitude: basicForm.location_latitude, longitude: basicForm.location_longitude, formattedAddress: basicForm.location, placeId: basicForm.location_place_id }
              : null
          }
          onCancel={() => setLocationPickerTarget(null)}
          onConfirm={handleLocationPicked}
        />
      )}
    </div>
  );
}
