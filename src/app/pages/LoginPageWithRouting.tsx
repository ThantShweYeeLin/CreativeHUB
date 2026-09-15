import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage as LoginPageComponent } from '../components/LoginPage';

export function LoginPageWithRouting() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, requestPasswordReset, signInWithOAuth } = useAuth();

  // A guest who hit a soft-gate (e.g. AuthPromptModal) mid-browse arrives
  // here with `from` set to where they were, so logging in - as opposed to
  // signing up, which always goes through onboarding first - can return them
  // to exactly what they were looking at instead of dumping them on Explore.
  const redirectTo = (location.state as { from?: string } | null)?.from || '/explore';

  const handleLogin = async (email: string, password: string) => {
    try {
      await signIn(email, password);
      navigate(redirectTo);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      await requestPasswordReset(email, redirectTo);
    } catch (err) {
      console.error('Forgot password failed:', err);
      throw err;
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    try {
      await signInWithOAuth(provider, `${window.location.origin}/explore`);
    } catch (err) {
      console.error('OAuth login failed:', err);
      throw err;
    }
  };

  return (
    <LoginPageComponent
      onLogin={handleLogin}
      onGoToSignUp={() => navigate('/signup')}
      onForgotPassword={handleForgotPassword}
      onOAuthLogin={handleOAuthLogin}
    />
  );
}
