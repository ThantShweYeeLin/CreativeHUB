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

  return (
    <LoginPageComponent
      onLogin={handleLogin}
      onGoToSignUp={() => navigate('/signup')}
      onForgotPassword={handleForgotPassword}
      onOAuthLogin={handleOAuthLogin}
    />
  );
}
