import { useParams } from 'react-router';
import { AdminLayout } from './AdminLayout';
import { AdminBookingDetail, useAdminBookingDetail } from './AdminBookingDetail';

export function AdminDisputeDetailPage() {
  const { id } = useParams();
  const { booking, events, confirmations, attendanceReport, signedUrls, isLoading, error, refresh } = useAdminBookingDetail(id);

  return (
    <AdminLayout
      section="disputes"
      breadcrumb={[{ label: 'Disputes', to: '/admin/disputes' }, { label: booking?.project_name || 'Loading...' }]}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error || !booking ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Dispute not found.'}</div>
      ) : (
        <AdminBookingDetail
          booking={booking}
          events={events}
          confirmations={confirmations}
          attendanceReport={attendanceReport}
          signedUrls={signedUrls}
          showResolutionControls={true}
          onResolved={refresh}
        />
      )}
    </AdminLayout>
  );
}
