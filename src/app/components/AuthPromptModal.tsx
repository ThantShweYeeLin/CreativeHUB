import { X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

interface AuthPromptModalProps {
  /** What the visitor was trying to do, e.g. "like and save creative work". */
  message: string;
  onClose: () => void;
}

// A "soft gate": shown in place, over whatever the guest was already looking
// at, instead of hard-navigating them away to /login. Dismissing it just
// closes the overlay - nothing about the page underneath is lost. Signing in
// (not signing up - new accounts always go through onboarding first) returns
// the visitor to the exact page they were on via the `from` location state
// that LoginPageWithRouting reads after a successful sign-in.
export function AuthPromptModal({ message, onClose }: AuthPromptModalProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = (path: '/login' | '/signup') => {
    navigate(path, { state: { from: `${location.pathname}${location.search}` } });
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-sky-50 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        <h3 className="pr-6 text-lg font-bold text-gray-900">Create an account to continue</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => goTo('/signup')}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Sign Up
          </button>
          <button
            onClick={() => goTo('/login')}
            className="w-full rounded-xl border border-sky-100 py-2.5 text-sm font-semibold text-gray-700 hover:bg-sky-50"
          >
            Log In
          </button>
          <button
            onClick={onClose}
            className="mt-1 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  );
}
