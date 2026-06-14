import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage as LoginPageComponent } from '../components/LoginPage';

export function LoginPageWithRouting() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await signIn(email, password);
      navigate('/explore');
    } catch (error) {
      console.error('Login failed:', error);
      // Error will be displayed by the LoginPage component
    }
  };

  return (
    <LoginPageComponent
      onLogin={handleLogin}
      onGoToSignUp={() => navigate('/signup')}
    />
  );
}
