import { Crown, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

interface PremiumGateProps {
  children: React.ReactNode;
  /** e.g. "Group Request" / "Event Assistant" — used in the paywall copy. */
  featureName: string;
  featureDescription: string;
}

// Sits inside ProtectedRoute at the route level (see App.tsx's /group-request
// and /event-matcher routes) — auth is already guaranteed by the time this
// runs, so it only has one thing to check: is_premium (see
// DataService.upgradeToPremium and premium_subscription.sql).
export function PremiumGate({ children, featureName, featureDescription }: PremiumGateProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user?.isPremium) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50 px-4">
        <div className="max-w-md w-full rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(56,189,248,0.2)]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/40">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
            <Crown className="h-3 w-3" /> Premium Feature
          </p>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{featureName}</h1>
          <p className="mt-2 text-sm text-gray-600">{featureDescription}</p>
          <button
            onClick={() => navigate('/premium')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition-transform hover:scale-[1.02]"
          >
            <Sparkles className="h-4 w-4" /> Upgrade to Premium
          </button>
          <button
            onClick={() => navigate(-1)}
            className="mt-3 w-full text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
