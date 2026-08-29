import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { DataService } from '../../lib/dataService';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { normalizeCurrencyCode } from '../../lib/currency';
import { isFreelancerCategory } from '../../lib/categories';
import { OnboardingStepShell } from '../../components/common/OnboardingStepShell';
import type { ImageUpload } from '../../components/common/ProfileImageDropzone';
import { LeafletLocationPicker, type LocationPoint } from '../../components/common/LeafletLocationPicker';
import { getPendingSignupProfile } from '../../lib/pendingSignupProfile';
import { StepProfessionalInfo } from './freelancer-onboarding/StepProfessionalInfo';
import { StepCategory } from './freelancer-onboarding/StepCategory';
import { StepSkills } from './freelancer-onboarding/StepSkills';
import { StepStyles } from './freelancer-onboarding/StepStyles';
import { StepExperience } from './freelancer-onboarding/StepExperience';
import { StepPortfolio } from './freelancer-onboarding/StepPortfolio';
import { StepAvailability } from './freelancer-onboarding/StepAvailability';
import { StepServiceLocations } from './freelancer-onboarding/StepServiceLocations';
import { StepPricing } from './freelancer-onboarding/StepPricing';
import { StepRequirements } from './freelancer-onboarding/StepRequirements';
import { StepContactPreferences } from './freelancer-onboarding/StepContactPreferences';
import { StepVerification } from './freelancer-onboarding/StepVerification';
import { parseExperienceYears } from './freelancer-onboarding/types';
import { isValidSocialUrl, type SocialPlatform } from '../../lib/socialPlatforms';

interface BecomeFreelancerPageProps {
  onBack?: () => void;
}

interface StoredLocation {
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  city: string | null;
  district: string | null;
}

const TOTAL_STEPS = 12;

const STEP_META: Array<{ title: string; description: string }> = [
  { title: 'Profile', description: 'Tell clients who you are.' },
  { title: 'Freelancer category', description: 'What service do you provide?' },
  { title: 'Skills', description: 'What you can do.' },
  { title: 'Styles', description: 'What your work looks like.' },
  { title: 'Experience', description: 'How long have you been working professionally?' },
  { title: 'Social links', description: 'Show off your best work (optional — add more later).' },
  { title: 'Availability', description: 'When can clients book you?' },
  { title: 'Service information', description: 'Where and how you provide services.' },
  { title: 'Pricing', description: 'Give clients a sense of your rates.' },
  { title: 'Requirements & limitations', description: 'Set expectations up front.' },
  { title: 'Contact preferences', description: 'How should clients reach you?' },
  { title: 'Verification', description: 'Build trust with a verified badge.' },
];

const REQUIRED_STEPS = new Set([1, 2, 3, 4, 5]);
const TRAVEL_ANYWHERE = 'Open to travel anywhere';

