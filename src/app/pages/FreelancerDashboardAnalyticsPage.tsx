import { useNavigate } from 'react-router';
import { FreelancerDashboard } from './FreelancerDashboard';

export function FreelancerDashboardAnalyticsPage() {
  const navigate = useNavigate();
  return <FreelancerDashboard onBack={() => navigate('/explore')} section="analytics" />;
}
