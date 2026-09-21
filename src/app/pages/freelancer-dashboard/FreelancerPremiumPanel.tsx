import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, Crown, Lock, Printer, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import {
  BRAND_LABEL,
  createDemoToken,
  cvcLength,
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  parseExpiry,
  validateCardForm,
  type CardFormErrors,
} from '../../../lib/demoCard';
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

const PROCESSING_STEPS = ['Securing your payment…', 'Contacting your bank…', 'Confirming your payment…'];

interface Receipt {
  reference: string;
  plan: PremiumPlan;
  amountThb: number;
  paidAt: string;
  validUntil: string | null;
  cardLabel: string | null;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const formatDateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const shortRef = (chargeId: string) => `CH-${chargeId.replace(/^chrg_(demo_)?/, '').slice(0, 10).toUpperCase()}`;
const baht = (amount: number) => `฿${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FreelancerPremiumPanel() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<FreelancerSubscription | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [mode, setMode] = useState<'demo' | 'omise'>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PremiumPlan>('monthly');
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [processingStep, setProcessingStep] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const stepTimer = useRef<number | null>(null);

  const active = isSubscriptionActive(subscription);
  const brand = detectBrand(card.number);
  const errors: CardFormErrors = validateCardForm(card);
  const isProcessing = processingStep !== null;

  const load = async () => {
    if (!user?.id) return;
    const [{ data }, history] = await Promise.all([DataService.getMySubscription(user.id), DataService.getPaymentHistory(user.id)]);
    setSubscription(data);
    setPayments(history.data);
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    void DataService.getPremiumMode().then(setMode);
    return () => { if (stepTimer.current) window.clearInterval(stepTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Coming back from the card issuer's 3-D Secure page (real payments only):
  // the server re-checks the charge with the provider before granting anything.
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
      if (error) setMessage({ tone: 'error', text: error.message });
      else {
        setMessage({ tone: 'success', text: 'Payment confirmed — Premium is now active.' });
        await load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showError = (field: keyof CardFormErrors) => (touched[field] ? errors[field] : undefined);

  const handlePay = async () => {
    setMessage(null);
    setTouched({ name: true, number: true, expiry: true, cvc: true });
    if (Object.keys(errors).length > 0) return;

    // A realistic pause with progress messages, never shorter than the request itself.
    setProcessingStep(0);
    let step = 0;
    stepTimer.current = window.setInterval(() => {
      step = Math.min(step + 1, PROCESSING_STEPS.length - 1);
      setProcessingStep(step);
    }, 900);
    const minimum = new Promise((resolve) => setTimeout(resolve, 2400));

    const exp = parseExpiry(card.expiry)!;
    const request =
      mode === 'demo'
        ? DataService.startPremiumCheckout(plan, { demoToken: createDemoToken(card) })
        : DataService.startPremiumCheckout(plan, {
            name: card.name.trim(),
            number: card.number,
            expirationMonth: exp.month,
            expirationYear: exp.year,
            securityCode: card.cvc,
          });
    const [{ data, error }] = await Promise.all([request, minimum]);

    if (stepTimer.current) window.clearInterval(stepTimer.current);
    setProcessingStep(null);

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

    const r = data.receipt;
    setReceipt({
      reference: shortRef(data.chargeId),
      plan,
      amountThb: (r?.amountSatang ?? PREMIUM_PLANS[plan].priceThb * 100) / 100,
      paidAt: r?.paidAt ?? new Date().toISOString(),
      validUntil: r?.validUntil ?? null,
      cardLabel: r?.card ? `${r.card.brand} •••• ${r.card.last4}` : `${BRAND_LABEL[brand]} •••• ${digitsOnly(card.number).slice(-4)}`,
    });
    setCard({ name: '', number: '', expiry: '', cvc: '' });
    setTouched({});
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

  const openReceiptFor = (payment: any) =>
    setReceipt({
      reference: shortRef(payment.omise_charge_id),
      plan: payment.plan,
      amountThb: payment.amount_satang / 100,
      paidAt: payment.created_at,
      validUntil: payment.period_end,
      cardLabel: payment.card_last4 ? `${payment.card_brand || 'Card'} •••• ${payment.card_last4}` : null,
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </div>
    );
  }

  const inputClass = (field: keyof CardFormErrors) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
      showError(field) ? 'border-red-300 focus:ring-red-200' : 'border-sky-100 focus:ring-sky-300'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Freelancer Premium</h2>
        <p className="text-sm text-gray-600 md:text-base">Reach more opportunities. Your profile, portfolio and normal bookings stay free.</p>
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
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

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
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

        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handlePay();
            }}
            noValidate
          >
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><CreditCard className="h-4 w-4" /> Pay by card</p>
              <div className="flex gap-1 text-[10px] font-bold text-gray-400">
                {(['visa', 'mastercard', 'amex', 'jcb'] as const).map((b) => (
                  <span key={b} className={`rounded border px-1.5 py-0.5 uppercase ${brand === b ? 'border-sky-500 text-sky-600' : 'border-gray-200'}`}>{b === 'mastercard' ? 'MC' : b === 'amex' ? 'AMEX' : b}</span>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Name on card</label>
              <input
                value={card.name}
                onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                autoComplete="cc-name"
                placeholder="As shown on your card"
                className={inputClass('name')}
              />
              {showError('name') && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Card number</label>
              <div className="relative">
                <input
                  value={card.number}
                  onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                  onBlur={() => setTouched((t) => ({ ...t, number: true }))}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 1234 1234 1234"
                  className={`${inputClass('number')} pr-24`}
                />
                {brand !== 'card' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-sky-600">{BRAND_LABEL[brand]}</span>}
              </div>
              {showError('number') && <p className="mt-1 text-xs text-red-600">{errors.number}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Expiry</label>
                <input
                  value={card.expiry}
                  onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                  onBlur={() => setTouched((t) => ({ ...t, expiry: true }))}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  className={inputClass('expiry')}
                />
                {showError('expiry') && <p className="mt-1 text-xs text-red-600">{errors.expiry}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Security code</label>
                <input
                  value={card.cvc}
                  onChange={(e) => setCard((c) => ({ ...c, cvc: digitsOnly(e.target.value).slice(0, cvcLength(brand)) }))}
                  onBlur={() => setTouched((t) => ({ ...t, cvc: true }))}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder={brand === 'amex' ? '4 digits' : '3 digits'}
                  className={inputClass('cvc')}
                />
                {showError('cvc') && <p className="mt-1 text-xs text-red-600">{errors.cvc}</p>}
              </div>
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              Pay {baht(PREMIUM_PLANS[plan].priceThb)}
            </button>
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                We never store your card number.
                {mode === 'demo' && ' Demo checkout — no real payment is taken, so try 4242 4242 4242 4242 with any future expiry.'}
              </span>
            </p>
          </form>

          <aside className="h-fit rounded-xl bg-sky-50/60 p-4 text-sm">
            <p className="mb-3 font-semibold text-gray-900">Order summary</p>
            <div className="flex justify-between text-gray-700">
              <span>Freelancer Premium<br /><span className="text-xs text-gray-500">{PREMIUM_PLANS[plan].label} · one-off, no auto-renewal</span></span>
              <span className="font-semibold">{baht(PREMIUM_PLANS[plan].priceThb)}</span>
            </div>
            <div className="mt-3 border-t border-sky-100 pt-3">
              <div className="flex justify-between font-bold text-gray-900"><span>Total today</span><span>{baht(PREMIUM_PLANS[plan].priceThb)}</span></div>
              <p className="mt-2 text-xs text-gray-500">
                {active && subscription
                  ? `Extends your access from ${formatDate(subscription.current_period_end)}.`
                  : `Access starts immediately and lasts one ${PREMIUM_PLANS[plan].period}.`}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-lg">
          <h3 className="mb-3 font-bold text-gray-900">Payment history</h3>
          <div className="divide-y divide-sky-100">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">Freelancer Premium — {PREMIUM_PLANS[payment.plan as PremiumPlan]?.label ?? payment.plan}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(payment.created_at)} · {shortRef(payment.omise_charge_id)}{payment.card_last4 ? ` · ${payment.card_brand || 'Card'} •••• ${payment.card_last4}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{baht(payment.amount_satang / 100)}</span>
                  <button onClick={() => openReceiptFor(payment)} className="text-sm font-semibold text-sky-600 hover:text-sky-700">Receipt</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="w-full max-w-xs rounded-2xl bg-white p-8 text-center shadow-[0_20px_60px_rgba(56,189,248,0.3)]">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
            <p className="font-semibold text-gray-900">{PROCESSING_STEPS[processingStep ?? 0]}</p>
            <p className="mt-1 text-xs text-gray-500">Please don't close or refresh this page.</p>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(56,189,248,0.25)] print:shadow-none" id="premium-receipt">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-6 w-6" /></div>
                <div>
                  <p className="text-lg font-bold text-gray-900">Payment successful</p>
                  <p className="text-xs text-gray-500">Thank you — Premium is active on your account.</p>
                </div>
              </div>
              <button onClick={() => setReceipt(null)} className="text-gray-400 hover:text-gray-900 print:hidden" aria-label="Close receipt"><X className="h-5 w-5" /></button>
            </div>
            <div className="rounded-xl border border-sky-100 p-4 text-sm">
              <div className="mb-3 text-center">
                <p className="text-xs uppercase tracking-wide text-gray-400">Amount paid</p>
                <p className="text-3xl font-bold text-gray-900">{baht(receipt.amountThb)}</p>
              </div>
              <dl className="space-y-2">
                {[
                  ['Item', `Freelancer Premium — ${PREMIUM_PLANS[receipt.plan].label}`],
                  ['Reference', receipt.reference],
                  ['Date', formatDateTime(receipt.paidAt)],
                  ...(receipt.cardLabel ? [['Paid with', receipt.cardLabel]] : []),
                  ...(receipt.validUntil ? [['Premium valid until', formatDate(receipt.validUntil)]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-900">{value}</dd></div>
                ))}
              </dl>
            </div>
            <div className="mt-4 flex gap-3 print:hidden">
              <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-sky-50"><Printer className="h-4 w-4" /> Print</button>
              <button onClick={() => setReceipt(null)} className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
