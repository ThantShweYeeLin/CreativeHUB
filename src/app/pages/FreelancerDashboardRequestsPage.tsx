import { useNavigate } from 'react-router';
import { FreelancerDashboard } from './FreelancerDashboard';

export function FreelancerDashboardRequestsPage() {
  const navigate = useNavigate();
  return <FreelancerDashboard onBack={() => navigate('/explore')} section="requests" />;
}
