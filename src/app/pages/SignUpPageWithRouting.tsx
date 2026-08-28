import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpPage as SignUpPageComponent, type SignUpSubmission, type AccountType } from '../components/SignUpPage';
import { authService } from '../../lib/authService';
import { setPendingSignupProfile } from '../../lib/pendingSignupProfile';

export function SignUpPageWithRouting() {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth } = useAuth();

  const handleValidateEmail = async (email: string) => {
    const { exists, error } = await authService.checkEmailExists(email);

    if (error) {
      return error.message || 'Unable to validate email right now. Please try again.';
    }

    if (exists) {
      return 'This email is already registered. Please sign in instead.';
    }

    return null;
  };

  const handleSignUp = async (data: SignUpSubmission) => {
    const destination = data.role === 'freelancer' ? '/onboarding/freelancer' : '/onboarding/client';
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    // The onboarding page this redirects to can mount before signUp() (and
    // its avatar upload) finishes — see pendingSignupProfile.ts — so hand it
    // what we already know synchronously, ahead of calling signUp() at all.
    setPendingSignupProfile({
      fullName,
      avatarPreviewUrl: data.avatarFile ? URL.createObjectURL(data.avatarFile) : null,
    });

    // Avatar/location are resolved inside signUp() itself (one atomic write)
    // rather than as separate calls after it returns — the mandatory
    // onboarding gate redirects the instant the auth state flips to
    // signed-in, which would otherwise race ahead of any writes made here.
    await signUp(data.email, data.password, fullName, data.role, data.gender, data.avatarFile, data.country, data.city);

    // The mandatory-onboarding route gate in App.tsx also lands the user
    // here based on user.role/onboardingCompleted, so this navigate() is a
    // fast path rather than the only way there — no race to worry about.
    navigate(destination);
  };

  const handleOAuthSignUp = async (provider: 'google' | 'facebook', _role: AccountType) => {
    // Supabase OAuth is a full-page redirect; the role picked here can't be
    // threaded through it. New OAuth users default to role 'client'
    // (authService.ensureUserProfile) and the onboarding gate then routes
    // them to /onboarding/client regardless of what they intended — they
    // can upgrade to freelancer afterwards via "Become a Freelancer".
    await signInWithOAuth(provider, `${window.location.origin}/explore`);
  };

  return (
    <SignUpPageComponent
      onSignUp={handleSignUp}
      onGoToLogin={() => navigate('/login')}
      onValidateEmail={handleValidateEmail}
      onOAuthSignUp={handleOAuthSignUp}
    />
  );
}
