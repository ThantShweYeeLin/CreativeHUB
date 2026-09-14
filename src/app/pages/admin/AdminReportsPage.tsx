import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DataService } from '../../../lib/dataService';
import { AdminLayout } from './AdminLayout';
import { REPORT_REASON_LABEL } from './AdminReportDetail';

type ReportsSubTab = 'user_reports' | 'website_issues';

const TICKET_CATEGORY_LABEL: Record<string, string> = {
  technical: 'Technical problem',
  payment: 'Payment problem',
  account: 'Account problem',
  booking: 'Booking problem',
  suggestion: 'Suggestion / Feedback',
  other: 'Other',
};

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab: ReportsSubTab = searchParams.get('tab') === 'website_issues' ? 'website_issues' : 'user_reports';

  const setSubTab = (tab: ReportsSubTab) => {
    setSearchParams(tab === 'website_issues' ? { tab } : {});
  };

  return (
    <AdminLayout section="reports">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500">User reports and website issue tickets</p>
        </div>

        <div className="flex gap-1.5">
          {([
            { id: 'user_reports', label: 'User Reports' },
            { id: 'website_issues', label: 'Website Issues' },
          ] as Array<{ id: ReportsSubTab; label: string }>).map((option) => (
            <button
              key={option.id}
              onClick={() => setSubTab(option.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                subTab === option.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {subTab === 'user_reports' ? <UserReportsSection /> : <WebsiteIssuesSection />}
      </div>
    </AdminLayout>
  );
}

function UserReportsSection() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const response = await DataService.getAllUserReportsForAdmin();
      if (!isMounted) return;
      if (response.error) {
        setError((response.error as any).message || 'Unable to load reports.');
      } else {
        setReports(response.data);
      }
      setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const openReports = reports.filter((r) => r.status === 'open');
  const resolvedReports = reports.filter((r) => r.status !== 'open');

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : openReports.length === 0 ? (
        <p className="text-sm text-gray-500">No open reports.</p>
      ) : (
        <div className="space-y-3">
          {openReports.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/admin/reports/${r.id}`)}
              className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:bg-gray-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-gray-900">
                  {r.reported_post_id
                    ? `${r.reporter?.full_name || 'Someone'} reported a post by ${r.reported?.full_name || 'a user'}`
                    : `${r.reporter?.full_name || 'Someone'} reported ${r.reported?.full_name || 'a user'}`}
                </p>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {REPORT_REASON_LABEL[r.reason] || r.reason}
                </span>
              </div>
              {r.reported_post_id && r.reported_post?.caption && (
                <p className="mt-1 line-clamp-1 text-xs text-gray-600">"{r.reported_post.caption}"</p>
              )}
              <p className="mt-1 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}

      {resolvedReports.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">Resolved reports ({resolvedReports.length})</summary>
          <div className="mt-3 space-y-2">
            {resolvedReports.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/admin/reports/${r.id}`)}
                className="block w-full rounded-lg bg-gray-50 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
              >
                {r.reported_post_id ? `Post by ${r.reported?.full_name || 'a user'}` : r.reported?.full_name || 'A user'} — {REPORT_REASON_LABEL[r.reason] || r.reason} → <span className="font-semibold">{r.decision}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function WebsiteIssuesSection() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    const response = await DataService.getAllSupportTicketsForAdmin();
    if (response.error) {
      setError((response.error as any).message || 'Unable to load tickets.');
    } else {
      setTickets(response.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleStatusChange = async (ticketId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    setPendingId(ticketId);
    const response = await DataService.adminUpdateTicketStatus(ticketId, status);
    setPendingId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update ticket.');
      return;
    }
    await load();
  };

  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-200 text-gray-600',
  };

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-gray-500">No tickets yet.</p>
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">
                  #{t.id.slice(0, 8).toUpperCase()} — {TICKET_CATEGORY_LABEL[t.category] || t.category}
                </p>
                <p className="text-xs text-gray-500">{t.user?.full_name || 'A user'} · {new Date(t.created_at).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[t.status] || ''}`}>{t.status}</span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{t.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
              {(['open', 'in_progress', 'resolved', 'closed'] as const)
                .filter((s) => s !== t.status)
                .map((s) => (
                  <button
                    key={s}
                    disabled={pendingId === t.id}
                    onClick={() => void handleStatusChange(t.id, s)}
                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Mark {s.replace('_', ' ')}
                  </button>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
