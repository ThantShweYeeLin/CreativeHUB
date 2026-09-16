import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../../lib/defaults';
import { formatCurrencyAmount } from '../../../lib/currency';
import { AdminLayout } from './AdminLayout';
import { AccountStatusActions } from './AccountStatusActions';

type Role = 'client' | 'freelancer' | 'admin';

export function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentAdmin } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleDraft, setRoleDraft] = useState<Role | null>(null);
  const [roleReason, setRoleReason] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isLastAdmin, setIsLastAdmin] = useState(false);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    const userResponse = await DataService.getAdminUser(id);
    if (userResponse.error || !userResponse.data) {
      setError((userResponse.error as any)?.message || 'User not found.');
      setIsLoading(false);
      return;
    }
    setProfile(userResponse.data);

    const [bookingsResponse, reportsResponse, ticketsResponse] = await Promise.all([
      DataService.getAdminUserBookings(id),
      DataService.getAdminUserReports(id),
      DataService.getUserSupportTickets(id),
    ]);
    setBookings(bookingsResponse.data);
    setReports(reportsResponse.data);
    setTickets(ticketsResponse.data);

    if (userResponse.data.role === 'freelancer') {
      const [freelancerResponse, reviewsResponse] = await Promise.all([
        DataService.getFreelancerProfile(id),
        DataService.getFreelancerReviews(id),
      ]);
      setFreelancerProfile(freelancerResponse.data);
      setReviews(reviewsResponse.data || []);
    } else {
      setFreelancerProfile(null);
      const reviewsResponse = await DataService.getFreelancerReviews(id);
      setReviews(reviewsResponse.data || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openRoleConfirm = async (role: Role) => {
    setRoleError(null);
    if (profile?.role === 'admin' && role !== 'admin') {
      const adminsResponse = await DataService.getAllUsersForAdmin({ role: 'admin', limit: 2 });
      setIsLastAdmin((adminsResponse.count ?? adminsResponse.data.length) <= 1);
    } else {
      setIsLastAdmin(false);
    }
    setRoleDraft(role);
  };

  const handleConfirmRole = async () => {
    if (!id || !roleDraft) return;
    setIsSavingRole(true);
    setRoleError(null);
    const response = await DataService.adminSetUserRole(id, roleDraft, roleReason.trim() || undefined);
    setIsSavingRole(false);
    if (response.error) {
      setRoleError((response.error as any).message || 'Unable to change role.');
      return;
    }
    setRoleDraft(null);
    setRoleReason('');
    await load();
  };

  if (isLoading) {
    return (
      <AdminLayout section="users" breadcrumb={[{ label: 'Users', to: '/admin/users' }, { label: 'Loading...' }]}>
        <p className="text-sm text-gray-500">Loading...</p>
      </AdminLayout>
    );
  }

  if (error || !profile) {
    return (
      <AdminLayout section="users" breadcrumb={[{ label: 'Users', to: '/admin/users' }, { label: 'Not found' }]}>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'User not found.'}</div>
      </AdminLayout>
    );
  }

  const isSelf = currentAdmin?.id === profile.id;

  return (
    <AdminLayout section="users" breadcrumb={[{ label: 'Users', to: '/admin/users' }, { label: profile.full_name || 'Unnamed' }]}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={profile.avatar_url || DEFAULT_AVATAR_URL} alt="" className="h-16 w-16 rounded-full object-cover" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{profile.full_name || 'Unnamed'}</h2>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>
            </div>
            <AccountStatusActions userId={profile.id} currentStatus={profile.account_status} role={profile.role} onChanged={load} size="md" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-sky-100 pt-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Role</p>
              <p className="mt-1 capitalize text-gray-900">{profile.role}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
              <p className="mt-1 capitalize text-gray-900">{profile.account_status || 'active'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Joined</p>
              <p className="mt-1 text-gray-900">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Rating</p>
              <p className="mt-1 text-gray-900">{profile.total_reviews > 0 ? `★ ${Number(profile.rating || 0).toFixed(1)} (${profile.total_reviews})` : 'No reviews yet'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <h3 className="mb-3 text-lg font-bold text-gray-900">Change role</h3>
          {isSelf && <p className="text-xs text-gray-500">You can't change your own role.</p>}
          {!isSelf && (
            roleDraft ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <p className="mb-1 font-semibold text-gray-900">
                  Change role: <span className="capitalize">{profile.role}</span> → <span className="capitalize">{roleDraft}</span>
                </p>
                <p className="mb-3 text-xs text-gray-600">
                  This changes the user's platform permissions. Existing bookings, reviews, reports, and profile history are preserved.
                </p>
                {isLastAdmin && (
                  <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    This is the last remaining admin — this change will be rejected.
                  </p>
                )}
                <textarea
                  value={roleReason}
                  onChange={(e) => setRoleReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="mb-3 w-full min-h-[60px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
                {roleError && <p className="mb-3 text-xs text-red-600">{roleError}</p>}
                <div className="flex gap-2">
                  <button
                    disabled={isSavingRole || isLastAdmin}
                    onClick={() => void handleConfirmRole()}
                    className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                  >
                    {isSavingRole ? 'Saving...' : 'Confirm'}
                  </button>
                  <button
                    disabled={isSavingRole}
                    onClick={() => {
                      setRoleDraft(null);
                      setRoleReason('');
                      setRoleError(null);
                    }}
                    className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(['client', 'freelancer', 'admin'] as Role[])
                  .filter((r) => r !== profile.role)
                  .map((r) => (
                    <button
                      key={r}
                      onClick={() => void openRoleConfirm(r)}
                      className="rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold capitalize text-gray-700 hover:bg-sky-50"
                    >
                      Make {r}
                    </button>
                  ))}
              </div>
            )
          )}
        </div>

        {profile.role === 'freelancer' && freelancerProfile && (
          <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <h3 className="mb-3 text-lg font-bold text-gray-900">Freelancer profile</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Primary specialty</p>
                <p className="mt-1 text-gray-900">{freelancerProfile.title || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Hourly rate</p>
                <p className="mt-1 text-gray-900">{freelancerProfile.hourly_rate ? formatCurrencyAmount(Number(freelancerProfile.hourly_rate), 'THB') : '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase text-gray-500">Skills</p>
                <p className="mt-1 text-gray-900">{(freelancerProfile.skills || []).join(', ') || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase text-gray-500">Bio</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">{freelancerProfile.description || '—'}</p>
              </div>
            </div>
          </div>
        )}

        <ActivitySection title="Bookings" emptyLabel="No bookings yet.">
          {bookings.map((b) => (
            <button
              key={b.id}
              onClick={() => navigate(`/admin/bookings/${b.id}`)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-left hover:bg-sky-100"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{b.project_name}</p>
                <p className="text-xs text-gray-500">
                  {b.client?.full_name || 'Client'} ↔ {b.freelancer?.full_name || 'Freelancer'} · {new Date(b.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{b.status}</span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
            </button>
          ))}
        </ActivitySection>

        <ActivitySection title="Reports (filed or received)" emptyLabel="No reports involving this user.">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
              <p className="text-sm text-gray-900">
                {r.reporter?.full_name || 'Someone'} reported {r.reported?.full_name || 'a user'} — <span className="font-semibold">{r.reason}</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()} · {r.status}</p>
            </div>
          ))}
        </ActivitySection>

        <ActivitySection title="Support tickets" emptyLabel="No support tickets.">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
              <p className="text-sm text-gray-900">#{t.id.slice(0, 8).toUpperCase()} — {t.category}</p>
              <p className="mt-0.5 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()} · {t.status}</p>
            </div>
          ))}
        </ActivitySection>

        <ActivitySection title="Reviews received" emptyLabel="No reviews yet.">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">★ {r.rating} — {r.reviewer?.full_name || 'Someone'}</p>
              {r.comment && <p className="mt-1 text-sm text-gray-700">{r.comment}</p>}
            </div>
          ))}
        </ActivitySection>
      </div>
    </AdminLayout>
  );
}

function ActivitySection({ title, emptyLabel, children }: { title: string; emptyLabel: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
      <h3 className="mb-3 text-lg font-bold text-gray-900">{title}</h3>
      {hasItems ? <div className="space-y-2">{children}</div> : <p className="text-sm text-gray-500">{emptyLabel}</p>}
    </div>
  );
}
