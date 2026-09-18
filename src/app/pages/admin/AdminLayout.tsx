import { useNavigate } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Flag,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  CalendarClock,
  UserX,
  Users as UsersIcon,
} from 'lucide-react';
import logoImage from '../../../imports/logo.png';
import { useAuth } from '../../../contexts/AuthContext';
import { Avatar } from '../../../components/common/Avatar';
import { DEFAULT_AVATAR_URL } from '../../../lib/defaults';
import { PageBackdrop } from '../../../components/common/PageBackdrop';

export type AdminSection = 'overview' | 'users' | 'bookings' | 'earnings' | 'disputes' | 'attendance' | 'reports' | 'audit-logs';

export interface AdminBreadcrumbItem {
  label: string;
  to?: string;
}

interface NavItem {
  id: AdminSection;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

const NAV_GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: [{ id: 'overview', label: 'Dashboard', path: '/admin', icon: LayoutDashboard }] },
  {
    label: 'Management',
    items: [
      { id: 'users', label: 'Users', path: '/admin/users', icon: UsersIcon },
      { id: 'bookings', label: 'Bookings', path: '/admin/bookings', icon: CalendarClock },
      { id: 'earnings', label: 'Earnings', path: '/admin/earnings', icon: DollarSign },
    ],
  },
  {
    label: 'Trust & Safety',
    items: [
      { id: 'disputes', label: 'Deposit Disputes', path: '/admin/disputes', icon: ShieldAlert },
      { id: 'attendance', label: 'Attendance Reports', path: '/admin/attendance', icon: UserX },
      { id: 'reports', label: 'Reports', path: '/admin/reports', icon: Flag },
    ],
  },
  { label: 'System', items: [{ id: 'audit-logs', label: 'Activity Log', path: '/admin/audit-logs', icon: ListChecks }] },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// Layout/navigation only — no data fetching or mutation logic lives here.
// Every admin page owns its own data; this just renders the shell around it.
export function AdminLayout({
  section,
  breadcrumb,
  children,
}: {
  section: AdminSection;
  breadcrumb?: AdminBreadcrumbItem[];
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen">
      <PageBackdrop />
      <div className="relative z-10 lg:flex">
      {/* Sidebar — desktop only; admin work is desktop-first, and a real
          sidebar needs the width a phone/tablet viewport doesn't have. */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-sky-100 lg:bg-white">
        <div className="flex items-center gap-2.5 border-b border-sky-100 px-5 py-5">
          <img src={logoImage} alt="CreativeHUB" className="h-9 w-9 rounded-full object-cover" />
          <div>
            <p className="text-sm font-bold leading-tight text-gray-900">CreativeHUB</p>
            <p className="flex items-center gap-1 text-xs font-semibold text-gray-500">
              <ShieldCheck className="h-3 w-3" /> Admin
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label || `group-${groupIndex}`}>
              {group.label && (
                <p className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = section === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.path)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${
                        isActive ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'text-gray-600 hover:bg-sky-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sky-100 p-3">
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <Avatar src={user?.avatar_url || DEFAULT_AVATAR_URL} alt={user?.fullName || 'Admin'} sizeClassName="w-8 h-8" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user?.fullName || 'Admin'}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-600 hover:bg-sky-50 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Back to CreativeHUB
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:min-h-0">
        {/* Mobile/tablet topbar — the sidebar's content, laid out horizontally. */}
        <div className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 backdrop-blur-lg lg:hidden">
          <div className="px-4 py-3">
            <button
              onClick={() => navigate('/explore')}
              className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to CreativeHUB
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gray-900" />
              <h1 className="text-lg font-bold text-gray-900">Admin</h1>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {ALL_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  section === item.id ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 px-4 py-6 pb-24 md:px-8 lg:px-10 lg:py-8 lg:pb-8">
          <div className="mx-auto max-w-[1100px]">
            {breadcrumb && breadcrumb.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500">
                {breadcrumb.map((item, index) => (
                  <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                    {item.to ? (
                      <button onClick={() => navigate(item.to as string)} className="font-semibold text-gray-700 hover:text-gray-900 hover:underline">
                        {item.label}
                      </button>
                    ) : (
                      <span className="font-semibold text-gray-900">{item.label}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
