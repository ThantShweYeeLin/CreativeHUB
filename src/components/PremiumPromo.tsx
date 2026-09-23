import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Bell, Check, Crown, Megaphone, Sparkles, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePremiumPromoAudience } from '../lib/usePremiumEligibility';

// A one-time-per-visit "advertisement" for freelancers who don't have Premium.
// Deliberately gentle: shown once per browser session, and once dismissed it
// stays away for a week. Never shown to clients, admins, Premium freelancers,
// or on the Premium page itself.
const SNOOZE_DAYS = 7;
const SHOW_DELAY_MS = 1800;
const snoozeKey = (userId: string) => `creativehub.premiumPromo.snoozedUntil.${userId}`;
const sessionKey = (userId: string) => `creativehub.premiumPromo.shown.${userId}`;

const BENEFITS = [
  { icon: Sparkles, title: 'Priority Event Matching', text: 'Get matched first when clients plan events that fit you' },
  { icon: Bell, title: 'Instant alerts', text: 'Hear about new Group Requests in your area first' },
  { icon: Megaphone, title: 'Apply with your price', text: 'Respond to open requests on your own terms' },
];

export function PremiumPromo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const audience = usePremiumPromoAudience();
  const [visible, setVisible] = useState(false);

  const onExcludedPage = location.pathname.startsWith('/freelancer-dashboard/premium') || location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!audience || !user?.id || onExcludedPage || visible) return;
    try {
      if (sessionStorage.getItem(sessionKey(user.id))) return;
      if (Number(localStorage.getItem(snoozeKey(user.id)) || 0) > Date.now()) return;
    } catch {
      return; // storage blocked: skip rather than nag on every page
    }
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(sessionKey(user.id), '1');
      } catch {
        /* ignore */
      }
      setVisible(true);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [audience, user?.id, onExcludedPage, visible]);

  if (!visible || !user?.id || onExcludedPage) return null;

  const dismiss = (snooze: boolean) => {
    if (snooze) {
      try {
        localStorage.setItem(snoozeKey(user.id), String(Date.now() + SNOOZE_DAYS * 86400000));
      } catch {
        /* ignore */
      }
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="premium-promo-title">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-sky-100 bg-white p-7 shadow-[0_24px_70px_rgba(14,116,144,0.25)]">
        {/* soft glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-sky-100/80 blur-3xl" aria-hidden="true" />
        <button onClick={() => dismiss(false)} className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">
            <Crown className="h-3.5 w-3.5" /> Freelancer Premium
          </span>
          <h2 id="premium-promo-title" className="mt-4 text-[26px] font-bold leading-tight text-gray-900">
            Get found by more <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">clients</span>
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">Unlock the tools that put your work in front of people who are actively planning.</p>

          <ul className="mt-5 space-y-3.5">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{title}</span>
                  <span className="block text-sm text-gray-500">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3">
              <p className="text-xs font-semibold text-gray-500">Monthly</p>
              <p className="text-2xl font-bold text-gray-900">฿99</p>
            </div>
            <div className="relative rounded-2xl border-2 border-sky-500 bg-white px-4 py-3">
              <span className="absolute -top-2.5 right-3 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Best value</span>
              <p className="text-xs font-semibold text-gray-500">Yearly</p>
              <p className="text-2xl font-bold text-gray-900">฿999</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
            One-off payment, no auto-renewal. Premium opens doors — it doesn't guarantee bookings.
          </p>

          <button
            onClick={() => {
              dismiss(true);
              navigate('/freelancer-dashboard/premium');
            }}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-sky-500/30 transition-shadow hover:shadow-xl"
          >
            Get Premium
          </button>
          <button onClick={() => dismiss(true)} className="mt-1.5 w-full rounded-2xl px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
