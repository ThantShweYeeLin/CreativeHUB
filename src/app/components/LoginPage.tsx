import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import logoImage from '../../imports/logo.png';

interface LoginPageProps {
  onLogin: () => void;
  onGoToSignUp: () => void;
}

export function LoginPage({ onLogin, onGoToSignUp }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #ffffff 0%, transparent 60%), radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 40%)' }}
        />
        <img src={logoImage} alt="CreativeHUB AI" className="h-14 w-auto object-contain" />
        <div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Connect with<br />top creative<br />talent.
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
            Discover photographers, makeup artists, and models. Book, collaborate, and create together.
          </p>
          <div className="flex gap-8 mt-10">
            {[['500+', 'Freelancers'], ['2K+', 'Bookings'], ['4.9★', 'Rating']].map(([num, label]) => (
              <div key={label}>
                <div className="text-2xl font-bold text-white">{num}</div>
                <div className="text-gray-500 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          {['https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=120&h=120&fit=crop',
            'https://images.unsplash.com/photo-1596704182101-542876d47a68?w=120&h=120&fit=crop',
            'https://images.unsplash.com/photo-1706661912295-bd1dc10ffe7f?w=120&h=120&fit=crop',
            'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=120&h=120&fit=crop',
          ].map((src, i) => (
            <div key={i} className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-white/10">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white text-sm font-semibold">+496</div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <img src={logoImage} alt="CreativeHUB AI" className="h-12 w-auto object-contain" />
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to your CreativeHUB account</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <button type="button" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">or continue with</div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { name: 'Google', icon: 'G' },
              { name: 'Facebook', icon: 'f' },
            ].map(({ name, icon }) => (
              <button
                key={name}
                type="button"
                onClick={onLogin}
                className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold text-gray-700"
              >
                <span className="font-bold">{icon}</span> {name}
              </button>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <button onClick={onGoToSignUp} className="font-semibold text-gray-900 hover:underline">
              Sign up free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
