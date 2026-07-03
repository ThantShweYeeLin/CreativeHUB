import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpPage as SignUpPageComponent } from '../components/SignUpPage';

export function SignUpPageWithRouting() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSignUp = async (fullName: string, email: string, password: string, role: 'freelancer' | 'client') => {
    try {
      await signUp(email, password, fullName, role);
      navigate(role === 'freelancer' ? '/onboarding/freelancer' : '/onboarding/client');
    } catch (error) {
      console.error('Sign up failed:', error);
      // Re-throw so the SignUpPage component can catch and display the message
      throw error;
    }
  };

  return (
    <SignUpPageComponent
      onSignUp={handleSignUp}
      onGoToLogin={() => navigate('/login')}
    />
  );
}
