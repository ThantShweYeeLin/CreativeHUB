import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';

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

export function BecomeFreelancerPage({ onBack }: BecomeFreelancerPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [projectBudgetRange, setProjectBudgetRange] = useState('');
  const [availability, setAvailability] = useState('Available');
  const [workingDays, setWorkingDays] = useState('Flexible');
  const [location, setLocation] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>(['', '', '', '', '']);
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
      const validPortfolio = portfolioUrls.map((item) => item.trim()).filter(Boolean);
      if (validPortfolio.length < 5) {
        setError('Please add at least 5 portfolio image URLs to continue.');
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

    const validPortfolio = portfolioUrls.map((item) => item.trim()).filter(Boolean);
    if (validPortfolio.length < 5) {
      setError('Please add at least 5 portfolio image URLs.');
      return;
    }

    setError(null);
    setIsSaving(true);

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

    const userUpdate = await DataService.updateUser(user.id, {
      role: 'freelancer',
      full_name: displayName.trim(),
      avatar_url: profilePictureUrl.trim() || null,
      cover_url: coverPhotoUrl.trim() || null,
      location: location.trim(),
      bio: bio.trim() || null,
      updated_at: new Date().toISOString(),
    } as any);

    if (userUpdate.error) {
      setError((userUpdate.error as any).message || 'Unable to update your account role.');
      setIsSaving(false);
      return;
    }

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
        portfolio_count: validPortfolio.length,
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
        portfolio_count: validPortfolio.length,
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
      const createPortfolioTasks = validPortfolio.slice(0, 20).map((url, index) =>
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
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Profile Picture URL</label>
                <input
                  value={profilePictureUrl}
                  onChange={(event) => setProfilePictureUrl(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Cover Photo URL</label>
                <input
                  value={coverPhotoUrl}
                  onChange={(event) => setCoverPhotoUrl(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  placeholder="https://..."
                />
              </div>
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
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                    placeholder="Bangkok, Thailand"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Portfolio Upload URLs (minimum 5, recommended 10-20)</p>
                <div className="space-y-2">
                  {portfolioUrls.map((url, index) => (
                    <input
                      key={index}
                      value={url}
                      onChange={(event) =>
                        setPortfolioUrls((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                      placeholder={`Portfolio image URL ${index + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPortfolioUrls((current) => [...current, ''])}
                  className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  Add Another URL
                </button>
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
    </div>
  );
}
