import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Compass, Map as MapIcon, Shield, Sparkles, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptModal } from '../app/components/AuthPromptModal';

// Rendered once at the app root (not inside MainLayout) so it's available
// on every authenticated page, not just the handful wrapped in MainLayout
// (Explore/Map/For You/Settings) - most pages (Messages, Requests,
// Favorites, any profile, the dashboards) have their own full-bleed layout
// with no shared nav at all, which was the actual "can't get there on
// phone" gap.
//
// The role-specific "Get Started" / "Become a Freelancer" / "Freelancer
// Dashboard" action used to live here as a 4th tab, duplicating the same
// button MainLayout's header already renders (previously desktop-only) -
// now that header button is visible on mobile too, so it's dropped from
// here rather than showing the same destination in two places.
export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  const tabs = [
    { label: 'Explore', path: '/explore', icon: Compass, activeMatch: (p: string) => p === '/explore' },
    { label: 'Map', path: '/map', icon: MapIcon, activeMatch: (p: string) => p === '/map' },
    { label: 'For You', path: '/for-you', icon: Sparkles, activeMatch: (p: string) => p === '/for-you' },
    ...(user?.role === 'admin'
      ? [{ label: 'Admin', path: '/admin', icon: Shield, activeMatch: (p: string) => p.startsWith('/admin') }]
      : []),
    { label: 'Profile', path: user?.id ? `/profile/${user.id}` : '/explore', icon: User, activeMatch: (p: string) => p.startsWith('/profile/'), requiresAuth: true },
  ];

  return (
    <>
    <nav data-tour="nav" className="fixed inset-x-0 bottom-0 z-[1200] flex items-center justify-around border-t border-sky-100 bg-white/95 backdrop-blur-lg py-2 md:hidden">
      {tabs.map((tab) => {
        const isActive = tab.activeMatch(location.pathname);
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            onClick={() => {
              if ('requiresAuth' in tab && tab.requiresAuth && !user?.id) {
                setAuthPromptMessage('Create an account to view and set up your profile.');
                return;
              }
              navigate(tab.path);
            }}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-semibold transition-colors"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                isActive ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30' : 'text-gray-400'
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className={isActive ? 'text-sky-600' : 'text-gray-400'}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
    {authPromptMessage && <AuthPromptModal message={authPromptMessage} onClose={() => setAuthPromptMessage(null)} />}
    </>
  );
}
