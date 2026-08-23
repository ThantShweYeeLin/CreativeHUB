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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Attempt to extract and establish the recovery session from the URL
        const { data, error } = await supabase.auth.getSessionFromUrl();
        if (!mounted) return;

        if (error) {
          // No recovery token found in URL — check if a normal session exists
          const sessionResp = await supabase.auth.getSession();
          if (sessionResp?.data?.session) {
            setRecoverySessionReady(true);
          } else {
            setRecoverySessionReady(false);
            setError('No password recovery session found. Please open the link from the password reset email in this browser.');
          }
          return;
        }

        if (data?.session) {
          setRecoverySessionReady(true);
        } else {
          setRecoverySessionReady(false);
          setError('Unable to establish recovery session from the URL.');
        }
      } catch (err) {
        setRecoverySessionReady(false);
      }
    })();

    return () => {
      mounted = false;
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
      </div>
    </div>
  );
}

export default ResetPasswordPage;
