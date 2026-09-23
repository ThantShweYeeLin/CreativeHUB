import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, ChevronLeft, Crown, MapPin } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { formatCurrencyAmount } from '../../../lib/currency';
import { DataService } from '../../../lib/dataService';
import {
  applicationStatusLabel,
  isSubscriptionActive,
  OPPORTUNITY_ERROR_MESSAGE,
  opportunityErrorCode,
  type FreelancerSubscription,
  type GroupApplication,
  type GroupOpportunity,
  type OpportunityRole,
} from '../../../lib/freelancerPremium';
import { formatTimeLabel } from '../../../lib/requestSchedule';

const TONE_CLASS = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-200 text-gray-600',
} as const;

function formatEventDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimes(opportunity: Pick<GroupOpportunity, 'start_time' | 'end_time'>) {
  if (!opportunity.start_time) return null;
  return opportunity.end_time
    ? `${formatTimeLabel(opportunity.start_time)} – ${formatTimeLabel(opportunity.end_time)}`
    : formatTimeLabel(opportunity.start_time);
}

export function FreelancerOpportunitiesPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<'open' | 'applications'>('open');
  const [subscription, setSubscription] = useState<FreelancerSubscription | null>(null);
  const [opportunities, setOpportunities] = useState<GroupOpportunity[]>([]);
  const [applications, setApplications] = useState<GroupApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GroupOpportunity | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const active = isSubscriptionActive(subscription);

  const load = async () => {
    if (!user?.id) return;
    setError(null);
    const [subResponse, appsResponse] = await Promise.all([
      DataService.getMySubscription(user.id),
      DataService.getMyGroupApplications(),
    ]);
    setSubscription(subResponse.data);
    setApplications(appsResponse.data);

    // Only Premium freelancers can discover open requests; the database
    // refuses everyone else, so a free user is simply never asked to.
    if (isSubscriptionActive(subResponse.data)) {
      const oppResponse = await DataService.getGroupOpportunities();
      if (oppResponse.error) {
        setError(opportunityErrorCode(oppResponse.error.message) ? null : oppResponse.error.message);
        setOpportunities([]);
      } else {
        setOpportunities(oppResponse.data);
      }
    } else {
      setOpportunities([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openDetail = async (opportunity: GroupOpportunity) => {
    setError(null);
    const { data, error: detailError } = await DataService.getGroupOpportunity(opportunity.id);
    if (detailError || !data) {
      const code = opportunityErrorCode(detailError?.message);
      setError(code ? OPPORTUNITY_ERROR_MESSAGE[code] : detailError?.message || 'Unable to open this request.');
      return;
    }
    setSelected(data);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </div>
    );
  }

  if (selected) {
    return (
      <OpportunityDetail
        opportunity={selected}
        canApply={active}
        onBack={() => setSelected(null)}
        onApplied={async () => {
          setSelected(null);
          setSuccess("Application sent. You'll be notified when the client responds.");
          setTab('applications');
          await load();
        }}
        onUpgrade={() => navigate('/freelancer-dashboard/premium')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Opportunities</h2>
        <p className="text-sm text-gray-600 md:text-base">Open Group Requests that fit your category, area and availability.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="flex gap-2">
        {([
          ['open', `Open requests${active ? ` (${opportunities.length})` : ''}`],
          ['applications', `My applications (${applications.length})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === id ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-sky-50 text-gray-700 hover:bg-sky-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'open' ? (
        !active ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 text-center">
            <Crown className="mx-auto mb-2 h-8 w-8 text-amber-500" />
            <p className="font-bold text-gray-900">
              {subscription ? 'Your Premium has ended' : 'Open Group Requests are a Premium feature'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
              Premium freelancers can discover and apply to open Group Requests. Your existing applications{subscription ? ' and bookings' : ''} stay visible in “My applications”.
            </p>
            <button
              onClick={() => navigate('/freelancer-dashboard/premium')}
              className="mt-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
            >
              {subscription ? 'Renew Premium' : 'See Premium plans'}
            </button>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center text-gray-600 shadow-lg">
            No open requests match you right now. We'll notify you when one does.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {opportunities.map((opportunity) => {
              const myRoles = opportunity.roles.filter((role) => role.eligible);
              // has_applied only ever means "I applied at some point" - it
              // doesn't say what happened since, so a declined application
              // kept showing this card as a flat green "Applied" forever.
              // Cross-reference the same applications this freelancer's own
              // "My applications" tab already fetches to show what's
              // actually true now (Declined, Accepted, Under review, ...).
              const myApplication = applications.find((application) => application.opportunity_id === opportunity.id);
              const appliedStatus = myApplication ? applicationStatusLabel(myApplication) : null;
              return (
                <div key={opportunity.id} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900">{opportunity.title}</h3>
                    {opportunity.has_applied && (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${appliedStatus ? TONE_CLASS[appliedStatus.tone] : 'bg-green-100 text-green-700'}`}>
                        {appliedStatus?.label || 'Applied'}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    {formatEventDate(opportunity.event_date)}
                    {formatTimes(opportunity) ? ` · ${formatTimes(opportunity)}` : ''}
                  </p>
                  {opportunity.location_city && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {opportunity.location_city}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {myRoles.map((role) => (
                      <span key={role.id} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        {role.category} · {formatCurrencyAmount(role.budget, role.currency)}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => void openDetail(opportunity)}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg"
                  >
                    {opportunity.has_applied ? 'View' : 'View & apply'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center text-gray-600 shadow-lg">You haven't applied to any Group Requests yet.</div>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const status = applicationStatusLabel(application);
            return (
              <div key={application.id} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-gray-900">{application.title}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[status.tone]}`}>{status.label}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {application.category} · {formatEventDate(application.event_date)}
                  {application.location_city ? ` · ${application.location_city}` : ''}
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  Your offer: <span className="font-semibold">{formatCurrencyAmount(application.proposed_price, application.currency)}</span>
                  {application.request_status === 'countered' && application.counter_by === 'client' && application.counter_price != null && (
                    <>
                      {' '}· Client's counter: <span className="font-semibold">{formatCurrencyAmount(application.counter_price, application.currency)}</span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-500">Applied {new Date(application.applied_at).toLocaleDateString()}</p>
                <button
                  onClick={() => navigate('/freelancer-dashboard/requests')}
                  className="mt-3 text-sm font-semibold text-sky-600 hover:text-sky-700"
                >
                  {application.request_status === 'accepted' ? 'View in Requests & Bookings' : 'Respond in Requests'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpportunityDetail({
  opportunity,
  canApply,
  onBack,
  onApplied,
  onUpgrade,
}: {
  opportunity: GroupOpportunity;
  canApply: boolean;
  onBack: () => void;
  onApplied: () => void | Promise<void>;
  onUpgrade: () => void;
}) {
  const applyable = opportunity.roles.filter((role) => role.eligible);
  const [roleId, setRoleId] = useState<string>(applyable[0]?.id || '');
  const role: OpportunityRole | undefined = opportunity.roles.find((item) => item.id === roleId);
  const [price, setPrice] = useState<string>(applyable[0] ? String(applyable[0].budget) : '');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!role) return;
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter the price you would charge for this role.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { error: applyError } = await DataService.applyToGroupOpportunity(role.id, amount, message.trim());
    setIsSubmitting(false);
    if (applyError) {
      const code = opportunityErrorCode(applyError.message);
      setError(code ? OPPORTUNITY_ERROR_MESSAGE[code] : applyError.message || 'Unable to send your application.');
      return;
    }
    await onApplied();
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-black">
        <ChevronLeft className="h-4 w-4" />
        Back to opportunities
      </button>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
        <h2 className="text-xl font-bold text-gray-900">{opportunity.title}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          {formatEventDate(opportunity.event_date)}
          {formatTimes(opportunity) ? ` · ${formatTimes(opportunity)}` : ''}
        </p>
        {opportunity.location_city && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            {opportunity.location_city} <span className="text-xs text-gray-400">(exact location is shared once a booking is confirmed)</span>
          </p>
        )}
        {opportunity.description && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{opportunity.description}</p>}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
        <h3 className="mb-3 font-bold text-gray-900">Roles</h3>
        <div className="space-y-2">
          {opportunity.roles.map((item) => (
            <div key={item.id} className={`rounded-xl border p-3 text-sm ${item.eligible ? 'border-sky-200 bg-sky-50/40' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{item.category}</p>
                <p>{formatCurrencyAmount(item.budget, item.currency)} budget</p>
              </div>
              <p className="text-xs">
                {item.slots_filled >= item.slots ? 'Filled' : `${item.slots - item.slots_filled} of ${item.slots} spot${item.slots === 1 ? '' : 's'} open`}
                {item.styles.length > 0 ? ` · ${item.styles.join(', ')}` : ''}
              </p>
              {item.note && <p className="mt-1 text-xs text-gray-600">{item.note}</p>}
              {!item.eligible && <p className="mt-1 text-xs">Not a match for your profile, area or availability.</p>}
            </div>
          ))}
        </div>
      </div>

      {opportunity.has_applied ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          You've applied to this request. Track it under “My applications”.
        </div>
      ) : !canApply ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 text-center">
          <p className="font-semibold text-gray-900">An active Premium subscription is needed to apply.</p>
          <button onClick={onUpgrade} className="mt-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white">
            See Premium plans
          </button>
        </div>
      ) : applyable.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-white p-4 text-sm text-gray-600 shadow-lg">There's no role here you can apply for.</div>
      ) : (
        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
          <h3 className="mb-3 font-bold text-gray-900">Apply</h3>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Role</label>
          <select
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              const next = applyable.find((item) => item.id === e.target.value);
              if (next) setPrice(String(next.budget));
            }}
            className="mb-3 w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            {applyable.map((item) => (
              <option key={item.id} value={item.id}>{item.category}</option>
            ))}
          </select>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Your price {role ? `(${role.currency})` : ''}</label>
          <input
            type="number"
            min="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mb-3 w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          <label className="mb-1 block text-xs font-semibold text-gray-600">Message to the client (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            placeholder="Tell them why you're a good fit…"
            className="mb-3 min-h-[90px] w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Send application'}
          </button>
          <p className="mt-2 text-xs text-gray-500">The client reviews your application in the normal request flow and may accept, counter or decline it.</p>
        </div>
      )}
    </div>
  );
}
