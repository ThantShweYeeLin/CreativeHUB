import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check } from 'lucide-react';
import logoImage from '../../imports/logo.png';

interface SignUpPageProps {
  onSignUp: () => void;
  onGoToLogin: () => void;
}

type AccountType = 'client' | 'freelancer';

export function SignUpPage({ onSignUp, onGoToLogin }: SignUpPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', 'bg-red-400', 'bg-yellow-400', 'bg-green-500'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email.'); return; }
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) { setError('Please enter a password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!agreed) { setError('Please agree to the Terms & Privacy Policy.'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); onSignUp(); }, 1200);
  };

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

        <div className="max-w-sm w-full mx-auto lg:mx-0">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 2 && <div className={`w-12 h-0.5 ${step > s ? 'bg-gray-900' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <span className="ml-2 text-xs text-gray-500">{step === 1 ? 'Your info' : 'Set password'}</span>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {step === 1 ? 'Create account' : 'Set your password'}
          </h2>
          <p className="text-gray-500 mb-8">
            {step === 1 ? 'Join CreativeHUB AI today' : `Almost done, ${fullName.split(' ')[0]}!`}
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              {/* Account type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">I am a</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['client', 'freelancer'] as AccountType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAccountType(type)}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                        accountType === type
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {type === 'client' ? '👤 Client' : '🎨 Freelancer'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
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
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold hover:bg-black transition-all flex items-center justify-center gap-2 mt-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">or sign up with</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[{ name: 'Google', icon: 'G' }, { name: 'Facebook', icon: 'f' }].map(({ name, icon }) => (
                  <button key={name} type="button" onClick={onSignUp}
                    className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold text-gray-700">
                    <span className="font-bold">{icon}</span> {name}
                  </button>
                ))}
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <button type="button" onClick={() => { setStep(1); setError(''); }}
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
