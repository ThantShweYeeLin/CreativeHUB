import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpPage as SignUpPageComponent, type SignUpSubmission, type AccountType } from '../components/SignUpPage';
import { authService } from '../../lib/authService';
import { DataService } from '../../lib/dataService';
import { geocodeAddress } from '../../lib/osmGeocoding';

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
    const newUser = await signUp(data.email, data.password, fullName, data.role, data.gender);

    if (data.country || data.city) {
      const resolved = await geocodeAddress([data.city, data.country].filter(Boolean).join(', ')).catch(() => null);
      if (resolved) {
        await DataService.updateUser(newUser.id, {
          location: [data.city, data.country].filter(Boolean).join(', '),
          location_latitude: resolved.latitude,
          location_longitude: resolved.longitude,
          location_place_id: resolved.placeId,
        });
      }
    }

    if (data.avatarFile) {
      const upload = await DataService.uploadUserProfileImage(newUser.id, data.avatarFile, 'avatar');
      if (upload.publicUrl) {
        await DataService.updateUser(newUser.id, { avatar_url: upload.publicUrl });
      }
    }

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
