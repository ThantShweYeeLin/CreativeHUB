import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Crown, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePremiumPromoAudience } from '../lib/usePremiumEligibility';

// Slim, always-there reminder on Explore for freelancers without Premium - the
// quieter companion to the one-time popup. Dismissing hides it for 3 days.
const SNOOZE_DAYS = 3;
const snoozeKey = (userId: string) => `creativehub.premiumBanner.snoozedUntil.${userId}`;

export function PremiumBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audience = usePremiumPromoAudience();
  const [dismissed, setDismissed] = useState(false);

  if (!audience || !user?.id || dismissed) return null;
  try {
    if (Number(localStorage.getItem(snoozeKey(user.id)) || 0) > Date.now()) return null;
  } catch {
    return null;
  }

  return (
    <div className="relative z-10 mb-6 flex items-center gap-3 rounded-2xl border border-sky-100 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-sm sm:gap-4 sm:px-5" role="region" aria-label="Freelancer Premium">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
        <Crown className="h-5 w-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-gray-700">
        <span className="font-semibold text-gray-900">Get noticed by more clients.</span>{' '}
        <span className="hidden sm:inline">Event Matching and open Group Requests with Premium — from ฿99/month.</span>
      </p>
      <button
        onClick={() => navigate('/freelancer-dashboard/premium')}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/25 hover:shadow-lg"
      >
        Learn more <ArrowRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => {
          try {
            localStorage.setItem(snoozeKey(user.id), String(Date.now() + SNOOZE_DAYS * 86400000));
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
