import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage as LoginPageComponent } from '../components/LoginPage';

export function LoginPageWithRouting() {
  const navigate = useNavigate();
  const { signIn, requestPasswordReset, signInWithOAuth } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await signIn(email, password);
      navigate('/explore');
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
