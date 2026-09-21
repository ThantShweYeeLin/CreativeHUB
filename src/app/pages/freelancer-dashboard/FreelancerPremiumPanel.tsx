import { useEffect, useState } from 'react';
import { CheckCircle2, Crown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import {
  isSubscriptionActive,
  PREMIUM_PLANS,
  type FreelancerSubscription,
  type PremiumPlan,
} from '../../../lib/freelancerPremium';

const PENDING_CHARGE_KEY = 'creativehub.premium.pendingCharge';

const INCLUDED = [
  'Appear in Event Matcher results when a client is planning an event that fits you',
  'Get notified about relevant new Group Requests in your category and area',
  'Discover open Group Requests and apply to them with your own price',
  'Track every application and get notified when a client responds',
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function FreelancerPremiumPanel() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<FreelancerSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PremiumPlan>('monthly');
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [isPaying, setIsPaying] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const active = isSubscriptionActive(subscription);

  const load = async () => {
    if (!user?.id) return;
    const { data } = await DataService.getMySubscription(user.id);
    setSubscription(data);
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Coming back from the card issuer's 3-D Secure page: the server re-checks
  // the charge with Omise before granting anything.
  useEffect(() => {
    let pendingChargeId: string | null = null;
    try {
      pendingChargeId = sessionStorage.getItem(PENDING_CHARGE_KEY);
    } catch {
      return;
    }
    if (!pendingChargeId) return;
    sessionStorage.removeItem(PENDING_CHARGE_KEY);
    void (async () => {
      const { error } = await DataService.confirmPremiumCharge(pendingChargeId!);
      if (error) {
        setMessage({ tone: 'error', text: error.message });
      } else {
        setMessage({ tone: 'success', text: 'Payment confirmed — Premium is now active.' });
        await load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    setMessage(null);
    const [monthPart, yearPart] = card.expiry.split('/').map((part) => part.trim());
    const expirationMonth = Number(monthPart);
    const expirationYear = Number(yearPart?.length === 2 ? `20${yearPart}` : yearPart);
    if (!card.name.trim() || card.number.replace(/\s+/g, '').length < 12 || !expirationMonth || !expirationYear || card.cvc.length < 3) {
      setMessage({ tone: 'error', text: 'Enter the cardholder name, card number, expiry (MM/YY) and security code.' });
      return;
    }

    setIsPaying(true);
    const { data, error } = await DataService.startPremiumCheckout(plan, {
      name: card.name.trim(),
      number: card.number,
      expirationMonth,
      expirationYear,
      securityCode: card.cvc,
    });
    setIsPaying(false);

    if (error || !data) {
      setMessage({ tone: 'error', text: error?.message || 'Payment failed.' });
      return;
    }

    if (data.status === 'pending' && data.authorizeUri) {
      try {
        sessionStorage.setItem(PENDING_CHARGE_KEY, data.chargeId);
      } catch {
        // Without storage the user can still finish; they just re-open this page.
      }
      window.location.href = data.authorizeUri;
      return;
    }

    setCard({ name: '', number: '', expiry: '', cvc: '' });
    setMessage({ tone: 'success', text: 'Payment received — Premium is now active.' });
    await load();
  };

  const handleCancel = async () => {
    setMessage(null);
    const { error } = await DataService.cancelPremium();
    setConfirmingCancel(false);
    if (error) {
      setMessage({ tone: 'error', text: error.message });
      return;
    }
    setMessage({ tone: 'success', text: 'Renewal cancelled. You keep Premium until the end of your paid period.' });
    await load();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Freelancer Premium</h2>
        <p className="text-sm text-gray-600 md:text-base">Reach more opportunities. Your profile, portfolio and normal bookings stay free.</p>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-2xl text-white ${active ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gray-300'}`}>
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{active ? 'Premium is active' : subscription ? 'Premium has expired' : 'You are on the free plan'}</p>
              {subscription && (
                <p className="text-sm text-gray-600">
                  {active
                    ? subscription.status === 'cancelled'
                      ? `Renewal cancelled — access until ${formatDate(subscription.current_period_end)}`
                      : `${PREMIUM_PLANS[subscription.plan].label} plan — paid through ${formatDate(subscription.current_period_end)}`
                    : `Ended ${formatDate(subscription.current_period_end)}. Your existing applications and bookings are unaffected.`}
                </p>
              )}
            </div>
          </div>
          {active && subscription?.status === 'active' && (
            <button onClick={() => setConfirmingCancel(true)} className="text-sm font-semibold text-gray-500 underline hover:text-gray-800">
              Cancel Premium
            </button>
          )}
        </div>
        {confirmingCancel && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              Premium never renews automatically, so you won't be charged again. Cancelling just records that you don't intend to renew — you keep every Premium feature until{' '}
              {subscription ? formatDate(subscription.current_period_end) : 'the end of your period'}.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void handleCancel()} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white">Cancel Premium</button>
              <button onClick={() => setConfirmingCancel(false)} className="rounded-lg px-3 py-1.5 font-semibold text-gray-700 hover:bg-amber-100">Keep it</button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
        <h3 className="mb-3 font-bold text-gray-900">What Premium includes</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          {INCLUDED.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-gray-600">
          Premium gives you access to more opportunities. It does not guarantee you'll be selected, and it doesn't change how your skills or reviews are shown to clients.
        </p>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
        <h3 className="mb-1 font-bold text-gray-900">{active ? 'Extend Premium' : 'Get Premium'}</h3>
        {active && <p className="mb-3 text-sm text-gray-600">Buying another period adds it to the end of your current one.</p>}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(PREMIUM_PLANS) as PremiumPlan[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPlan(id)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${plan === id ? 'border-sky-500 bg-sky-50' : 'border-sky-100 hover:border-sky-300'}`}
            >
              <p className="font-semibold text-gray-900">{PREMIUM_PLANS[id].label}</p>
              <p className="text-2xl font-bold text-gray-900">
                ฿{PREMIUM_PLANS[id].priceThb}
                <span className="text-sm font-medium text-gray-500"> / {PREMIUM_PLANS[id].period}</span>
              </p>
              {PREMIUM_PLANS[id].note && <p className="mt-1 text-xs text-green-700">{PREMIUM_PLANS[id].note}</p>}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={card.name}
            onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
            placeholder="Name on card"
            autoComplete="cc-name"
            className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 sm:col-span-2"
          />
          <input
            value={card.number}
            onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) }))}
            placeholder="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 sm:col-span-2"
          />
          <input
            value={card.expiry}
            onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value.replace(/[^\d/]/g, '').slice(0, 5) }))}
            placeholder="MM/YY"
            inputMode="numeric"
            autoComplete="cc-exp"
            className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          <input
            value={card.cvc}
            onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="Security code"
            inputMode="numeric"
            autoComplete="cc-csc"
            className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>

        <button
          onClick={() => void handlePay()}
          disabled={isPaying}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
        >
          {isPaying ? 'Processing…' : `Pay ฿${PREMIUM_PLANS[plan].priceThb} for ${PREMIUM_PLANS[plan].period === 'year' ? 'a year' : 'a month'}`}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Card details go directly to our payment provider (Omise) and never touch our servers. Premium is a one-off payment for the period you choose and does not renew automatically.
        </p>
      </div>
    </div>
  );
}
