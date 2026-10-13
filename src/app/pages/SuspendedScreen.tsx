import { AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Takes over every route when a user's account is temporarily suspended.
// A suspended account is restricted from marketplace actions (creating
// bookings, messaging, applying for work, creating posts), but existing
// booking records are preserved and the user can contact support.
// Once the suspension expires or an admin reactivates the account, access
// is automatically restored.
export function SuspendedScreen() {
  const { user, signOut } = useAuth();

  const formattedPeriod = (() => {
    if (!user?.suspensionExpiresAt) {
      return 'Until further review';
    }
    const expiryDate = new Date(user.suspensionExpiresAt);
    if (isNaN(expiryDate.getTime())) {
      return 'Until further review';
    }
    const dateStr = expiryDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = expiryDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    return `Until ${dateStr} at ${timeStr}, or until further review.`;
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-[0_8px_30px_rgba(245,158,11,0.15)] md:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Your account is temporarily suspended</h1>
        <p className="mb-5 text-sm leading-6 text-gray-600">
          Some CreativeHUB features are unavailable while your account is suspended.
        </p>

        <div className="mb-5 space-y-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Reason</p>
            <p className="mt-0.5 text-gray-900">
              {user?.accountStatusReason || 'Account under review following a reported policy violation.'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Suspension period</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-gray-900 font-medium">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>{formattedPeriod}</span>
            </div>
          </div>
        </div>

        <p className="mb-5 text-sm leading-6 text-gray-600">
          You cannot create bookings, send messages, or use marketplace features during this period.
          Existing bookings and payment matters will be handled separately.
        </p>

        <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
          <p className="mb-1 text-sm font-semibold text-gray-900">Need assistance?</p>
          <p className="text-sm text-gray-600">
            Contact Support about the suspension or any existing bookings at{' '}
            <a href="mailto:support@creativehub.com" className="font-semibold text-sky-600 hover:underline">
              support@creativehub.com
            </a>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-xl border border-sky-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-sky-50 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
