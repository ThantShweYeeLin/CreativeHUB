import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { AdminLayout } from './AdminLayout';

function actionLabel(actionType: string) {
  switch (actionType) {
    case 'set_account_status':
      return 'Changed account status';
    case 'set_user_role':
      return 'Changed a user\'s role';
    case 'resolve_user_report':
      return 'Resolved a user report';
    case 'update_ticket_status':
      return 'Updated a support ticket';
    case 'resolve_dispute':
      return 'Resolved a deposit dispute';
    case 'request_more_evidence':
      return 'Requested more evidence';
    default:
      return actionType;
  }
}

export function AdminAuditLogPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const response = await DataService.getAdminActionLog();
      if (!isMounted) return;
      if (response.error) {
        setError((response.error as any).message || 'Unable to load the activity log.');
      } else {
        setActions(response.data);
      }
      setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AdminLayout section="audit-logs">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="mt-0.5 text-sm text-gray-500">Every admin action is recorded here for accountability</p>
        </div>
        <div className="mb-1 flex items-center gap-2 text-gray-900">
          <ListChecks className="h-4 w-4" />
          <p className="text-xs text-gray-500">Append-only — admins cannot edit or delete this history.</p>
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-gray-500">No admin actions recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            {actions.map((a) => (
              <div key={a.id} className="border-b border-sky-100 px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{actionLabel(a.action_type)}</p>
                  <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  by {a.admin?.full_name || 'Admin'} · target: {a.target_type} #{String(a.target_id).slice(0, 8)}
                </p>
                {a.details && Object.keys(a.details).length > 0 && (
                  <p className="mt-1 text-xs text-gray-600">
                    {Object.entries(a.details)
                      .filter(([, value]) => value !== null && value !== undefined && value !== '')
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
