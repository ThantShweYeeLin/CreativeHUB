import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage as LoginPageComponent } from '../components/LoginPage';

export function LoginPageWithRouting() {
  const navigate = useNavigate();
  const { signIn, requestPasswordReset, signInWithOAuth } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    await signIn(email, password);
    navigate('/explore');
  };

  const handleForgotPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/login`;
    await requestPasswordReset(email, redirectTo);
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    const redirectTo = `${window.location.origin}/explore`;
    await signInWithOAuth(provider, redirectTo);
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
