import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { CATEGORY_GROUPS } from '../../lib/categories';
import { OnboardingStepShell } from '../../components/common/OnboardingStepShell';
import { ProfileImageDropzone, type ImageUpload } from '../../components/common/ProfileImageDropzone';

const CLIENT_TYPE_OPTIONS = ['Individual', 'Business', 'Event Planner', 'Wedding Organizer', 'Brand', 'Organization', 'Other'];

const CLIENT_PREFERENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'affordable_pricing', label: 'Affordable pricing' },
  { value: 'high_quality', label: 'High quality' },
  { value: 'fast_response', label: 'Fast response' },
  { value: 'experienced_freelancers', label: 'Experienced freelancers' },
  { value: 'specific_style', label: 'Specific visual style' },
  { value: 'nearby', label: 'Nearby freelancers' },
  { value: 'specific_dates', label: 'Available on specific dates' },
];

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const TOTAL_STEPS = 5;

export function ClientOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const onboardingCurrency = normalizeCurrencyCode(preferredCurrency, 'THB');
  const budgetBands = [
    `Under ${formatCurrencyAmount(100, onboardingCurrency)}`,
    `${formatCurrencyAmount(100, onboardingCurrency)}-${formatCurrencyAmount(500, onboardingCurrency)}`,
    `${formatCurrencyAmount(500, onboardingCurrency)}-${formatCurrencyAmount(1000, onboardingCurrency)}`,
    `${formatCurrencyAmount(1000, onboardingCurrency)}+`,
  ];

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [location, setLocation] = useState('');
  const [avatarUpload, setAvatarUpload] = useState<ImageUpload | null>(null);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [clientType, setClientType] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [budgetPreference, setBudgetPreference] = useState('');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Pre-fill from any answers already saved, so revisiting this page (e.g.
  // via "Complete your profile" in Settings after skipping) edits existing
  // choices instead of silently resetting them to blank on Finish.
  useEffect(() => {
    if (!user?.id) {
      setIsLoadingExisting(false);
      return;
    }

    let isMounted = true;

    DataService.getUser(user.id).then(({ data }) => {
      if (!isMounted || !data) {
        setIsLoadingExisting(false);
        return;
      }

      if (data.location) setLocation(data.location);
      if (Array.isArray(data.client_type)) setClientType(data.client_type);
      if (Array.isArray(data.client_interests)) setInterests(data.client_interests);
      if (data.client_budget_preference) setBudgetPreference(data.client_budget_preference);
      if (Array.isArray(data.client_preferences)) setPreferences(data.client_preferences);
      setIsLoadingExisting(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      if (!displayName.trim()) return 'Display name is required.';
      if (!location.trim()) return 'Location is required.';
    }
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

  const handleBack = () => {
    if (step === 1) {
      navigate('/explore');
      return;
    }
    setError(null);
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleFinish = async () => {
    if (!user?.id) {
      setError('Please sign in again to complete onboarding.');
      return;
    }

    setIsSaving(true);
    setError(null);

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
    if (avatarUpload) {
      const upload = await DataService.uploadUserProfileImage(user.id, avatarUpload.file, 'avatar');
      if (upload.publicUrl) uploadedAvatarUrl = upload.publicUrl;
    }

    const response = await DataService.updateUser(user.id, {
      full_name: displayName.trim(),
      location: location.trim(),
      location_latitude: resolvedLat,
      location_longitude: resolvedLng,
      location_place_id: resolvedPlaceId,
      avatar_url: uploadedAvatarUrl || user.avatar_url || null,
      client_type: clientType,
      client_interests: interests,
      client_budget_preference: budgetPreference || null,
      client_preferences: preferences,
      updated_at: new Date().toISOString(),
    } as any);

    if (response.error) {
      setError((response.error as any).message || 'Unable to save onboarding details.');
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    navigate('/explore');
  };

  const isLastStep = step === TOTAL_STEPS;
  const meta = [
    { title: 'Confirm your basics', description: 'This is how freelancers and CreativeHUB will see you.' },
    { title: 'What type of client are you?', description: 'Helps us tailor recommendations for individuals and businesses.' },
    { title: 'What are you looking for?', description: 'Select the creative services you\'re usually interested in.' },
    { title: 'Typical Budget', description: 'A rough range helps us surface freelancers that fit — you can change this anytime.' },
    { title: 'What matters most to you?', description: 'Optional — helps us personalize your freelancer discovery.' },
  ][step - 1];

  if (isLoadingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <OnboardingStepShell
      eyebrow="Client Onboarding"
      title={meta.title}
      description={meta.description}
      stepIndex={step}
      totalSteps={TOTAL_STEPS}
      error={error}
      onBack={handleBack}
      backLabel={step === 1 ? 'Skip for now' : 'Back'}
      onSkip={step > 1 ? handleSkip : undefined}
      onContinue={isLastStep ? () => void handleFinish() : handleContinue}
      isContinueLoading={isLastStep && isSaving}
      continueLabel={isLastStep ? 'Finish' : 'Continue'}
      maxWidthClassName="max-w-3xl"
    >
      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Display Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Location</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Bangkok, Thailand"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <ProfileImageDropzone
              label="Profile Photo (optional)"
              helper="Square images work best for your avatar."
              upload={avatarUpload}
              isDragging={isDraggingAvatar}
              previewClassName="h-28 w-28 rounded-full object-cover"
              onDragChange={setIsDraggingAvatar}
              onChange={(file) => {
                if (avatarUpload) URL.revokeObjectURL(avatarUpload.previewUrl);
                setAvatarUpload({ file, previewUrl: URL.createObjectURL(file) });
              }}
              onRemove={() => setAvatarUpload(null)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CLIENT_TYPE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setClientType(toggle(clientType, option))}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                clientType.includes(option)
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CATEGORY_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setInterests(toggle(interests, group.label))}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                interests.includes(group.label)
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="grid grid-cols-2 gap-3">
          {budgetBands.map((band) => (
            <button
              key={band}
              type="button"
              onClick={() => setBudgetPreference(band)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                budgetPreference === band
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {band}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBudgetPreference('Depends on project')}
            className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
              budgetPreference === 'Depends on project'
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            Depends on project
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CLIENT_PREFERENCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-gray-200 px-4 py-3 hover:border-gray-400"
            >
              <input
                type="checkbox"
                checked={preferences.includes(option.value)}
                onChange={() => setPreferences(toggle(preferences, option.value))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-semibold text-gray-800">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </OnboardingStepShell>
  );
}
