import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flag,
  MessageCircleWarning,
  PackageX,
  ShieldAlert,
  Star,
  UserCheck,
  Users as UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { AdminLayout } from './AdminLayout';

interface DashboardStats {
  totalUsers: number;
  activeFreelancers: number;
  activeClients: number;
  totalBookings: number;
  disputesAwaitingResponse: number;
  disputesNeedingDecision: number;
  openReports: number;
  openTickets: number;
  totalReviews: number;
  resultsOverdue: number;
}

const ATTENTION_COLORS = {
  red: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-600', chip: 'bg-red-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600', chip: 'bg-amber-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-100', icon: 'text-orange-600', chip: 'bg-orange-500' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-600', chip: 'bg-blue-500' },
} as const;

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

  const needsAttention = stats
    ? [
        { count: stats.disputesNeedingDecision, label: 'disputes need a decision', path: '/admin/disputes', icon: ShieldAlert, color: 'red' as const },
        { count: stats.disputesAwaitingResponse, label: "disputes awaiting a party's response", path: '/admin/disputes', icon: Clock, color: 'amber' as const },
        { count: stats.openReports, label: 'open user reports', path: '/admin/reports', icon: Flag, color: 'amber' as const },
        { count: stats.openTickets, label: 'open support tickets', path: '/admin/reports?tab=website_issues', icon: MessageCircleWarning, color: 'blue' as const },
        // A signal only — an overdue estimate is never itself a dispute or
        // a fault determination, just something worth an admin's notice.
        { count: stats.resultsOverdue, label: 'bookings have an overdue result delivery', path: '/admin/bookings?delivery=overdue', icon: PackageX, color: 'orange' as const },
      ].filter((item) => item.count > 0)
    : [];

  return (
    <AdminLayout section="overview">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">Overview of CreativeHUB platform activity</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-bold text-gray-900">Needs Attention</h2>
          </div>
          {!stats ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : needsAttention.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              <CheckCircle2 className="h-4 w-4" /> All caught up — nothing needs review right now.
            </p>
          ) : (
            <div className="space-y-2">
              {needsAttention.map((item) => {
                const colors = ATTENTION_COLORS[item.color];
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border ${colors.border} ${colors.bg} px-4 py-3 text-left transition-transform hover:scale-[1.01]`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white ${colors.icon}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        <span className={`mr-1.5 inline-flex min-w-[1.5rem] items-center justify-center rounded-full ${colors.chip} px-1.5 py-0.5 text-xs font-bold text-white`}>
                          {item.count}
                        </span>
                        {item.label}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xs font-semibold text-gray-500">View →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Platform</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={UsersIcon} label="Total Users" value={stats?.totalUsers} onClick={() => navigate('/admin/users')} />
            <StatCard icon={UserCheck} label="Active Freelancers" value={stats?.activeFreelancers} accent="green" onClick={() => navigate('/admin/users')} />
            <StatCard icon={UserCheck} label="Active Clients" value={stats?.activeClients} accent="green" onClick={() => navigate('/admin/users')} />
            <StatCard icon={CalendarClock} label="Total Bookings" value={stats?.totalBookings} onClick={() => navigate('/admin/bookings')} />
            <StatCard icon={Star} label="Total Reviews" value={stats?.totalReviews} accent="amber" />
          </div>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Quick Links</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/admin/users')} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">Manage Users</button>
            <button onClick={() => navigate('/admin/bookings')} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">Browse Bookings</button>
            <button onClick={() => navigate('/admin/reports')} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">Review Reports</button>
            <button onClick={() => navigate('/admin/disputes')} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">Resolve Disputes</button>
            <button onClick={() => navigate('/admin/audit-logs')} className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">View Activity Log</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = 'gray',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  accent?: 'gray' | 'green' | 'amber';
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  const iconColor = accent === 'green' ? 'bg-green-50 text-green-600' : accent === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600';
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-2xl border border-sky-100 bg-white p-4 text-left shadow-[0_8px_30px_rgba(56,189,248,0.15)] transition-all ${onClick ? 'hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconColor}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value === undefined ? '—' : value.toLocaleString()}</p>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
    </Wrapper>
  );
}
