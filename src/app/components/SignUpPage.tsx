import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, ArrowLeft, Check, Briefcase, Search, Camera } from 'lucide-react';
import logoImage from '../../imports/logo.png';
import type { ImageUpload } from '../../components/common/ProfileImageDropzone';
import type { Gender } from '../../lib/database.types';
import { CountrySelect } from '../../components/common/CountrySelect';
import { CitySelect } from '../../components/common/CitySelect';
import { PhoneInput } from '../../components/common/PhoneInput';
import { findCountryByCode } from '../../lib/geoData';
import { validatePhoneForCountry } from '../../lib/phone';

export type AccountType = 'client' | 'freelancer';

export interface SignUpSubmission {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164, e.g. "+66812345678". */
  phone: string;
  password: string;
  role: AccountType;
  gender: Gender;
  avatarFile: File | null;
  country: string;
  countryCode: string;
  city: string;
}

interface SignUpPageProps {
  onSignUp: (data: SignUpSubmission) => Promise<void>;
  onGoToLogin: () => void;
  onValidateEmail?: (email: string) => Promise<string | null>;
  onOAuthSignUp?: (provider: 'google' | 'facebook', role: AccountType) => Promise<void>;
}

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'lgbtq_plus', label: 'LGBTQ+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function SignUpPage({ onSignUp, onGoToLogin, onValidateEmail, onOAuthSignUp }: SignUpPageProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [gender, setGender] = useState<Gender | ''>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryIsoCode, setCountryIsoCode] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [avatarUpload, setAvatarUpload] = useState<ImageUpload | null>(null);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', 'bg-red-400', 'bg-yellow-400', 'bg-green-500'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  const handleSelectRole = (role: AccountType) => {
    setAccountType(role);
    setError('');
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your first and last name.'); return; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email.'); return; }
    if (!countryIsoCode) { setError('Please select your country.'); return; }
    if (!city || !city.trim()) { setError('Please select your city.'); return; }
    const phoneResult = validatePhoneForCountry(phone, countryIsoCode);
    if (!phoneResult.isValid) { setError('Please enter a valid phone number for the selected country.'); return; }
    if (!gender) { setError('Please select a gender.'); return; }

    if (onValidateEmail) {
      setIsCheckingEmail(true);
      const validationError = await onValidateEmail(email.trim());
      setIsCheckingEmail(false);

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setStep(3);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!accountType || !gender) {
      setError('Please go back and complete the earlier steps.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms & Privacy Policy.');
      return;
    }

    if (!countryIsoCode || !city) {
      setError('Please go back and complete your location and phone number.');
      return;
    }
    const phoneResult = validatePhoneForCountry(phone, countryIsoCode);
    if (!phoneResult.isValid || !phoneResult.e164) {
      setError('Please go back and enter a valid phone number.');
      return;
    }
    const selectedCountry = await findCountryByCode(countryIsoCode);

    setLoading(true);
    try {
      await onSignUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        phone: phoneResult.e164,
        password,
        role: accountType,
        gender,
        avatarFile: avatarUpload?.file || null,
        country: selectedCountry?.name || '',
        countryCode: countryIsoCode,
        city: city.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: 'google' | 'facebook') => {
    if (!onOAuthSignUp || !accountType) {
      setError('Please choose an account type first.');
      return;
    }

    setError('');
    setOauthLoadingProvider(provider);
    try {
      await onOAuthSignUp(provider, accountType);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to continue with ${provider}.`);
      setOauthLoadingProvider(null);
    }
  };

  const stepLabels = ['Role', 'Your info', 'Set password'];

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #ffffff 0%, transparent 60%), radial-gradient(circle at 20% 80%, #ffffff 0%, transparent 40%)' }}
        />
        <img src={logoImage} alt="CreativeHUB AI" className="h-14 w-auto object-contain" />
        <div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Start your<br />creative<br />journey.
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
            Join thousands of creatives and clients building amazing projects together.
          </p>
          <div className="mt-10 space-y-4">
            {[
              'Book verified professional creatives',
              'Deposit protection on every booking',
              'AI-powered matching technology',
              'Premium subscription benefits',
            ].map(item => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-white text-sm italic leading-relaxed mb-3">
            "CreativeHUB AI connected me with the perfect photographer for my fashion shoot. The deposit protection gave me total peace of mind."
          </p>
          <div className="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1671454265388-0c0672798125?w=40&h=40&fit=crop" alt="" className="w-9 h-9 rounded-full object-cover" />
            <div>
              <div className="text-white text-sm font-semibold">Isabella Rodriguez</div>
              <div className="text-gray-500 text-xs">Fashion Designer</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12 overflow-y-auto">
        <div className="lg:hidden mb-10">
          <img src={logoImage} alt="CreativeHUB AI" className="h-12 w-auto object-contain" />
        </div>

        <div className={`w-full mx-auto lg:mx-0 ${step === 2 ? 'max-w-md' : 'max-w-sm'}`}>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-gray-900' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <span className="ml-2 text-xs text-gray-500">{stepLabels[step - 1]}</span>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">What are you here to do?</h2>
              <p className="text-gray-500 mb-8">Join CreativeHUB AI today</p>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => handleSelectRole('client')}
                  className="w-full flex items-start gap-4 rounded-2xl border-2 border-gray-200 p-5 text-left transition-all hover:border-gray-900 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <Search className="h-6 w-6 text-gray-900" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">I'm looking for creative professionals</p>
                    <p className="mt-1 text-sm text-gray-500">Sign up as a Client</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('freelancer')}
                  className="w-full flex items-start gap-4 rounded-2xl border-2 border-gray-200 p-5 text-left transition-all hover:border-gray-900 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <Briefcase className="h-6 w-6 text-gray-900" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">I'm offering creative services</p>
                    <p className="mt-1 text-sm text-gray-500">Sign up as a Freelancer</p>
                  </div>
                </button>
              </div>

              <div className="relative mt-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">or sign up with</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[{ name: 'Google', icon: 'G' }, { name: 'Facebook', icon: 'f' }].map(({ name, icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => void handleOAuthSignUp(name.toLowerCase() as 'google' | 'facebook')}
                    disabled={oauthLoadingProvider !== null || !accountType}
                    title={!accountType ? 'Choose an account type above first' : undefined}
                    className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold text-gray-700 disabled:opacity-40"
                  >
                    {oauthLoadingProvider === name.toLowerCase() ? (
                      <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="font-bold">{icon}</span>
                    )}
                    {name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-gray-400">Choose Client or Freelancer above to continue with Google or Facebook.</p>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900">Create your account</h2>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-900"
                >
                  <ArrowLeft className="w-3 h-3" /> {accountType === 'client' ? 'Client' : 'Freelancer'}
                </button>
              </div>
              <p className="-mt-3 text-sm text-gray-500">A few basics to get you started.</p>

              <div className="flex items-center gap-4">
                <label
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDraggingAvatar(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingAvatar(false);
                    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
                    if (file) {
                      if (avatarUpload) URL.revokeObjectURL(avatarUpload.previewUrl);
                      setAvatarUpload({ file, previewUrl: URL.createObjectURL(file) });
                    }
                  }}
                  className={`relative flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-all ${
                    isDraggingAvatar ? 'border-gray-900 bg-gray-100' : 'border-gray-300 bg-gray-50 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (avatarUpload) URL.revokeObjectURL(avatarUpload.previewUrl);
                        setAvatarUpload({ file, previewUrl: URL.createObjectURL(file) });
                      }
                      e.target.value = '';
                    }}
                  />
                  {avatarUpload ? (
                    <img src={avatarUpload.previewUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-5 w-5 text-gray-400" />
                  )}
                </label>
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">Profile photo</p>
                  <p className="text-xs text-gray-400">Optional — add it now or later.</p>
                </div>
                {avatarUpload && (
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(avatarUpload.previewUrl); setAvatarUpload(null); }}
                    className="ml-auto text-xs font-semibold text-gray-400 hover:text-gray-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                  <CountrySelect
                    value={countryIsoCode}
                    onChange={(isoCode) => {
                      setCountryIsoCode(isoCode);
                      setCity(null);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                  <CitySelect countryIsoCode={countryIsoCode} value={city} onChange={setCity} required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <PhoneInput countryIsoCode={countryIsoCode} value={phone} onChange={setPhone} required />
                <p className="mt-1.5 text-xs text-gray-400">We keep this private — it's never shown on your public profile unless you choose to share it.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                <div className="flex flex-wrap gap-2">
                  {GENDER_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGender(option.value)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                        gender === option.value
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isCheckingEmail}
                className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold hover:bg-black transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCheckingEmail ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Set your password</h2>
              <p className="text-gray-500 mb-6">Almost done, {firstName || 'there'}!</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${passwordStrength >= i ? strengthColors[passwordStrength] : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-semibold ${passwordStrength === 1 ? 'text-red-400' : passwordStrength === 2 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {strengthLabels[passwordStrength]}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  />
                  {confirmPassword && (
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center ${password === confirmPassword ? 'bg-green-500' : 'bg-red-400'}`}>
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <div
                  onClick={() => setAgreed(!agreed)}
                  className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all mt-0.5 cursor-pointer ${agreed ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}
                >
                  {agreed && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-600">
                  I agree to the{' '}
                  <span className="font-semibold text-gray-900 hover:underline cursor-pointer">Terms of Service</span>
                  {' '}and{' '}
                  <span className="font-semibold text-gray-900 hover:underline cursor-pointer">Privacy Policy</span>
                </span>
              </label>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => { setStep(2); setError(''); }}
                  className="flex-1 py-3.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all">
                  Back
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-gray-900 text-white py-3.5 rounded-xl font-semibold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                  {loading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><Check className="w-4 h-4" /> Create Account</>
                  }
                </button>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button onClick={onGoToLogin} className="font-semibold text-gray-900 hover:underline">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