export function BecomeFreelancerPage({ onBack }: BecomeFreelancerPageProps) {
  const { user } = useAuth();
  const { currency: preferredCurrency, setCurrency } = useCurrency();
  const [pendingProfile] = useState(() => getPendingSignupProfile());
  const [step, setStep] = useState(1);

  // (a) Profile
  const [displayName, setDisplayName] = useState(pendingProfile?.fullName || user?.fullName || '');
  const [pronouns, setPronouns] = useState('');
  const [pronounsCustom, setPronounsCustom] = useState('');
  const [bio, setBio] = useState('');
  const [profilePictureUpload, setProfilePictureUpload] = useState<ImageUpload | null>(null);
  const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
  const [coverPhotoUpload, setCoverPhotoUpload] = useState<ImageUpload | null>(null);
  const [isDraggingCoverPhoto, setIsDraggingCoverPhoto] = useState(false);

  // (b) Category, (c) Skills, (d) Styles
  const [category, setCategory] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [pendingCategoryChange, setPendingCategoryChange] = useState<string | null>(null);

  // (e) Experience
  const [experienceYears, setExperienceYears] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');

  // (f) Social links — one URL per platform (matches the social_links
  // table's unique(freelancer_id, platform) constraint).
  const [portfolioLinks, setPortfolioLinks] = useState<Partial<Record<SocialPlatform, string>>>({});

  // (g) Availability
  const [availability, setAvailability] = useState('Available');
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [workingHoursStart, setWorkingHoursStart] = useState('');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('');

  // (h) Service information — base location (users.location) plus
  // freelancer_profiles.locations/studio_name/studio_locations, the same
  // fields Edit Profile's map picker writes to (no separate/duplicate
  // service_area_type + service_radius_km system).
  const [location, setLocation] = useState('');
  const [locationLatitude, setLocationLatitude] = useState<number | null>(null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(null);
  const [locationPlaceId, setLocationPlaceId] = useState<string | null>(null);
  const [locationPickerTarget, setLocationPickerTarget] = useState<'basic' | 'studio' | 'preferred' | null>(null);
  const [studioName, setStudioName] = useState('');
  const [studioLocations, setStudioLocations] = useState<StoredLocation[]>([]);
  const [preferredLocations, setPreferredLocations] = useState<StoredLocation[]>([]);

  // (i) Pricing
  const [pricingType, setPricingType] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [startingPriceCurrency, setStartingPriceCurrency] = useState(normalizeCurrencyCode(preferredCurrency, 'THB'));
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // (j) Requirements / limitations
  const [requirements, setRequirements] = useState('');
  const [limitationDays, setLimitationDays] = useState<string[]>([]);
  const [limitationNote, setLimitationNote] = useState('');

  // (k) Contact preferences
  const [contactPreference, setContactPreference] = useState<string[]>(['creativehub_messages']);

  // (l) Verification
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<'not_submitted' | 'pending' | 'verified'>('not_submitted');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(pendingProfile?.avatarPreviewUrl || user?.avatar_url || null);

  // Prefill from whatever was already saved (e.g. photo/location chosen at
  // sign-up) with a fresh DB read rather than the auth context's user object,
  // which can still be holding the pre-upload/pre-geocode snapshot from the
  // moment signUp() resolved.
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    DataService.getUser(user.id).then(({ data }) => {
      if (!isMounted || !data) return;
      // full_name/avatar_url: only fall back to this DB read when there's no
      // pendingProfile — a fresh signup's DB row can still be mid-flight
      // (see pendingSignupProfile.ts), so a value it already provided must
      // win over whatever this read happens to see.
      if (!pendingProfile) {
        if (data.full_name) setDisplayName(data.full_name);
        if (data.avatar_url) setExistingAvatarUrl(data.avatar_url);
      }
      if (data.location) setLocation((current) => current || data.location || '');
      if (typeof data.location_latitude === 'number') setLocationLatitude(data.location_latitude);
      if (typeof data.location_longitude === 'number') setLocationLongitude(data.location_longitude);
      if (data.location_place_id) setLocationPlaceId(data.location_place_id);
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const setProfileImageFile = (file: File) => {
    if (profilePictureUpload) URL.revokeObjectURL(profilePictureUpload.previewUrl);
    setProfilePictureUpload({ file, previewUrl: URL.createObjectURL(file) });
  };

  const setCoverImageFile = (file: File) => {
    if (coverPhotoUpload) URL.revokeObjectURL(coverPhotoUpload.previewUrl);
    setCoverPhotoUpload({ file, previewUrl: URL.createObjectURL(file) });
  };

  // Switching category means the Skills/Styles chosen so far almost
  // certainly don't apply to the new one, so this asks first, then clears
  // both and lets the next two steps' suggestions repopulate from scratch.
  const applyCategoryChange = (nextCategory: string) => {
    if (category && category !== nextCategory && (skills.length > 0 || styles.length > 0)) {
      setPendingCategoryChange(nextCategory);
      return;
    }
    setCategory(nextCategory);
  };

  const confirmCategoryChange = () => {
    if (!pendingCategoryChange) return;
    setCategory(pendingCategoryChange);
    setSkills([]);
    setStyles([]);
    setPendingCategoryChange(null);
  };

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      if (!displayName.trim()) return 'Professional display name is required.';
      if (!bio.trim()) return 'Add a short professional bio.';
    }
    if (current === 2 && !isFreelancerCategory(category)) return 'Select a freelancer category.';
    if (current === 3 && skills.length === 0) return 'Select or add at least one skill.';
    if (current === 4 && styles.length === 0) return 'Select or add at least one style.';
    if (current === 5 && !experienceYears) return 'Select your years of experience.';
    return null;
  };

  const handleContinue = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
  };

  const handleSkip = () => {
    setError(null);
    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
  };

  // Going back a step is always fine; leaving the flow entirely from step 1
  // is only offered when the caller supplied onBack — first-time onboarding
  // (reached via the mandatory post-signup gate) passes none, so there's no
  // way to bail before finishing. Resuming/editing later (from Settings, or
  // the "Become a Freelancer" upgrade path) does supply onBack.
  const handleBack = () => {
    setError(null);
    setStep((current) => Math.max(current - 1, 1));
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
      setStudioLocations((current) => (current.some((item) => item.formattedAddress === storedPoint.formattedAddress) ? current : [...current, storedPoint]));
    } else if (locationPickerTarget === 'preferred') {
      setPreferredLocations((current) => (current.some((item) => item.formattedAddress === storedPoint.formattedAddress) ? current : [...current, storedPoint]));
    } else {
      setLocation(point.formattedAddress);
      setLocationLatitude(point.latitude);
      setLocationLongitude(point.longitude);
      setLocationPlaceId(point.placeId);
    }
    setLocationPickerTarget(null);
  };

  const addPreferredPreset = () => {
    setPreferredLocations((current) =>
      current.some((item) => item.formattedAddress === TRAVEL_ANYWHERE)
        ? current
        : [...current, { formattedAddress: TRAVEL_ANYWHERE, latitude: null, longitude: null, placeId: null, city: null, district: null }]
    );
  };

  const handleFinish = async () => {
    if (!user?.id) {
      setError('Please sign in again to complete freelancer onboarding.');
      return;
    }

    if (!isFreelancerCategory(category)) {
      setError('Select a freelancer category before finishing.');
      return;
    }
    if (skills.length === 0) {
      setError('Select or add at least one skill before finishing.');
      return;
    }
    if (styles.length === 0) {
      setError('Select or add at least one style before finishing.');
      return;
    }

    setError(null);
    setIsSaving(true);

    // Prefer an exact point picked on the map; only fall back to geocoding
    // the typed text if the user never opened the picker (or typed over it).
    let resolvedLat: number | null = locationLatitude;
    let resolvedLng: number | null = locationLongitude;
    let resolvedPlaceId: string | null = locationPlaceId;

    if ((resolvedLat === null || resolvedLng === null) && location.trim()) {
      const resolved = await geocodeAddress(location.trim()).catch(() => null);
      if (resolved) {
        resolvedLat = resolved.latitude;
        resolvedLng = resolved.longitude;
        resolvedPlaceId = resolved.placeId;
      }
    }

    let uploadedAvatarUrl: string | null = null;
    let uploadedCoverUrl: string | null = null;

    if (profilePictureUpload) {
      const upload = await DataService.uploadUserProfileImage(user.id, profilePictureUpload.file, 'avatar');
      if (upload.error || !upload.publicUrl) {
        setError((upload.error as any)?.message || 'Unable to upload your profile picture.');
        setIsSaving(false);
        return;
      }
      uploadedAvatarUrl = upload.publicUrl;
    }

    if (coverPhotoUpload) {
      const upload = await DataService.uploadUserProfileImage(user.id, coverPhotoUpload.file, 'cover');
      if (upload.error || !upload.publicUrl) {
        setError((upload.error as any)?.message || 'Unable to upload your cover photo.');
        setIsSaving(false);
        return;
      }
      uploadedCoverUrl = upload.publicUrl;
    }

    const resolvedPronouns = pronouns === 'Custom' ? pronounsCustom.trim() : pronouns;

    const userUpdate = await DataService.updateUser(user.id, {
      role: 'freelancer',
      full_name: displayName.trim(),
      pronouns: resolvedPronouns || null,
      avatar_url: uploadedAvatarUrl || existingAvatarUrl || user.avatar_url || null,
      cover_url: uploadedCoverUrl,
      bio: bio.trim() || null,
      preferred_currency: normalizeCurrencyCode(startingPriceCurrency, 'THB'),
      location: location.trim() || null,
      location_latitude: resolvedLat,
      location_longitude: resolvedLng,
      location_place_id: resolvedPlaceId,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    } as any);

    if (userUpdate.error) {
      setError((userUpdate.error as any).message || 'Unable to update your account role.');
      setIsSaving(false);
      return;
    }

    const freelancerProfilePayload = {
      title: category,
      description: bio.trim() || null,
      hourly_rate: startingPrice ? Number(startingPrice) : null,
      skills,
      styles,
      experience_years: parseExperienceYears(experienceYears),
      experience_level: experienceLevel ? experienceLevel.toLowerCase() : null,
      is_available: availability === 'Available',
      working_days: workingDays,
      working_hours_start: workingHoursStart || null,
      working_hours_end: workingHoursEnd || null,
      studio_name: studioName.trim() || null,
      studio_locations: studioLocations,
      locations: preferredLocations,
      pricing_type: pricingType || null,
      min_price: minPrice ? Number(minPrice) : null,
      max_price: maxPrice ? Number(maxPrice) : null,
      requirements: requirements.trim() || null,
      limitation_days: limitationDays,
      limitation_note: limitationNote.trim() || null,
      contact_preference: contactPreference,
      phone_verified: phoneVerified,
      identity_status: identityStatus,
      portfolio_count: Object.values(portfolioLinks).filter((url) => url && isValidSocialUrl(url)).length,
      updated_at: new Date().toISOString(),
    };

    const existingProfile = await DataService.getFreelancerProfile(user.id);
    let freelancerProfileId: string | undefined = existingProfile.data?.id;

    if (existingProfile.data) {
      const updateProfile = await DataService.updateFreelancerProfile(user.id, freelancerProfilePayload as any);
      if (updateProfile.error || !updateProfile.data) {
        setError((updateProfile.error as any)?.message || 'Unable to update freelancer profile.');
        setIsSaving(false);
        return;
      }
      freelancerProfileId = updateProfile.data.id;
    } else {
      const createProfile = await DataService.createFreelancerProfile(user.id, freelancerProfilePayload as any);
      if (createProfile.error || !createProfile.data) {
        setError((createProfile.error as any)?.message || 'Unable to create freelancer profile.');
        setIsSaving(false);
        return;
      }
      freelancerProfileId = createProfile.data.id;
    }

    if (freelancerProfileId) {
      for (const [platform, url] of Object.entries(portfolioLinks) as Array<[SocialPlatform, string | undefined]>) {
        if (!url || !isValidSocialUrl(url)) continue;
        await DataService.addSocialLink(freelancerProfileId, platform, url.trim());
      }
    }

    await setCurrency(normalizeCurrencyCode(startingPriceCurrency, 'THB'), true);

    setIsSaving(false);
    // Full reload so AuthContext re-reads the updated user profile (role
    // change) and the freelancer dashboard button appears.
    window.location.href = '/explore';
  };

  const meta = STEP_META[step - 1];
  const isSkippable = !REQUIRED_STEPS.has(step) && step !== TOTAL_STEPS;
  const isLastStep = step === TOTAL_STEPS;

  return (
    <>
    {locationPickerTarget && (
      <LeafletLocationPicker
        initialPoint={
          locationPickerTarget === 'basic' && locationLatitude !== null && locationLongitude !== null
            ? { latitude: locationLatitude, longitude: locationLongitude, formattedAddress: location, placeId: locationPlaceId }
            : null
        }
        onCancel={() => setLocationPickerTarget(null)}
        onConfirm={handleLocationPicked}
      />
    )}
    <OnboardingStepShell
      eyebrow="Freelancer Onboarding"
      title={meta.title}
      description={meta.description}
      stepIndex={step}
      totalSteps={TOTAL_STEPS}
      error={error}
      onBack={step > 1 ? handleBack : onBack}
      backLabel={step === 1 ? 'Back to Explore' : 'Back'}
      onSkip={isSkippable ? handleSkip : undefined}
      onContinue={isLastStep ? () => void handleFinish() : handleContinue}
      isContinueLoading={isLastStep && isSaving}
      continueLabel={isLastStep ? 'Finish' : 'Continue'}
    >
      {step === 1 && (
        <StepProfessionalInfo
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          pronouns={pronouns}
          onPronounsChange={setPronouns}
          pronounsCustom={pronounsCustom}
          onPronounsCustomChange={setPronounsCustom}
          bio={bio}
          onBioChange={setBio}
          profilePictureUpload={profilePictureUpload}
          existingAvatarUrl={existingAvatarUrl}
          isDraggingProfilePicture={isDraggingProfilePicture}
          onProfilePictureDragChange={setIsDraggingProfilePicture}
          onProfilePictureChange={setProfileImageFile}
          onProfilePictureRemove={() => setProfilePictureUpload(null)}
          coverPhotoUpload={coverPhotoUpload}
          isDraggingCoverPhoto={isDraggingCoverPhoto}
          onCoverPhotoDragChange={setIsDraggingCoverPhoto}
          onCoverPhotoChange={setCoverImageFile}
          onCoverPhotoRemove={() => setCoverPhotoUpload(null)}
        />
      )}

      {step === 2 && (
        <div>
          <StepCategory selectedCategory={category} onSelectCategory={applyCategoryChange} />
          {pendingCategoryChange && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
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
      )}

      {step === 3 && <StepSkills category={category} skills={skills} onSkillsChange={setSkills} />}

      {step === 4 && <StepStyles category={category} styles={styles} onStylesChange={setStyles} />}

      {step === 5 && (
        <StepExperience
          experienceYears={experienceYears}
          onExperienceYearsChange={setExperienceYears}
          experienceLevel={experienceLevel}
          onExperienceLevelChange={setExperienceLevel}
        />
      )}

      {step === 6 && <StepPortfolio links={portfolioLinks} onLinksChange={setPortfolioLinks} />}

      {step === 7 && (
        <StepAvailability
          availability={availability}
          onAvailabilityChange={setAvailability}
          workingDays={workingDays}
          onWorkingDaysChange={setWorkingDays}
          workingHoursStart={workingHoursStart}
          onWorkingHoursStartChange={setWorkingHoursStart}
          workingHoursEnd={workingHoursEnd}
          onWorkingHoursEndChange={setWorkingHoursEnd}
        />
      )}

      {step === 8 && (
        <StepServiceLocations
          location={location}
          onLocationChange={(value) => {
            setLocation(value);
            setLocationLatitude(null);
            setLocationLongitude(null);
            setLocationPlaceId(null);
          }}
          hasPreciseLocation={locationLatitude !== null && locationLongitude !== null}
          onOpenBaseLocationPicker={() => setLocationPickerTarget('basic')}
          studioName={studioName}
          onStudioNameChange={setStudioName}
          studioLocations={studioLocations}
          onOpenStudioLocationPicker={() => setLocationPickerTarget('studio')}
          onRemoveStudioLocation={(address) => setStudioLocations((current) => current.filter((item) => item.formattedAddress !== address))}
          preferredLocations={preferredLocations}
          onOpenPreferredLocationPicker={() => setLocationPickerTarget('preferred')}
          onRemovePreferredLocation={(address) => setPreferredLocations((current) => current.filter((item) => item.formattedAddress !== address))}
          onAddPreferredPreset={addPreferredPreset}
        />
      )}

      {step === 9 && (
        <StepPricing
          pricingType={pricingType}
          onPricingTypeChange={setPricingType}
          startingPrice={startingPrice}
          onStartingPriceChange={setStartingPrice}
          currency={startingPriceCurrency}
          onCurrencyChange={setStartingPriceCurrency}
          minPrice={minPrice}
          onMinPriceChange={setMinPrice}
          maxPrice={maxPrice}
          onMaxPriceChange={setMaxPrice}
        />
      )}

      {step === 10 && (
        <StepRequirements
          requirements={requirements}
          onRequirementsChange={setRequirements}
          limitationDays={limitationDays}
          onLimitationDaysChange={setLimitationDays}
          limitationNote={limitationNote}
          onLimitationNoteChange={setLimitationNote}
        />
      )}

      {step === 11 && (
        <StepContactPreferences contactPreference={contactPreference} onContactPreferenceChange={setContactPreference} />
      )}

      {step === 12 && (
        <StepVerification
          emailVerified={Boolean(user?.emailConfirmedAt)}
          phoneVerified={phoneVerified}
          onPhoneVerifiedChange={setPhoneVerified}
          identityStatus={identityStatus}
          onIdentityStatusChange={setIdentityStatus}
        />
      )}
    </OnboardingStepShell>
    </>
  );
}
