import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { AlertCircle, Ban, CheckCircle, LayoutGrid, ListChecks, Search, Shield, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { formatCurrencyAmount } from '../../lib/currency';
import { DisputeTimeline, DISPUTE_CATEGORY_LABEL } from './bookingTracking/DisputeTimeline';

type Tab = 'overview' | 'users' | 'reports' | 'disputes' | 'activity';

const REPORT_REASON_LABEL: Record<string, string> = {
  harassment: 'Harassment',
  scam_fraud: 'Scam / Fraud',
  fake_information: 'Fake information',
  inappropriate_content: 'Inappropriate content',
  unprofessional_behavior: 'Unprofessional behavior',
  other: 'Other',
};

const TICKET_CATEGORY_LABEL: Record<string, string> = {
  technical: 'Technical problem',
  payment: 'Payment problem',
  account: 'Account problem',
  booking: 'Booking problem',
  suggestion: 'Suggestion / Feedback',
  other: 'Other',
};

const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  users: 'User Management',
  reports: 'Reports',
  disputes: 'Deposit Disputes',
  activity: 'Activity Log',
};

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  if (user && user.role !== 'admin') {
    return <Navigate to="/explore" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-gray-900" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {(['overview', 'users', 'reports', 'disputes', 'activity'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6">
        {tab === 'overview' && <OverviewTab onNavigate={setTab} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'disputes' && <DisputesTab />}
        {tab === 'activity' && <ActivityLogTab />}
      </div>
    </div>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [stats, setStats] = useState<{ totalUsers: number; activeFreelancers: number; openReports: number; pendingDisputes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const response = await DataService.getAdminDashboardStats();
      if (!isMounted) return;
      if (response.error) {
        setError((response.error as any).message || 'Unable to load dashboard stats.');
        return;
      }
      setStats(response);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const cards: Array<{ label: string; value: number | null; tab: Tab; accent: string }> = [
    { label: 'Total Users', value: stats?.totalUsers ?? null, tab: 'users', accent: 'text-gray-900' },
    { label: 'Active Freelancers', value: stats?.activeFreelancers ?? null, tab: 'users', accent: 'text-green-600' },
    { label: 'Open Reports', value: stats?.openReports ?? null, tab: 'reports', accent: 'text-amber-600' },
    { label: 'Pending Disputes', value: stats?.pendingDisputes ?? null, tab: 'disputes', accent: 'text-red-600' },
  ];

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.tab)}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.value === null ? '—' : card.value}</p>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-gray-900">
          <LayoutGrid className="h-5 w-5" />
          <h2 className="text-lg font-bold">Quick Links</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('users')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Manage Users</button>
          <button onClick={() => onNavigate('reports')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Review Reports</button>
          <button onClick={() => onNavigate('disputes')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Resolve Disputes</button>
          <button onClick={() => onNavigate('activity')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">View Activity Log</button>
        </div>
      </div>
    </div>
  );
}

type UserFilter = 'all' | 'clients' | 'freelancers' | 'suspended';

function UsersTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const [usersResponse, countsResponse] = await Promise.all([
      DataService.getAllUsersForAdmin(search),
      DataService.getOpenReportCountsByUser(),
    ]);
    if (usersResponse.error) {
      setError((usersResponse.error as any).message || 'Unable to load users.');
    } else {
      setUsers(usersResponse.data);
    }
    setReportCounts(countsResponse.counts);
    setIsLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filteredUsers = useMemo(() => {
    if (filter === 'clients') return users.filter((u) => u.role === 'client');
    if (filter === 'freelancers') return users.filter((u) => u.role === 'freelancer');
    if (filter === 'suspended') return users.filter((u) => u.account_status === 'suspended' || u.account_status === 'banned');
    return users;
  }, [users, filter]);

  const handleStatusChange = async (userId: string, status: 'active' | 'suspended' | 'banned') => {
    setPendingUserId(userId);
    setError(null);
    const response = await DataService.adminSetAccountStatus(userId, status);
    setPendingUserId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update account status.');
      return;
    }
    await load();
  };

  const filterOptions: Array<{ id: UserFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'clients', label: 'Clients' },
    { id: 'freelancers', label: 'Freelancers' },
    { id: 'suspended', label: 'Suspended Accounts' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="flex gap-1.5">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                filter === option.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reports</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No users found.</td></tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img src={u.avatar_url || DEFAULT_AVATAR_URL} alt="" className="h-8 w-8 rounded-full object-cover" />
                      <div>
                        <p className="font-semibold text-gray-900">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{u.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        u.account_status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : u.account_status === 'banned'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {u.account_status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{reportCounts[u.id] || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.account_status !== 'active' && (
                        <button
                          disabled={pendingUserId === u.id}
                          onClick={() => void handleStatusChange(u.id, 'active')}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Reactivate
                        </button>
                      )}
                      {u.account_status !== 'suspended' && u.role !== 'admin' && (
                        <button
                          disabled={pendingUserId === u.id}
                          onClick={() => void handleStatusChange(u.id, 'suspended')}
                          className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        >
                          Suspend
                        </button>
                      )}
                      {u.account_status !== 'banned' && u.role !== 'admin' && (
                        <button
                          disabled={pendingUserId === u.id}
                          onClick={() => void handleStatusChange(u.id, 'banned')}
                          className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Ban
                        </button>
                      )}
                      <a
                        href={`/profile/${u.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black"
                      >
                        View
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ReportsSubTab = 'user_reports' | 'website_issues';

function ReportsTab() {
  const [subTab, setSubTab] = useState<ReportsSubTab>('user_reports');

  return (
    <div className="space-y-4">
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
  );
}

function UserReportsSection() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, { decision: string; reason: string }>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    const response = await DataService.getAllUserReportsForAdmin();
    if (response.error) {
      setError((response.error as any).message || 'Unable to load reports.');
    } else {
      setReports(response.data);
      const paths = response.data.flatMap((r: any) => r.evidence_photo_paths || []);
      const entries = await Promise.all(
        Array.from(new Set(paths)).map(async (path: any) => {
          const res = await DataService.getReportEvidenceSignedUrl(path);
          return [path, res.url] as const;
        })
      );
      setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)) as Record<string, string>);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openReports = useMemo(() => reports.filter((r) => r.status === 'open'), [reports]);
  const resolvedReports = useMemo(() => reports.filter((r) => r.status !== 'open'), [reports]);

  const handleResolve = async (reportId: string) => {
    const draft = decisionDrafts[reportId];
    if (!draft?.decision) return;
    setPendingId(reportId);
    setError(null);
    const response = await DataService.adminResolveUserReport(reportId, draft.decision as any, draft.reason);
    setPendingId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to resolve report.');
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : openReports.length === 0 ? (
        <p className="text-sm text-gray-500">No open reports.</p>
      ) : (
        openReports.map((r) => {
          const draft = decisionDrafts[r.id] || { decision: '', reason: '' };
          return (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-gray-900">
                  {r.reporter?.full_name || 'Someone'} reported {r.reported?.full_name || 'a user'}
                </p>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {REPORT_REASON_LABEL[r.reason] || r.reason}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{new Date(r.created_at).toLocaleString()}</p>
              {r.description && <p className="mb-3 text-sm text-gray-700">{r.description}</p>}
              {(r.evidence_photo_paths || []).length > 0 && (
                <div className="mb-3 grid grid-cols-4 gap-2 max-w-md">
                  {r.evidence_photo_paths.map((path: string) => (
                    <div key={path} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                      {signedUrls[path] && <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />}
                    </div>
                  ))}
                </div>
              )}
              {r.related_booking_id && (
                <a
                  href={`/booking/${r.related_booking_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 inline-block text-xs font-semibold text-gray-700 underline"
                >
                  View related booking
                </a>
              )}
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                <select
                  value={draft.decision}
                  onChange={(e) => setDecisionDrafts((c) => ({ ...c, [r.id]: { ...draft, decision: e.target.value } }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Choose a decision...</option>
                  <option value="no_action">No action</option>
                  <option value="warning">Warning</option>
                  <option value="suspended">Suspend account</option>
                  <option value="banned">Ban account</option>
                </select>
                <input
                  value={draft.reason}
                  onChange={(e) => setDecisionDrafts((c) => ({ ...c, [r.id]: { ...draft, reason: e.target.value } }))}
                  placeholder="Reason (optional)"
                  className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  disabled={!draft.decision || pendingId === r.id}
                  onClick={() => void handleResolve(r.id)}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {pendingId === r.id ? 'Saving...' : 'Confirm Decision'}
                </button>
              </div>
            </div>
          );
        })
      )}

      {resolvedReports.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">Resolved reports ({resolvedReports.length})</summary>
          <div className="mt-3 space-y-2">
            {resolvedReports.map((r) => (
              <div key={r.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {r.reported?.full_name || 'A user'} — {REPORT_REASON_LABEL[r.reason] || r.reason} → <span className="font-semibold">{r.decision}</span>
              </div>
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

type DisputesSubTab = 'pending' | 'under_review' | 'resolved';

function DisputesTab() {
  const [subTab, setSubTab] = useState<DisputesSubTab>('under_review');
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [resolvedBookings, setResolvedBookings] = useState<any[]>([]);
  const [events, setEvents] = useState<Record<string, any[]>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadEventsAndEvidence = async (bookings: any[]) => {
    const eventEntries = await Promise.all(
      bookings.map(async (b: any) => {
        const res = await DataService.getBookingEvents(b.id);
        return [b.id, res.data || []] as const;
      })
    );
    const eventsMap = Object.fromEntries(eventEntries);
    setEvents((current) => ({ ...current, ...eventsMap }));

    const paths = Object.values(eventsMap)
      .flat()
      .flatMap((e: any) => (e.evidence_photos as string[]) || []);
    const entries = await Promise.all(
      Array.from(new Set(paths)).map(async (path) => {
        const res = await DataService.getBookingEvidenceSignedUrl(path);
        return [path, res.url] as const;
      })
    );
    setSignedUrls((current) => ({
      ...current,
      ...(Object.fromEntries(entries.filter(([, url]) => url)) as Record<string, string>),
    }));
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const [activeResponse, resolvedResponse] = await Promise.all([
      DataService.getAllDisputedBookingsForAdmin(),
      DataService.getResolvedDisputesForAdmin(),
    ]);
    if (activeResponse.error || resolvedResponse.error) {
      setError((activeResponse.error as any)?.message || (resolvedResponse.error as any)?.message || 'Unable to load disputes.');
      setIsLoading(false);
      return;
    }
    setActiveBookings(activeResponse.data);
    setResolvedBookings(resolvedResponse.data);
    await loadEventsAndEvidence([...activeResponse.data, ...resolvedResponse.data]);
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingBookings = useMemo(() => activeBookings.filter((b) => b.dispute_status === 'open'), [activeBookings]);
  const underReviewBookings = useMemo(() => activeBookings.filter((b) => b.dispute_status === 'under_admin_review'), [activeBookings]);

  const handleDecision = async (bookingId: string, decision: 'refund' | 'release') => {
    setPendingId(bookingId);
    setError(null);
    const response = await DataService.adminResolveDispute(bookingId, decision, decisionReason.trim() || undefined);
    setPendingId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to resolve dispute.');
      return;
    }
    setDecisionReason('');
    setExpandedId(null);
    await load();
  };

  const handleRequestMoreEvidence = async (bookingId: string) => {
    setPendingId(bookingId);
    const response = await DataService.adminRequestMoreEvidence(bookingId);
    setPendingId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to request more evidence.');
      return;
    }
    await load();
  };

  const subTabOptions: Array<{ id: DisputesSubTab; label: string; count: number }> = [
    { id: 'pending', label: 'Pending Review', count: pendingBookings.length },
    { id: 'under_review', label: 'Under Review', count: underReviewBookings.length },
    { id: 'resolved', label: 'Resolved', count: resolvedBookings.length },
  ];

  const renderActiveCard = (b: any) => {
    const bookingEvents = events[b.id] || [];
    const clientClaim = bookingEvents.find((e) => e.actor === 'client' && e.action === 'complain');
    const freelancerResponse = [...bookingEvents].reverse().find((e) => e.actor === 'freelancer' && e.action === 'evidence');
    const deposit = Math.round(Number(b.budget || 0) * 0.3);
    const isExpanded = expandedId === b.id;

    return (
      <div key={b.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedId(isExpanded ? null : b.id)}
          className="w-full flex flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">
              {b.project_name} — {b.client?.full_name || 'Client'} vs {b.freelancer?.full_name || 'Freelancer'}
            </p>
            <p className="text-xs text-gray-500">Deposit {formatCurrencyAmount(deposit, 'THB')}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              b.dispute_status === 'under_admin_review' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {b.dispute_status === 'under_admin_review' ? 'Needs Decision' : 'In Progress'}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t border-gray-100 p-5">
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Client Claim</p>
                {clientClaim ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900">{DISPUTE_CATEGORY_LABEL[clientClaim.category] || clientClaim.category}</p>
                    <p className="mt-1 text-sm text-gray-700">{clientClaim.reason}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No claim recorded.</p>
                )}
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Freelancer Response</p>
                {freelancerResponse ? (
                  <p className="text-sm text-gray-700">{freelancerResponse.evidence_text || '(no written response)'}</p>
                ) : (
                  <p className="text-sm text-gray-500">No response submitted.</p>
                )}
              </div>
            </div>

            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Full Timeline</p>
            <DisputeTimeline events={bookingEvents} signedUrls={signedUrls} />

            <div className="mt-4 border-t border-gray-100 pt-4">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Decision reason (optional)</label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Why are you making this decision?"
                className="mb-3 w-full min-h-[70px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={pendingId === b.id}
                  onClick={() => void handleDecision(b.id, 'refund')}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <Ban className="h-4 w-4" /> Refund Client
                </button>
                <button
                  disabled={pendingId === b.id}
                  onClick={() => void handleDecision(b.id, 'release')}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" /> Release Deposit to Freelancer
                </button>
                <button
                  disabled={pendingId === b.id}
                  onClick={() => void handleRequestMoreEvidence(b.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <AlertCircle className="h-4 w-4" /> Request More Evidence
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResolvedCard = (b: any) => {
    const bookingEvents = events[b.id] || [];
    const decisionEvent = [...bookingEvents].reverse().find((e) => e.actor === 'admin' && (e.action === 'refunded' || e.action === 'released'));
    const deposit = Math.round(Number(b.budget || 0) * 0.3);
    const isExpanded = expandedId === b.id;

    return (
      <div key={b.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedId(isExpanded ? null : b.id)}
          className="w-full flex flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">
              {b.project_name} — {b.client?.full_name || 'Client'} vs {b.freelancer?.full_name || 'Freelancer'}
            </p>
            <p className="text-xs text-gray-500">Deposit {formatCurrencyAmount(deposit, 'THB')}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              b.payment_status === 'refunded' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {b.payment_status === 'refunded' ? 'Refunded to Client' : 'Released to Freelancer'}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t border-gray-100 p-5">
            {decisionEvent?.reason && (
              <div className="mb-4 rounded-xl bg-gray-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Admin's Reason</p>
                <p className="text-sm text-gray-700">{decisionEvent.reason}</p>
              </div>
            )}
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Full Timeline</p>
            <DisputeTimeline events={bookingEvents} signedUrls={signedUrls} />
          </div>
        )}
      </div>
    );
  };

  const listForSubTab = subTab === 'pending' ? pendingBookings : subTab === 'under_review' ? underReviewBookings : resolvedBookings;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {subTabOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setSubTab(option.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              subTab === option.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option.label} ({option.count})
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : listForSubTab.length === 0 ? (
        <p className="text-sm text-gray-500">
          {subTab === 'pending' ? 'No disputes awaiting a response.' : subTab === 'under_review' ? 'No disputes need a decision right now.' : 'No resolved disputes yet.'}
        </p>
      ) : (
        listForSubTab.map((b) => (subTab === 'resolved' ? renderResolvedCard(b) : renderActiveCard(b)))
      )}
    </div>
  );
}

function ActivityLogTab() {
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

  const actionLabel = (actionType: string) => {
    switch (actionType) {
      case 'set_account_status':
        return 'Changed account status';
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
  };

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center gap-2 text-gray-900">
        <ListChecks className="h-5 w-5" />
        <p className="text-sm text-gray-600">Every admin action is logged here for accountability.</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : actions.length === 0 ? (
        <p className="text-sm text-gray-500">No admin actions recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {actions.map((a) => (
            <div key={a.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
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
  );
}

// Re-exported so App.tsx doesn't need a separate icon import just to satisfy
// the unused-import lint on UsersIcon if the Users tab label is ever swapped
// for an icon-only button.
export const AdminUsersIcon = UsersIcon;
