import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpPage as SignUpPageComponent, type SignUpSubmission, type AccountType } from '../components/SignUpPage';
import { authService } from '../../lib/authService';
import { DataService } from '../../lib/dataService';
import { geocodeAddress } from '../../lib/osmGeocoding';

// Stashed right before account creation so the authenticated route tree
// (which mounts as soon as the auth state flips, ahead of this component's
// own post-signup navigate() call) knows to land the new user on their
// role-specific onboarding flow instead of defaulting to /explore.
export const POST_SIGNUP_REDIRECT_KEY = 'creativehub:post-signup-redirect';

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
    sessionStorage.setItem(POST_SIGNUP_REDIRECT_KEY, destination);

    try {
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

      navigate(destination);
    } catch (error) {
      sessionStorage.removeItem(POST_SIGNUP_REDIRECT_KEY);
      console.error('Sign up failed:', error);
      throw error;
    }
  };

  const handleOAuthSignUp = async (provider: 'google' | 'facebook', role: AccountType) => {
    const destination = role === 'freelancer' ? '/onboarding/freelancer' : '/onboarding/client';
    sessionStorage.setItem(POST_SIGNUP_REDIRECT_KEY, destination);

    try {
      await signInWithOAuth(provider, `${window.location.origin}/explore`);
    } catch (error) {
      sessionStorage.removeItem(POST_SIGNUP_REDIRECT_KEY);
      console.error('OAuth sign up failed:', error);
      throw error;
    }
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
