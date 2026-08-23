import { useNavigate, useLocation } from 'react-router';
import { FreelancerDashboard } from './FreelancerDashboard';

export function FreelancerDashboardRequestsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const openRequestId = (location.state as any)?.openRequestId as string | undefined;

  return (
    <FreelancerDashboard onBack={() => navigate('/explore')} section="requests" initialOpenRequestId={openRequestId} />
  );
}
