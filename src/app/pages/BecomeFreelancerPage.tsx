import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, ChevronLeft, ImagePlus, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { LeafletLocationPicker } from '../../components/common/LeafletLocationPicker';

interface BecomeFreelancerPageProps {
  onBack?: () => void;
}

const services = [
  'Photographer',
  'Videographer',
  'Graphic Designer',
  'Makeup Artist',
  'Hair Stylist',
  'Fashion Designer',
  'Model',
  'Event Decoration',
] as const;

const specialtyMap: Record<string, string[]> = {
  Photographer: ['Wedding', 'Portrait', 'Fashion', 'Food', 'Commercial'],
  Videographer: ['Wedding Film', 'Commercial', 'Music Video', 'Event', 'Documentary'],
  'Graphic Designer': ['Branding', 'Editorial', 'Packaging', 'Social Media', 'Illustration'],
  'Makeup Artist': ['Bridal', 'Editorial', 'Special Effects', 'Runway', 'Beauty'],
  'Hair Stylist': ['Bridal', 'Runway', 'Colorist', 'Editorial', 'Studio'],
  'Fashion Designer': ['Ready-to-Wear', 'Luxury', 'Couture', 'Streetwear', 'Costume'],
  Model: ['Runway', 'Editorial', 'E-commerce', 'Commercial', 'Beauty'],
  'Event Decoration': ['Weddings', 'Corporate', 'Floral', 'Theme', 'Luxury Setup'],
};

const experienceOptions = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'] as const;
const availabilityOptions = ['Available', 'Busy', 'Unavailable'] as const;
const workingDayOptions = ['Monday-Friday', 'Weekends', 'Flexible'] as const;

