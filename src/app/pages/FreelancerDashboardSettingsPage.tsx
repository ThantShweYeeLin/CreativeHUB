import { useNavigate } from 'react-router';
import { FreelancerDashboard } from './FreelancerDashboard';

export function FreelancerDashboardSettingsPage() {
  const navigate = useNavigate();
  return <FreelancerDashboard onBack={() => navigate('/explore')} section="settings" />;
}
