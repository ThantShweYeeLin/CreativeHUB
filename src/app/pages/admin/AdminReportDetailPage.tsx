import { useParams } from 'react-router';
import { AdminLayout } from './AdminLayout';
import { AdminReportDetail } from './AdminReportDetail';

export function AdminReportDetailPage() {
  const { id } = useParams();
  return (
    <AdminLayout section="reports" breadcrumb={[{ label: 'Reports', to: '/admin/reports' }, { label: 'Report' }]}>
      {id && <AdminReportDetail reportId={id} />}
    </AdminLayout>
  );
}
