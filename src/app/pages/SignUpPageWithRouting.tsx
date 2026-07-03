import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpPage as SignUpPageComponent } from '../components/SignUpPage';
import { authService } from '../../lib/authService';

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

  const handleSignUp = async (fullName: string, email: string, password: string, role: 'freelancer' | 'client') => {
    await signUp(email, password, fullName, role);
    navigate(role === 'freelancer' ? '/onboarding/freelancer' : '/onboarding/client');
  };

  const handleOAuthSignUp = async (provider: 'google' | 'facebook') => {
    const redirectTo = `${window.location.origin}/explore`;
    await signInWithOAuth(provider, redirectTo);
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
