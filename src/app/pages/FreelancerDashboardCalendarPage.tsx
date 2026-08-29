import { useNavigate } from 'react-router';
import { FreelancerDashboard } from './FreelancerDashboard';

export function FreelancerDashboardCalendarPage() {
  const navigate = useNavigate();
  return <FreelancerDashboard onBack={() => navigate('/explore')} section="calendar" />;
}
