import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { authService } from '../../lib/authService';
import { supabase } from '../../lib/supabase';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Supabase v2 parses the recovery token out of the URL automatically on
    // client init and fires a PASSWORD_RECOVERY auth event once the session is
    // established — that can land after this effect's initial getSession()
    // check runs, so we listen for it rather than trying to consume the URL
    // ourselves (the v1 getSessionFromUrl API this used to call was removed).
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setRecoverySessionReady(true);
      }
    });

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error || !data?.session) {
          setRecoverySessionReady(false);
          setError('No password recovery session found. Please open the link from the password reset email in this browser.');
          return;
        }

        setRecoverySessionReady(true);
      } catch (err) {
        setRecoverySessionReady(false);
      }
    })();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError('Please enter a password of at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (!recoverySessionReady) {
      setError('Password recovery session not established. Please open the reset link from your email in this browser.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await authService.updatePassword(password);
      if (error) {
        setError((error as any).message || 'Unable to update password.');
      } else {
        // On success, navigate to login
        navigate('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Reset your password</h2>
        <p className="text-sm text-gray-600 mb-4">Enter a new password for your account.</p>
        {error && <div className="mb-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-2 text-white font-semibold"
            >
              {loading ? 'Updating...' : 'Set password'}
            </button>
          </div>
        </form>
        {!recoverySessionReady && (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm text-gray-600 mb-2">Can't open the recovery link? Request a new one:</p>
            {resendMessage && <div className="mb-2 text-sm text-green-700">{resendMessage}</div>}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Your email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2"
              />
              <button
                onClick={async () => {
                  setResendMessage(null);
                  setResendLoading(true);
                  try {
                    if (!resendEmail) {
                      setResendMessage('Please enter your email.');
                      setResendLoading(false);
                      return;
                    }
                    const redirectTo = `${window.location.origin}/reset-password`;
                    const { error } = await authService.requestPasswordReset(resendEmail, redirectTo);
                    if (error) {
                      setResendMessage(error.message || 'Unable to send reset email.');
                    } else {
                      setResendMessage('Password reset email sent. Check your inbox.');
                    }
                  } catch (err) {
                    setResendMessage(err instanceof Error ? err.message : 'Unknown error');
                  }
                  setResendLoading(false);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold"
              >
                {resendLoading ? 'Sending...' : 'Resend'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">If you opened the link in a different browser or device, open it here or copy the link into this browser.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
