import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { DataService } from '../../lib/dataService';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { normalizeCurrencyCode } from '../../lib/currency';
import { OnboardingStepShell } from '../../components/common/OnboardingStepShell';
import type { ImageUpload } from '../../components/common/ProfileImageDropzone';
import { StepProfessionalInfo } from './freelancer-onboarding/StepProfessionalInfo';
import { StepServices } from './freelancer-onboarding/StepServices';
import { StepSkills } from './freelancer-onboarding/StepSkills';
import { StepExperience } from './freelancer-onboarding/StepExperience';
import { StepPortfolio } from './freelancer-onboarding/StepPortfolio';
import { StepAvailability } from './freelancer-onboarding/StepAvailability';
import { StepServiceArea } from './freelancer-onboarding/StepServiceArea';
import { StepPricing } from './freelancer-onboarding/StepPricing';
import { StepRequirements } from './freelancer-onboarding/StepRequirements';
import { StepContactPreferences } from './freelancer-onboarding/StepContactPreferences';
import { StepVerification } from './freelancer-onboarding/StepVerification';
import { parseExperienceYears } from './freelancer-onboarding/types';
import { isValidSocialUrl, type SocialPlatform } from '../../lib/socialPlatforms';

interface BecomeFreelancerPageProps {
  onBack?: () => void;
}

const TOTAL_STEPS = 11;

const STEP_META: Array<{ title: string; description: string }> = [
  { title: 'Professional information', description: 'Tell clients who you are.' },
  { title: 'Select your services', description: 'What creative services do you offer?' },
  { title: 'Skills', description: 'Add tags that describe your toolkit.' },
  { title: 'Experience', description: 'How long have you been working professionally?' },
  { title: 'Portfolio', description: 'Show off your best work (optional — add more later).' },
  { title: 'Availability', description: 'When can clients book you?' },
  { title: 'Service area', description: 'Where do you provide services?' },
  { title: 'Pricing', description: 'Give clients a sense of your rates.' },
  { title: 'Requirements & limitations', description: 'Set expectations up front.' },
  { title: 'Contact preferences', description: 'How should clients reach you?' },
  { title: 'Verification', description: 'Build trust with a verified badge.' },
];

const REQUIRED_STEPS = new Set([1, 2, 4]);

