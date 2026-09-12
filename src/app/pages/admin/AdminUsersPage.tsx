import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../../lib/defaults';
import { AdminLayout } from './AdminLayout';
import { AccountStatusActions } from './AccountStatusActions';

type UserFilter = 'all' | 'clients' | 'freelancers' | 'suspended';

const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const [usersResponse, countsResponse] = await Promise.all([
      DataService.getAllUsersForAdmin({
        search,
        role: filter === 'clients' ? 'client' : filter === 'freelancers' ? 'freelancer' : undefined,
        status: filter === 'suspended' ? 'suspended' : undefined,
        limit: PAGE_SIZE,
        offset,
      }),
      DataService.getOpenReportCountsByUser(),
    ]);
    if (usersResponse.error) {
      setError((usersResponse.error as any).message || 'Unable to load users.');
    } else {
      setUsers(usersResponse.data);
      setCount(usersResponse.count);
    }
    setReportCounts(countsResponse.counts);
    setIsLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter, offset]);

  useEffect(() => {
    setOffset(0);
  }, [search, filter]);

  const filterOptions: Array<{ id: UserFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'clients', label: 'Clients' },
    { id: 'freelancers', label: 'Freelancers' },
    { id: 'suspended', label: 'Suspended Accounts' },
  ];

  const rangeStart = count === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + users.length, count);

  return (
    <AdminLayout section="users">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage client and freelancer accounts</p>
        </div>

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
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/admin/users/${u.id}`)} className="flex items-center gap-2 text-left hover:underline">
                        <img src={u.avatar_url || DEFAULT_AVATAR_URL} alt="" className="h-8 w-8 rounded-full object-cover" />
                        <div>
                          <p className="font-semibold text-gray-900">{u.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </button>
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AccountStatusActions userId={u.id} currentStatus={u.account_status} role={u.role} onChanged={load} />
                        <button
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>{count === 0 ? 'No users' : `Showing ${rangeStart}-${rangeEnd} of ${count} users`}</p>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={offset + PAGE_SIZE >= count}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
