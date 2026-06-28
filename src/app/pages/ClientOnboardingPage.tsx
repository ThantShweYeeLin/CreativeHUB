import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';

const clientInterests = [
  'Photography',
  'Makeup',
  'Hair Styling',
  'Graphic Design',
  'Videography',
  'Fashion Design',
  'Event Decoration',
] as const;

const budgetBands = ['Under $100', '$100-$500', '$500-$1000', '$1000+'] as const;

const favoriteStyles = [
  'Minimalist',
  'Luxury',
  'Vintage',
  'Dark Moody',
  'Bright & Airy',
  'Editorial',
  'Natural',
  'Modern',
] as const;

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function ClientOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [companyName, setCompanyName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [budgetPreference, setBudgetPreference] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = () => {
    setError(null);

    if (step === 1) {
      if (!displayName.trim()) {
        setError('Display name is required.');
        return;
      }
      if (!location.trim()) {
        setError('Location is required.');
        return;
      }
    }

    setStep((current) => (current < 3 ? ((current + 1) as 1 | 2 | 3) : current));
  };

  const handleFinish = async () => {
    if (!user?.id) {
      setError('Please sign in again to complete onboarding.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const bioSegments = [
      companyName ? `Company: ${companyName}` : '',
      phone ? `Phone: ${phone}` : '',
      interests.length > 0 ? `Interests: ${interests.join(', ')}` : '',
      budgetPreference ? `Budget Preference: ${budgetPreference}` : '',
      styles.length > 0 ? `Favorite Styles: ${styles.join(', ')}` : '',
    ].filter(Boolean);

    const response = await DataService.updateUser(user.id, {
      full_name: displayName.trim(),
      location: location.trim(),
      avatar_url: profilePhotoUrl.trim() || null,
      bio: bioSegments.join(' | ') || null,
      updated_at: new Date().toISOString(),
    } as any);

    if (response.error) {
      setError((response.error as any).message || 'Unable to save onboarding details.');
      setIsSaving(false);
      return;
    }

    localStorage.setItem(
      `creativehub:client-onboarding:${user.id}`,
      JSON.stringify({
        completedAt: new Date().toISOString(),
        interests,
        budgetPreference,
        styles,
        companyName,
        phone,
      })
    );

    setIsSaving(false);
    navigate('/explore');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <button
          onClick={() => navigate('/explore')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Skip for now
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Client Onboarding</p>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Set up your client profile</h1>
          <p className="mb-8 text-sm text-gray-600">You can edit these details later in your profile settings.</p>

          <div className="mb-8 flex items-center gap-2">
            {[1, 2, 3].map((dot) => (
              <div key={dot} className={`h-2 w-full rounded-full ${step >= dot ? 'bg-gray-900' : 'bg-gray-200'}`} />
            ))}
          </div>

          {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Display Name</label>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                placeholder="Your name"
              />

              <label className="block text-sm font-semibold text-gray-700">Company Name (optional)</label>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                placeholder="Studio or company"
              />

              <label className="block text-sm font-semibold text-gray-700">Location</label>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                placeholder="Bangkok, Thailand"
              />

              <label className="block text-sm font-semibold text-gray-700">Phone Number (optional)</label>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                placeholder="+66..."
              />

              <label className="block text-sm font-semibold text-gray-700">Profile Photo URL (optional)</label>
              <input
                value={profilePhotoUrl}
                onChange={(event) => setProfilePhotoUrl(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                placeholder="https://..."
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">What creative services are you usually looking for?</p>
              <div className="grid grid-cols-2 gap-3">
                {clientInterests.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => setInterests((current) => toggle(current, interest))}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      interests.includes(interest)
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">Budget Preference (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  {budgetBands.map((band) => (
                    <button
                      key={band}
                      type="button"
                      onClick={() => setBudgetPreference(band)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        budgetPreference === band
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {band}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">Favorite Styles (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  {favoriteStyles.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setStyles((current) => toggle(current, style))}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        styles.includes(style)
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : current))}
              disabled={step === 1}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              Back
            </button>

            {step < 3 ? (
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
                {isSaving ? 'Saving...' : 'Finish Onboarding'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
