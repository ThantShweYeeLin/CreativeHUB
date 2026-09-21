import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Crown, Megaphone, Sparkles, Bell, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from '../lib/dataService';
import { isSubscriptionActive } from '../lib/freelancerPremium';

// A one-time-per-visit "advertisement" for freelancers who don't have Premium.
// Deliberately gentle: shown once per browser session, and once dismissed it
// stays away for a week. Never shown to clients, admins, Premium freelancers,
// or on the Premium page itself.
const SNOOZE_DAYS = 7;
const snoozeKey = (userId: string) => `creativehub.premiumPromo.snoozedUntil.${userId}`;
const sessionKey = (userId: string) => `creativehub.premiumPromo.shown.${userId}`;

const BENEFITS = [
  { icon: Sparkles, text: 'Appear when clients plan events that fit you' },
  { icon: Bell, text: 'Get alerted to new Group Requests in your area' },
  { icon: Megaphone, text: 'Apply to open requests with your own price' },
];

export function PremiumPromo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const onExcludedPage = location.pathname.startsWith('/freelancer-dashboard/premium') || location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!user?.id || user.role !== 'freelancer' || onExcludedPage || visible) return;

    try {
      if (sessionStorage.getItem(sessionKey(user.id))) return;
      const snoozedUntil = Number(localStorage.getItem(snoozeKey(user.id)) || 0);
      if (snoozedUntil > Date.now()) return;
    } catch {
      return; // storage blocked: skip rather than nag on every page
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data } = await DataService.getMySubscription(user.id);
      if (cancelled || isSubscriptionActive(data)) return;
      try {
        sessionStorage.setItem(sessionKey(user.id), '1');
      } catch {
        /* ignore */
      }
      setVisible(true);
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, user?.role, onExcludedPage, visible]);

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
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="premium-promo-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(56,189,248,0.35)]">
        <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500 px-6 pb-8 pt-7 text-white">
          <button onClick={() => dismiss(false)} className="absolute right-4 top-4 rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/25">
            <Crown className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/85">Freelancer Premium</p>
          <h2 id="premium-promo-title" className="mt-1 text-2xl font-bold leading-tight">Get in front of more clients</h2>
          <p className="mt-2 text-sm text-white/90">Unlock Event Matching and open Group Requests — from just ฿99 a month.</p>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-3">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-gray-800">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"><Icon className="h-4 w-4" /></span>
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-500">฿99 / month or ฿999 / year (save ฿189). No auto-renewal. Premium opens doors — it doesn't guarantee bookings.</p>

          <button
            onClick={() => {
              dismiss(true);
              navigate('/freelancer-dashboard/premium');
            }}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 font-semibold text-white shadow-md shadow-sky-500/30 hover:shadow-lg"
          >
            See Premium plans
          </button>
          <button onClick={() => dismiss(true)} className="mt-2 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
