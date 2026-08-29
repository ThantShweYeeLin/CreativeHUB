import { useNavigate } from 'react-router';
import { FreelancerDashboard } from './FreelancerDashboard';

export function FreelancerDashboardTeamsPage() {
  const navigate = useNavigate();
  return <FreelancerDashboard onBack={() => navigate('/explore')} section="teams" />;
}