interface PortfolioUpload {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImageUpload {
  file: File;
  previewUrl: string;
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function parseExperienceYears(value: string) {
  switch (value) {
    case 'Less than 1 year':
      return 0;
    case '1-3 years':
      return 2;
    case '3-5 years':
      return 4;
    case '5-10 years':
      return 7;
    case '10+ years':
      return 10;
    default:
      return 0;
  }
}

function ProfileImageDropzone({
  label,
  helper,
  upload,
  isDragging,
  previewClassName,
  onDragChange,
  onChange,
  onRemove,
}: {
  label: string;
  helper: string;
  upload: ImageUpload | null;
  isDragging: boolean;
  previewClassName: string;
  onDragChange: (isDragging: boolean) => void;
  onChange: (file: File) => void;
  onRemove: () => void;
}) {
  const handleFiles = (files: FileList | null) => {
    const file = Array.from(files || []).find((item) => item.type.startsWith('image/'));
    if (file) {
      onChange(file);
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          onDragChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragChange(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragChange(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging ? 'border-gray-900 bg-gray-100' : 'border-gray-300 bg-gray-50 hover:border-gray-500 hover:bg-white'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        {upload ? (
          <>
            <img src={upload.previewUrl} alt={`${label} preview`} className={previewClassName} />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onRemove();
              }}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md transition-colors hover:bg-gray-900 hover:text-white"
              aria-label={`Remove ${label.toLowerCase()}`}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-md">
              <ImagePlus className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-gray-900">Drag an image here or choose a photo</p>
            <p className="mt-1 text-xs text-gray-500">{helper}</p>
          </>
        )}
      </label>
    </div>
  );
}

export function BecomeFreelancerPage({ onBack }: BecomeFreelancerPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [profilePictureUpload, setProfilePictureUpload] = useState<ImageUpload | null>(null);
  const [coverPhotoUpload, setCoverPhotoUpload] = useState<ImageUpload | null>(null);
  const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
  const [isDraggingCoverPhoto, setIsDraggingCoverPhoto] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [projectBudgetRange, setProjectBudgetRange] = useState('');
  const [availability, setAvailability] = useState('Available');
  const [workingDays, setWorkingDays] = useState('Flexible');
  const [location, setLocation] = useState('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [locationLatitude, setLocationLatitude] = useState<number | null>(null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(null);
  const [locationPlaceId, setLocationPlaceId] = useState<string | null>(null);
  const [liveLocations, setLiveLocations] = useState<Array<{ name: string; detail?: string; lat?: number; lon?: number; placeId?: string | null }>>([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [locationSearchMessage, setLocationSearchMessage] = useState('');
  const [portfolioUploads, setPortfolioUploads] = useState<PortfolioUpload[]>([]);
  const [isDraggingPortfolio, setIsDraggingPortfolio] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [behance, setBehance] = useState('');
  const [website, setWebsite] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [businessLicenseUrl, setBusinessLicenseUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const availableSpecialties = useMemo(() => {
    return Array.from(new Set(selectedServices.flatMap((service) => specialtyMap[service] || [])));
  }, [selectedServices]);

  const addPortfolioFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setError('Please choose image files for your portfolio.');
      return;
    }

    setError(null);
    setPortfolioUploads((current) => {
      const remainingSlots = Math.max(20 - current.length, 0);
      const nextUploads = imageFiles.slice(0, remainingSlots).map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      return [...current, ...nextUploads];
    });
  };

  useEffect(() => {
    const trimmed = location.trim();
    if (trimmed.length < 2) {
      setLiveLocations([]);
      setIsSearchingLocations(false);
      setLocationSearchMessage('');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingLocations(true);
      setLocationSearchMessage('');

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(trimmed)}`,
          { headers: { Accept: 'application/json' }, signal: controller.signal }
        );

        if (!response.ok) throw new Error('Location search failed');

        const results = await response.json();
        const places = (Array.isArray(results) ? results : []).map((place: any) => {
          const address = place.address || {};
          const name =
            address.road || address.suburb || address.city || address.town || address.village || place.display_name || trimmed;
          const detail = [address.road, address.suburb, address.city || address.town || address.village, address.state, address.country]
            .filter(Boolean)
            .join(', ');

          return {
            name: place.display_name || name,
            detail: detail || place.display_name,
            lat: Number(place.lat),
            lon: Number(place.lon),
            placeId: typeof place.osm_id === 'number' ? String(place.osm_id) : null,
          };
        });

        setLiveLocations(places);
        setLocationSearchMessage(places.length ? '' : 'No matching places found. You can still use your typed location.');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setLiveLocations([]);
          setLocationSearchMessage('Live place search is unavailable. You can still use your typed location.');
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingLocations(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [location]);

  const removePortfolioUpload = (uploadId: string) => {
    setPortfolioUploads((current) => {
      const upload = current.find((item) => item.id === uploadId);
      if (upload) {
        URL.revokeObjectURL(upload.previewUrl);
      }

      return current.filter((item) => item.id !== uploadId);
    });
  };

  const setProfileImageFile = (file: File) => {
    if (profilePictureUpload) {
      URL.revokeObjectURL(profilePictureUpload.previewUrl);
    }

    setProfilePictureUpload({ file, previewUrl: URL.createObjectURL(file) });
    setError(null);
  };

  const setCoverImageFile = (file: File) => {
    if (coverPhotoUpload) {
      URL.revokeObjectURL(coverPhotoUpload.previewUrl);
    }

    setCoverPhotoUpload({ file, previewUrl: URL.createObjectURL(file) });
    setError(null);
  };

  const handleContinue = () => {
    setError(null);

    if (step === 1) {
      if (!displayName.trim()) {
        setError('Professional display name is required.');
        return;
      }
    }

    if (step === 2) {
      if (selectedServices.length === 0) {
        setError('Choose at least one service.');
        return;
      }
      if (!experience) {
        setError('Select your experience level.');
        return;
      }
      if (!bio.trim()) {
        setError('Add a short professional bio.');
        return;
      }
    }

    if (step === 3) {
      if (portfolioUploads.length < 5) {
        setError('Please add at least 5 portfolio photos to continue.');
        return;
      }
      if (!location.trim()) {
        setError('Location is required for map visibility.');
        return;
      }
    }

    setStep((current) => (current < 4 ? ((current + 1) as 1 | 2 | 3 | 4) : current));
  };

  const handleFinish = async () => {
    if (!user?.id) {
      setError('Please sign in again to complete freelancer onboarding.');
      return;
    }

    if (portfolioUploads.length < 5) {
      setError('Please add at least 5 portfolio photos.');
      return;
    }

    setError(null);
    setIsSaving(true);

    // Prefer explicit picker values if user selected a point, otherwise geocode the typed location
    let resolvedLat = locationLatitude;
    let resolvedLng = locationLongitude;
    let resolvedPlaceId = locationPlaceId;

    if ((!resolvedLat || !resolvedLng) && location.trim()) {
      try {
        const resolved = await geocodeAddress(location.trim());
        if (!resolved) {
          setError('Unable to resolve your location. Please use a more specific address.');
          setIsSaving(false);
          return;
        }

        resolvedLat = resolved.latitude;
        resolvedLng = resolved.longitude;
        resolvedPlaceId = resolved.placeId;
      } catch (resolveError) {
        setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve your location.');
        setIsSaving(false);
        return;
      }
    }

    const isAvailable = availability === 'Available';
    const parsedStartingPrice = Number(startingPrice || 0);
    const profileDescription = [
      bio.trim(),
      projectBudgetRange ? `Typical project budget: ${projectBudgetRange}` : '',
      `Working days: ${workingDays}`,
      instagram ? `Instagram: ${instagram}` : '',
      behance ? `Behance: ${behance}` : '',
      website ? `Website: ${website}` : '',
      tiktok ? `TikTok: ${tiktok}` : '',
      idDocumentUrl ? 'ID verification submitted' : '',
      businessLicenseUrl ? 'Business license submitted' : '',
    ]
      .filter(Boolean)
      .join(' | ');

    let uploadedProfilePictureUrl: string | null = null;
    let uploadedCoverPhotoUrl: string | null = null;

    if (profilePictureUpload) {
      const uploadResponse = await DataService.uploadUserProfileImage(user.id, profilePictureUpload.file, 'avatar');
      if (uploadResponse.error || !uploadResponse.publicUrl) {
        setError((uploadResponse.error as any)?.message || 'Unable to upload your profile picture.');
        setIsSaving(false);
        return;
      }

      uploadedProfilePictureUrl = uploadResponse.publicUrl;
    }

    if (coverPhotoUpload) {
      const uploadResponse = await DataService.uploadUserProfileImage(user.id, coverPhotoUpload.file, 'cover');
      if (uploadResponse.error || !uploadResponse.publicUrl) {
        setError((uploadResponse.error as any)?.message || 'Unable to upload your cover photo.');
        setIsSaving(false);
        return;
      }

      uploadedCoverPhotoUrl = uploadResponse.publicUrl;
    }

    // if user picked a point via the picker, prefer those values
    if (locationLatitude && locationLongitude) {
      // already set in resolvedLat/..., but also persist them into variables used below
    }

    const userUpdate = await DataService.updateUser(user.id, {
      role: 'freelancer',
      full_name: displayName.trim(),
      avatar_url: uploadedProfilePictureUrl || user.avatar_url || null,
      cover_url: uploadedCoverPhotoUrl,
      location: location.trim(),
      location_latitude: resolvedLat,
      location_longitude: resolvedLng,
      location_place_id: resolvedPlaceId,
      bio: bio.trim() || null,
      updated_at: new Date().toISOString(),
    } as any);

    if (userUpdate.error) {
      setError((userUpdate.error as any).message || 'Unable to update your account role.');
      setIsSaving(false);
      return;
    }

    // close picker if open
    setIsLocationPickerOpen(false);

    const existingProfile = await DataService.getFreelancerProfile(user.id);
    let freelancerProfileId = existingProfile.data?.id as string | undefined;

    if (existingProfile.data) {
      const updateProfile = await DataService.updateFreelancerProfile(user.id, {
        title: selectedServices[0],
        description: profileDescription,
        hourly_rate: parsedStartingPrice > 0 ? parsedStartingPrice : null,
        skills: [...selectedServices, ...selectedSpecialties],
        styles: selectedSpecialties,
        experience_years: parseExperienceYears(experience),
        portfolio_count: portfolioUploads.length,
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      } as any);

      if (updateProfile.error || !updateProfile.data) {
        setError((updateProfile.error as any)?.message || 'Unable to update freelancer profile.');
        setIsSaving(false);
        return;
      }

      freelancerProfileId = updateProfile.data.id;
    } else {
      const createProfile = await DataService.createFreelancerProfile(user.id, {
        title: selectedServices[0],
        description: profileDescription,
        hourly_rate: parsedStartingPrice > 0 ? parsedStartingPrice : null,
        skills: [...selectedServices, ...selectedSpecialties],
        styles: selectedSpecialties,
        experience_years: parseExperienceYears(experience),
        portfolio_count: portfolioUploads.length,
        is_available: isAvailable,
      } as any);

      if (createProfile.error || !createProfile.data) {
        setError((createProfile.error as any)?.message || 'Unable to create freelancer profile.');
        setIsSaving(false);
        return;
      }

      freelancerProfileId = createProfile.data.id;
    }

    if (freelancerProfileId) {
      const uploadedPortfolioUrls: string[] = [];

      for (const upload of portfolioUploads.slice(0, 20)) {
        const uploadResponse = await DataService.uploadPortfolioImage(user.id, upload.file);
        if (uploadResponse.error || !uploadResponse.publicUrl) {
          setError((uploadResponse.error as any)?.message || 'Unable to upload portfolio photos.');
          setIsSaving(false);
          return;
        }

        uploadedPortfolioUrls.push(uploadResponse.publicUrl);
      }

      const createPortfolioTasks = uploadedPortfolioUrls.map((url, index) =>
        DataService.createPortfolioItem(freelancerProfileId!, {
          title: `${selectedServices[0] || 'Creative'} Portfolio ${index + 1}`,
          description: selectedSpecialties.length > 0 ? `${selectedSpecialties.join(', ')} showcase` : null,
          image_urls: [url],
          project_url: null,
          tools_used: selectedServices,
          featured: index < 3,
        } as any)
      );

      await Promise.all(createPortfolioTasks);
    }

    localStorage.setItem(
      `creativehub:freelancer-onboarding:${user.id}`,
      JSON.stringify({
        completedAt: new Date().toISOString(),
        services: selectedServices,
        specialties: selectedSpecialties,
        experience,
        projectBudgetRange,
        availability,
        workingDays,
        socials: { instagram, behance, website, tiktok },
        verification: { idDocumentUrl, businessLicenseUrl },
      })
    );

    setIsSaving(false);
    navigate('/freelancer-dashboard/portfolio');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8">
      <div className="mx-auto w-full max-w-4xl px-4">
        <button
          onClick={() => (onBack ? onBack() : navigate('/explore'))}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 1 ? 'Back to Explore' : 'Back'}
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Freelancer Onboarding</p>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Build your professional profile</h1>
          <p className="mb-8 text-sm text-gray-600">Complete your setup to unlock freelancer dashboard and AI matching visibility.</p>

          <div className="mb-8 flex items-center gap-2">
            {[1, 2, 3, 4].map((dot) => (
              <div key={dot} className={`h-2 w-full rounded-full ${step >= dot ? 'bg-gray-900' : 'bg-gray-200'}`} />
            ))}
          </div>

          {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Professional Display Name</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  placeholder="Emma Wong"
                />
              </div>
              <ProfileImageDropzone
                label="Profile Picture"
                helper="Square images work best for your avatar."
                upload={profilePictureUpload}
                isDragging={isDraggingProfilePicture}
                previewClassName="h-32 w-32 rounded-full object-cover shadow-lg ring-4 ring-white"
                onDragChange={setIsDraggingProfilePicture}
                onChange={setProfileImageFile}
                onRemove={() => {
                  if (profilePictureUpload) URL.revokeObjectURL(profilePictureUpload.previewUrl);
                  setProfilePictureUpload(null);
                }}
              />
              <ProfileImageDropzone
                label="Cover Photo"
                helper="Use a wide image that represents your work."
                upload={coverPhotoUpload}
                isDragging={isDraggingCoverPhoto}
                previewClassName="h-full max-h-40 w-full rounded-xl object-cover shadow-md"
                onDragChange={setIsDraggingCoverPhoto}
                onChange={setCoverImageFile}
                onRemove={() => {
                  if (coverPhotoUpload) URL.revokeObjectURL(coverPhotoUpload.previewUrl);
                  setCoverPhotoUpload(null);
                }}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">Choose Services (multi-select)</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {services.map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => setSelectedServices((current) => toggle(current, service))}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        selectedServices.includes(service)
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">Specialties</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {availableSpecialties.length === 0 && (
                    <p className="col-span-full text-sm text-gray-500">Select services first to unlock specialty options.</p>
                  )}
                  {availableSpecialties.map((specialty) => (
                    <button
                      key={specialty}
                      type="button"
                      onClick={() => setSelectedSpecialties((current) => toggle(current, specialty))}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        selectedSpecialties.includes(specialty)
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {specialty}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Experience</label>
                  <select
                    value={experience}
                    onChange={(event) => setExperience(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <option value="">Select experience</option>
                    {experienceOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Availability</label>
                  <select
                    value={availability}
                    onChange={(event) => setAvailability(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    {availabilityOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Bio</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="min-h-28 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  placeholder="Fashion photographer with 7 years of experience specializing in editorial and luxury branding."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Starting Price (USD, optional)</label>
                  <input
                    value={startingPrice}
                    onChange={(event) => setStartingPrice(event.target.value)}
                    type="number"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                    placeholder="300"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Typical Project Budget (optional)</label>
                  <input
                    value={projectBudgetRange}
                    onChange={(event) => setProjectBudgetRange(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                    placeholder="$300-$800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Working Days</label>
                  <select
                    value={workingDays}
                    onChange={(event) => setWorkingDays(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    {workingDayOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Location</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                        placeholder="Bangkok, Thailand"
                      />

                      {(liveLocations.length > 0 || locationSearchMessage) && (
                        <div className="absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                          {liveLocations.map((place, idx) => (
                            <button
                              key={`${place.name}-${idx}`}
                              onClick={() => {
                                setLocation(place.name);
                                if (typeof place.lat === 'number') setLocationLatitude(place.lat);
                                if (typeof place.lon === 'number') setLocationLongitude(place.lon);
                                setLocationPlaceId(place.placeId ?? null);
                                setLiveLocations([]);
                                setLocationSearchMessage('');
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50"
                            >
                              <div className="text-sm font-medium text-gray-900">{place.name}</div>
                              {place.detail && <div className="mt-1 text-xs text-gray-500">{place.detail}</div>}
                            </button>
                          ))}

                          {locationSearchMessage && (
                            <div className="px-4 py-3 text-xs text-gray-500">{locationSearchMessage}</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Pick
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Portfolio Photos</p>
                    <p className="mt-1 text-xs text-gray-500">Add at least 5 images. Recommended: 10-20 of your best work.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${portfolioUploads.length >= 5 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {portfolioUploads.length}/5 minimum
                  </span>
                </div>

                <label
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingPortfolio(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingPortfolio(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDraggingPortfolio(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingPortfolio(false);
                    addPortfolioFiles(event.dataTransfer.files);
                  }}
                  className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all ${
                    isDraggingPortfolio
                      ? 'border-gray-900 bg-gray-100 shadow-inner'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-500 hover:bg-white'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) {
                        addPortfolioFiles(event.target.files);
                        event.target.value = '';
                      }
                    }}
                  />
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-lg">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">Drag photos here or choose from your device</p>
                  <p className="mt-2 max-w-md text-sm text-gray-500">JPG, PNG, or WebP images work best. You can add up to 20 portfolio photos.</p>
                  <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-md">
                    <ImagePlus className="h-4 w-4" />
                    Choose Photos
                  </span>
                </label>

                {portfolioUploads.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                    {portfolioUploads.map((upload, index) => (
                      <div key={upload.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
                        <img src={upload.previewUrl} alt={`Portfolio preview ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePortfolioUpload(upload.id)}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-100 shadow-md transition-all hover:bg-gray-900 hover:text-white md:opacity-0 md:group-hover:opacity-100"
                          aria-label={`Remove portfolio photo ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        {index < 3 && (
                          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-gray-700 shadow-sm">
                            Featured
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Instagram (optional)</label>
                  <input value={instagram} onChange={(event) => setInstagram(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Behance (optional)</label>
                  <input value={behance} onChange={(event) => setBehance(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Website (optional)</label>
                  <input value={website} onChange={(event) => setWebsite(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">TikTok (optional)</label>
                  <input value={tiktok} onChange={(event) => setTiktok(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">ID Document URL (optional)</label>
                  <input value={idDocumentUrl} onChange={(event) => setIdDocumentUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Business License URL (optional)</label>
                  <input value={businessLicenseUrl} onChange={(event) => setBusinessLicenseUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" />
                </div>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                After completion, your account is upgraded to freelancer and the dashboard button becomes available.
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3 | 4) : current))}
              disabled={step === 1}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={handleContinue}
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Complete Freelancer Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
      {isLocationPickerOpen && (
        <LeafletLocationPicker
          initialPoint={
            locationLatitude !== null && locationLongitude !== null
              ? {
                  latitude: locationLatitude,
                  longitude: locationLongitude,
                  formattedAddress: location,
                  placeId: locationPlaceId,
                }
              : null
          }
          onCancel={() => setIsLocationPickerOpen(false)}
          onConfirm={(point) => {
            setLocation(point.formattedAddress);
            setLocationLatitude(point.latitude);
            setLocationLongitude(point.longitude);
            setLocationPlaceId(point.placeId);
            setIsLocationPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
