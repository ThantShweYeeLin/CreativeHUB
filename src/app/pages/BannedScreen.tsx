import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Takes over every route the instant user.accountStatus === 'banned' (see
// App.tsx) - a banned account keeps just enough of its session to see this
// explanation and sign out deliberately, rather than being silently kicked
// back to a blank login screen with no idea why. This is the UI half of
// the ban; supabase/account_ban_enforcement.sql's RLS triggers are what
// actually stop a banned account from writing anything even if this
// screen were somehow bypassed, and POST /admin/ban (server/src/routes/
// admin.ts) stops them signing back in once their current session expires.
export function BannedScreen() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-[0_8px_30px_rgba(239,68,68,0.15)] md:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Account access restricted</h1>
        <p className="mb-5 text-sm leading-6 text-gray-600">Your CreativeHUB account has been banned.</p>

        <div className="mb-5 space-y-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reason</p>
            <p className="text-gray-900">{user?.accountStatusReason || "Violation of CreativeHUB's Terms of Service"}</p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-6 text-gray-600">
          You can no longer use CreativeHUB to make bookings, communicate with users, or access marketplace features.
          Existing bookings and payment matters will be handled according to platform policy.
        </p>

        <div className="mb-6 rounded-2xl border border-sky-100 bg-white p-4">
          <p className="mb-1 text-sm font-semibold text-gray-900">Need help with an existing booking?</p>
          <p className="text-sm text-gray-600">
            Contact CreativeHUB Support at{' '}
            <a href="mailto:support@creativehub.com" className="font-semibold text-sky-600 hover:underline">
              support@creativehub.com
            </a>{' '}
            to ask about outstanding bookings, payments, or an available appeal process.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-xl border border-sky-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-sky-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
