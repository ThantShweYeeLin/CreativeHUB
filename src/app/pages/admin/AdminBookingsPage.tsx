import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { formatCurrencyAmount } from '../../../lib/currency';
import { AdminLayout } from './AdminLayout';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'annulled'] as const;
const DISPUTE_OPTIONS = ['', 'none', 'open', 'under_admin_review', 'resolved'] as const;

function daysOverdue(estimatedDeliveryAt: string) {
  const diffMs = Date.now() - new Date(estimatedDeliveryAt).getTime();
  return Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export function AdminBookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const overdueOnly = searchParams.get('delivery') === 'overdue';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [disputeStatus, setDisputeStatus] = useState<string>('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleOverdue = () => {
    setSearchParams(overdueOnly ? {} : { delivery: 'overdue' });
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const response = await DataService.getAdminBookings({
      search,
      status: (status || undefined) as any,
      disputeStatus: (disputeStatus || undefined) as any,
      overdueOnly,
      limit: PAGE_SIZE,
      offset,
    });
    if (response.error) {
      setError((response.error as any).message || 'Unable to load bookings.');
    } else {
      setBookings(response.data);
      setCount(response.count);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, disputeStatus, overdueOnly, offset]);

  useEffect(() => {
    setOffset(0);
  }, [search, status, disputeStatus, overdueOnly]);

  const rangeStart = count === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + bookings.length, count);

  return (
    <AdminLayout section="bookings">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Browse every booking on the platform</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>
            ))}
          </select>
          <select
            value={disputeStatus}
            onChange={(e) => setDisputeStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {DISPUTE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? `Dispute: ${s.replace('_', ' ')}` : 'All dispute statuses'}</option>
            ))}
          </select>
          <button
            onClick={toggleOverdue}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              overdueOnly ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⚠ Results overdue only
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Freelancer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3">Dispute</th>
                <th className="px-4 py-3">{overdueOnly ? 'Estimated Delivery' : 'Created'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{overdueOnly ? 'No overdue results right now.' : 'No bookings found.'}</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{b.project_name}</td>
                    <td className="px-4 py-3 text-gray-700">{b.client?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{b.freelancer?.full_name || '—'}</td>
                    <td className="px-4 py-3 capitalize text-gray-700">{b.status}</td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrencyAmount(Number(b.deposit_amount ?? Math.round(Number(b.budget || 0) * 0.3)), 'THB')}</td>
                    <td className="px-4 py-3">
                      {b.dispute_status && b.dispute_status !== 'none' ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold capitalize text-amber-700">{b.dispute_status.replace('_', ' ')}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {overdueOnly && b.estimated_delivery_at ? (
                        <span className="font-semibold text-amber-700">Overdue {daysOverdue(b.estimated_delivery_at)}d</span>
                      ) : (
                        new Date(b.created_at).toLocaleDateString()
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>{count === 0 ? 'No bookings' : `Showing ${rangeStart}-${rangeEnd} of ${count} bookings`}</p>
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
