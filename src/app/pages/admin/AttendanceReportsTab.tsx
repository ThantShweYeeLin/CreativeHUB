import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DataService } from '../../../lib/dataService';
import { formatCurrencyAmount } from '../../../lib/currency';
import { DISPUTE_CATEGORY_LABEL } from '../../../lib/disputeCategories';

type SubTab = 'pending' | 'under_review' | 'resolved';

// No-show/late-arrival reports route through the exact same booking
// dispute system as every other report category now (see
// DataService.getAllAttendanceDisputesForAdmin) — same escrowed deposit,
// same refund/release decision, same conversation with the client and
// freelancer — so this mirrors AdminDisputesPage.tsx almost exactly, just
// pre-filtered to those two categories and linking to the dedicated
// /admin/attendance/:id route instead of /admin/disputes/:id.
export function AttendanceReportsTab() {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<SubTab>('under_review');
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [resolvedBookings, setResolvedBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      const [activeResponse, resolvedResponse] = await Promise.all([
        DataService.getAllAttendanceDisputesForAdmin(),
        DataService.getResolvedAttendanceDisputesForAdmin(),
      ]);
      if (!isMounted) return;
      if (activeResponse.error || resolvedResponse.error) {
        setError((activeResponse.error as any)?.message || (resolvedResponse.error as any)?.message || 'Unable to load attendance reports.');
      } else {
        setActiveBookings(activeResponse.data);
        setResolvedBookings(resolvedResponse.data);
      }
      setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const pendingBookings = useMemo(() => activeBookings.filter((b) => b.dispute_status === 'open'), [activeBookings]);
  const underReviewBookings = useMemo(() => activeBookings.filter((b) => b.dispute_status === 'under_admin_review'), [activeBookings]);

  const subTabOptions: Array<{ id: SubTab; label: string; count: number }> = [
    { id: 'pending', label: 'Pending Review', count: pendingBookings.length },
    { id: 'under_review', label: 'Under Review', count: underReviewBookings.length },
    { id: 'resolved', label: 'Resolved', count: resolvedBookings.length },
  ];

  const listForSubTab = subTab === 'pending' ? pendingBookings : subTab === 'under_review' ? underReviewBookings : resolvedBookings;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {subTabOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setSubTab(option.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              subTab === option.id ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
            }`}
          >
            {option.label} ({option.count})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
        </div>
      ) : listForSubTab.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          {subTab === 'pending' ? 'No attendance reports awaiting a response.' : subTab === 'under_review' ? 'No attendance reports need a decision right now.' : 'No resolved attendance reports yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {listForSubTab.map((b) => {
            const deposit = b.deposit_amount != null ? Number(b.deposit_amount) : Math.round(Number(b.budget || 0) * 0.3);
            return (
              <button
                key={b.id}
                onClick={() => navigate(`/admin/attendance/${b.id}`)}
                className="w-full rounded-2xl border border-sky-100 bg-white p-4 text-left shadow-[0_8px_30px_rgba(56,189,248,0.15)] hover:bg-sky-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">
                      {b.project_name} — {b.client?.full_name || 'Client'} vs {b.freelancer?.full_name || 'Freelancer'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {DISPUTE_CATEGORY_LABEL[b.dispute_category] || b.dispute_category} · Deposit {formatCurrencyAmount(deposit, 'THB')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      subTab === 'resolved'
                        ? b.payment_status === 'refunded' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        : b.dispute_status === 'under_admin_review' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {subTab === 'resolved'
                      ? b.payment_status === 'refunded' ? 'Refunded to Client' : 'Released to Freelancer'
                      : b.dispute_status === 'under_admin_review' ? 'Needs Decision' : 'In Progress'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
