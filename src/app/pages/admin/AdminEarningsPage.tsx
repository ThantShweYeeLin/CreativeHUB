import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Crown, DollarSign, Percent, Receipt, Search, Users as UsersIcon } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { formatCurrencyAmount } from '../../../lib/currency';
import { COMMISSION_PERCENTAGE, getBookingEarningsBreakdown } from '../../../lib/bookingEscrow';
import { AdminLayout } from './AdminLayout';

const PAGE_SIZE = 20;
// The platform only ever has this many released bookings / premium
// purchases to show in a demo dataset — fetched once, in full, so the
// total figures below are a true sum (not just whatever page is on
// screen) and paging through the table doesn't re-hit the network. Revisit
// with server-side pagination if this app ever has enough real rows to
// make 1000 a real cap.
const FETCH_LIMIT = 1000;

type EarningsSubTab = 'commissions' | 'premium';

export function AdminEarningsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab: EarningsSubTab = searchParams.get('tab') === 'premium' ? 'premium' : 'commissions';
  const setSubTab = (tab: EarningsSubTab) => setSearchParams(tab === 'premium' ? { tab } : {});

  return (
    <AdminLayout section="earnings">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Platform revenue from booking commissions and Premium subscriptions</p>
        </div>

        <div className="flex gap-1.5">
          {([
            { id: 'commissions', label: 'Booking Commissions' },
            { id: 'premium', label: 'Premium Fees' },
          ] as Array<{ id: EarningsSubTab; label: string }>).map((option) => (
            <button
              key={option.id}
              onClick={() => setSubTab(option.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                subTab === option.id ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {subTab === 'commissions' ? <BookingCommissionsSection /> : <PremiumFeesSection />}
      </div>
    </AdminLayout>
  );
}

function BookingCommissionsSection() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [totalReleasedCount, setTotalReleasedCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      const response = await DataService.getAdminBookings({
        depositStatus: 'paid',
        search,
        limit: FETCH_LIMIT,
        offset: 0,
      });
      if (!isMounted) return;
      if (response.error) {
        setError((response.error as any).message || 'Unable to load earnings.');
      } else {
        setBookings(response.data);
        setTotalReleasedCount(response.count);
      }
      setIsLoading(false);
    }, 250);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  const rows = useMemo(
    () => bookings.map((b) => ({ booking: b, ...getBookingEarningsBreakdown(b) })),
    [bookings]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          deposit: acc.deposit + r.depositAmount,
          commission: acc.commission + r.commissionAmount,
          net: acc.net + r.netAmount,
        }),
        { deposit: 0, commission: 0, net: 0 }
      ),
    [rows]
  );

  const pageRows = rows.slice(offset, offset + PAGE_SIZE);
  const rangeStart = rows.length === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + pageRows.length, rows.length);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Platform commission ({Math.round(COMMISSION_PERCENTAGE * 100)}%) taken from each released deposit
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total commission earned', value: totals.commission, icon: DollarSign },
          { label: 'Total deposits released', value: totals.deposit, icon: Receipt },
          { label: 'Total paid out to freelancers', value: totals.net, icon: Percent },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
            <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 p-3">
              <stat.icon className="h-5 w-5 text-sky-600" />
            </div>
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrencyAmount(stat.value, 'THB')}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by project name..."
          className="w-full rounded-lg border border-sky-100 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
        />
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sky-100 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3">Booking ID</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Freelancer</th>
              <th className="px-4 py-3">Deposit</th>
              <th className="px-4 py-3">Commission</th>
              <th className="px-4 py-3">Freelancer received</th>
              <th className="px-4 py-3">Released</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No released deposits yet — this fills in once a client's deposit is released to a freelancer.</td></tr>
            ) : (
              pageRows.map(({ booking: b, depositAmount, commissionAmount, netAmount }) => (
                <tr
                  key={b.id}
                  className="border-b border-sky-100 last:border-0 hover:bg-sky-50 cursor-pointer"
                  onClick={() => navigate(`/admin/bookings/${b.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{String(b.id).slice(0, 8)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{b.project_name}</td>
                  <td className="px-4 py-3 text-gray-700">{b.freelancer?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrencyAmount(depositAmount, 'THB')}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">+{formatCurrencyAmount(commissionAmount, 'THB')}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrencyAmount(netAmount, 'THB')}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(b.updated_at || b.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <p>{rows.length === 0 ? 'No released deposits' : `Showing ${rangeStart}-${rangeEnd} of ${rows.length}${totalReleasedCount > rows.length ? ` (${totalReleasedCount} total)` : ''}`}</p>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={offset + PAGE_SIZE >= rows.length}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// Premium fees is a real ledger (premium_purchases — one row per
// upgrade/renewal), unlike booking commission which is derived on read —
// there's no underlying "booking" row to derive a premium fee from, so it
// has to be recorded at purchase time (see DataService.upgradeToPremium).
function PremiumFeesSection() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [premiumUsers, setPremiumUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOffset, setPurchaseOffset] = useState(0);
  const [userOffset, setUserOffset] = useState(0);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      const [purchasesResponse, usersResponse] = await Promise.all([
        DataService.getPremiumPurchasesForAdmin({ limit: FETCH_LIMIT }),
        DataService.getPremiumUsersForAdmin({ limit: FETCH_LIMIT }),
      ]);
      if (!isMounted) return;
      if (purchasesResponse.error || usersResponse.error) {
        setError((purchasesResponse.error as any)?.message || (usersResponse.error as any)?.message || 'Unable to load Premium earnings.');
      } else {
        setPurchases(purchasesResponse.data);
        setPremiumUsers(usersResponse.data);
      }
      setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalRevenue = useMemo(() => purchases.reduce((acc, p) => acc + Number(p.amount || 0), 0), [purchases]);
  const purchasePageRows = purchases.slice(purchaseOffset, purchaseOffset + PAGE_SIZE);
  const userPageRows = premiumUsers.slice(userOffset, userOffset + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Revenue from Premium subscription upgrades (Group Request, Event Assistant, and the other Premium-only features)</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Premium revenue', value: formatCurrencyAmount(totalRevenue, 'THB'), icon: Crown },
          { label: 'Total Premium purchases', value: String(purchases.length), icon: Receipt },
          { label: 'Current Premium users', value: String(premiumUsers.length), icon: UsersIcon },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-lg">
            <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 p-3">
              <stat.icon className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Premium fee ledger</h3>
        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-100 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Paid via</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : purchasePageRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No Premium purchases yet.</td></tr>
              ) : (
                purchasePageRows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-sky-100 last:border-0 hover:bg-sky-50 cursor-pointer"
                    onClick={() => p.user?.id && navigate(`/admin/users/${p.user.id}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.user?.full_name || '—'}</td>
                    <td className="px-4 py-3 capitalize text-gray-700">{p.plan}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">+{formatCurrencyAmount(Number(p.amount || 0), p.currency || 'THB')}</td>
                    <td className="px-4 py-3 text-gray-500">{p.card_label || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {purchases.length > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
            <p>Showing {Math.min(purchaseOffset + 1, purchases.length)}-{Math.min(purchaseOffset + PAGE_SIZE, purchases.length)} of {purchases.length}</p>
            <div className="flex gap-2">
              <button disabled={purchaseOffset === 0} onClick={() => setPurchaseOffset(Math.max(0, purchaseOffset - PAGE_SIZE))} className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-40">Prev</button>
              <button disabled={purchaseOffset + PAGE_SIZE >= purchases.length} onClick={() => setPurchaseOffset(purchaseOffset + PAGE_SIZE)} className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Premium users</h3>
        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-100 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Premium since</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : userPageRows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No Premium users yet.</td></tr>
              ) : (
                userPageRows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-sky-100 last:border-0 hover:bg-sky-50 cursor-pointer"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5 text-amber-500" /> {u.full_name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email || '—'}</td>
                    <td className="px-4 py-3 capitalize text-gray-700">{u.role}</td>
                    <td className="px-4 py-3 text-gray-500">{u.premium_since ? new Date(u.premium_since).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {premiumUsers.length > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
            <p>Showing {Math.min(userOffset + 1, premiumUsers.length)}-{Math.min(userOffset + PAGE_SIZE, premiumUsers.length)} of {premiumUsers.length}</p>
            <div className="flex gap-2">
              <button disabled={userOffset === 0} onClick={() => setUserOffset(Math.max(0, userOffset - PAGE_SIZE))} className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-40">Prev</button>
              <button disabled={userOffset + PAGE_SIZE >= premiumUsers.length} onClick={() => setUserOffset(userOffset + PAGE_SIZE)} className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
