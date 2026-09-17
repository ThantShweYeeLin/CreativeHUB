import { useParams } from 'react-router';
import { AdminLayout } from './AdminLayout';
import { AdminTicketDetail } from './AdminTicketDetail';

export function AdminTicketDetailPage() {
  const { id } = useParams();
  return (
    <AdminLayout section="reports" breadcrumb={[{ label: 'Reports', to: '/admin/reports' }, { label: 'Ticket' }]}>
      {id && <AdminTicketDetail ticketId={id} />}
    </AdminLayout>
  );
}
