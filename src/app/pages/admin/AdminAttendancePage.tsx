import { AdminLayout } from './AdminLayout';
import { AttendanceReportsTab } from './AttendanceReportsTab';

export function AdminAttendancePage() {
  return (
    <AdminLayout section="attendance">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500">Mutual attendance confirmations and no-show reports</p>
        </div>
        <AttendanceReportsTab />
      </div>
    </AdminLayout>
  );
}