export function BecomeFreelancerPage({ onBack }: BecomeFreelancerPageProps) {
  const { user } = useAuth();
  const { currency: preferredCurrency, setCurrency } = useCurrency();
  const [step, setStep] = useState(1);

  // (a) Professional information
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [bio, setBio] = useState('');
  const [profilePictureUpload, setProfilePictureUpload] = useState<ImageUpload | null>(null);
  const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
  const [coverPhotoUpload, setCoverPhotoUpload] = useState<ImageUpload | null>(null);
  const [isDraggingCoverPhoto, setIsDraggingCoverPhoto] = useState(false);

  // (b) Services
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // (c) Skills
  const [skills, setSkills] = useState<string[]>([]);

  // (d) Experience
  const [experienceYears, setExperienceYears] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');

  // (e) Portfolio — one URL per social platform (matches the social_links
  // table's unique(freelancer_id, platform) constraint).
  const [portfolioLinks, setPortfolioLinks] = useState<Partial<Record<SocialPlatform, string>>>({});

  // (f) Availability
  const [availability, setAvailability] = useState('Available');
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [workingHoursStart, setWorkingHoursStart] = useState('');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('');

  // (g) Service area
  const [location, setLocation] = useState('');
  const [serviceAreaType, setServiceAreaType] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');

  // (h) Pricing
  const [pricingType, setPricingType] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [startingPriceCurrency, setStartingPriceCurrency] = useState(normalizeCurrencyCode(preferredCurrency, 'THB'));
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // (i) Requirements / limitations
  const [requirements, setRequirements] = useState('');
  const [limitationDays, setLimitationDays] = useState<string[]>([]);
  const [limitationNote, setLimitationNote] = useState('');

  // (j) Contact preferences
  const [contactPreference, setContactPreference] = useState<string[]>(['creativehub_messages']);

  // (k) Verification
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<'not_submitted' | 'pending' | 'verified'>('not_submitted');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);

  // Prefill from whatever was already saved (e.g. photo/location chosen at
  // sign-up) with a fresh DB read rather than the auth context's user object,
  // which can still be holding the pre-upload/pre-geocode snapshot from the
  // moment signUp() resolved.
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    DataService.getUser(user.id).then(({ data }) => {
      if (!isMounted || !data) return;
      if (data.avatar_url) setExistingAvatarUrl(data.avatar_url);
      if (data.location) setLocation((current) => current || data.location || '');
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

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      if (!displayName.trim()) return 'Professional display name is required.';
      if (!bio.trim()) return 'Add a short professional bio.';
    }
    if (current === 2 && selectedServices.length === 0) return 'Choose at least one service.';
    if (current === 4 && !experienceYears) return 'Select your years of experience.';
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

  const handleFinish = async () => {
    if (!user?.id) {
      setError('Please sign in again to complete freelancer onboarding.');
      return;
    }

    setError(null);
    setIsSaving(true);

    let resolvedLat: number | null = null;
    let resolvedLng: number | null = null;
    let resolvedPlaceId: string | null = null;

    if (location.trim()) {
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

    const userUpdate = await DataService.updateUser(user.id, {
      role: 'freelancer',
      full_name: displayName.trim(),
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
      title: selectedServices[0] || null,
      description: bio.trim() || null,
      hourly_rate: startingPrice ? Number(startingPrice) : null,
      skills,
      styles: selectedSpecialties,
      experience_years: parseExperienceYears(experienceYears),
      experience_level: experienceLevel ? experienceLevel.toLowerCase() : null,
      is_available: availability === 'Available',
      working_days: workingDays,
      working_hours_start: workingHoursStart || null,
      working_hours_end: workingHoursEnd || null,
      service_area_type: serviceAreaType || null,
      service_radius_km: serviceRadiusKm && serviceRadiusKm !== 'anywhere' ? Number(serviceRadiusKm) : null,
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
        <StepServices
          selectedServices={selectedServices}
          onSelectedServicesChange={setSelectedServices}
          selectedSpecialties={selectedSpecialties}
          onSelectedSpecialtiesChange={setSelectedSpecialties}
        />
      )}

      {step === 3 && <StepSkills skills={skills} onSkillsChange={setSkills} selectedServices={selectedServices} />}

      {step === 4 && (
        <StepExperience
          experienceYears={experienceYears}
          onExperienceYearsChange={setExperienceYears}
          experienceLevel={experienceLevel}
          onExperienceLevelChange={setExperienceLevel}
        />
      )}

      {step === 5 && <StepPortfolio links={portfolioLinks} onLinksChange={setPortfolioLinks} />}

      {step === 6 && (
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

      {step === 7 && (
        <StepServiceArea
          location={location}
          onLocationChange={setLocation}
          serviceAreaType={serviceAreaType}
          onServiceAreaTypeChange={setServiceAreaType}
          serviceRadiusKm={serviceRadiusKm}
          onServiceRadiusKmChange={setServiceRadiusKm}
        />
      )}

      {step === 8 && (
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

      {step === 9 && (
        <StepRequirements
          requirements={requirements}
          onRequirementsChange={setRequirements}
          limitationDays={limitationDays}
          onLimitationDaysChange={setLimitationDays}
          limitationNote={limitationNote}
          onLimitationNoteChange={setLimitationNote}
        />
      )}

      {step === 10 && (
        <StepContactPreferences contactPreference={contactPreference} onContactPreferenceChange={setContactPreference} />
      )}

      {step === 11 && (
        <StepVerification
          emailVerified={Boolean(user?.emailConfirmedAt)}
          phoneVerified={phoneVerified}
          onPhoneVerifiedChange={setPhoneVerified}
          identityStatus={identityStatus}
          onIdentityStatusChange={setIdentityStatus}
        />
      )}
    </OnboardingStepShell>
  );
}
