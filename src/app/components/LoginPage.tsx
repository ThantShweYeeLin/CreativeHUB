import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import logoImage from '../../imports/logo.png';
import { authService } from '../../lib/authService';
import { AuthShowcase } from './AuthShowcase';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoToSignUp: () => void;
  onForgotPassword: (email: string) => Promise<void>;
  onOAuthLogin: (provider: 'google' | 'facebook') => Promise<void>;
}

export function LoginPage({ onLogin, onGoToSignUp, onForgotPassword, onOAuthLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email first, then click Forgot password.');
      return;
    }

    setForgotLoading(true);
    try {
      await onForgotPassword(email.trim());
      setSuccess('Password reset email sent. Please check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    setError('');
    setSuccess('');
    setOauthLoadingProvider(provider);
    try {
      await onOAuthLogin(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to continue with ${provider}.`);
      setOauthLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left panel - branding */}
      <AuthShowcase
        variant="login"
        headline={<>Connect with<br />top creative<br />talent.</>}
        subtitle="Photographers, decorators, DJs, and more — everything you need for your wedding, birthday, or next big event."
      />

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <img src={logoImage} alt="CreativeHUB AI" className="h-12 w-12 rounded-full object-cover" />
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to your CreativeHUB account</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              {success}
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
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  disabled={forgotLoading}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-60"
                >
                  {forgotLoading ? 'Sending...' : 'Forgot password?'}
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
                onClick={() => void handleOAuthLogin(name.toLowerCase() as 'google' | 'facebook')}
                disabled={oauthLoadingProvider !== null}
                className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold text-gray-700 disabled:opacity-60"
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
