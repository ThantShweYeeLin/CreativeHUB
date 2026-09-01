import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Briefcase, Compass, Map as MapIcon, Shield, Sparkles, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from '../lib/dataService';

// Rendered once at the app root (not inside MainLayout) so it's available
// on every authenticated page, not just the handful wrapped in MainLayout
// (Explore/Map/For You/Settings) - most pages (Messages, Requests,
// Favorites, any profile, the dashboards) have their own full-bleed layout
// with no shared nav at all, which was the actual "can't get there on
// phone" gap.
export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [canAccessFreelancerDashboard, setCanAccessFreelancerDashboard] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function resolveFreelancerAccess() {
      if (!user?.id || user.role !== 'freelancer') {
        setCanAccessFreelancerDashboard(false);
        return;
      }

      const response = await DataService.getFreelancerProfile(user.id);
      if (!isMounted) {
        return;
      }

      setCanAccessFreelancerDashboard(!response.error && !!response.data);
    }

    resolveFreelancerAccess();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role]);

  const tabs = [
    { label: 'Explore', path: '/explore', icon: Compass, activeMatch: (p: string) => p === '/explore' },
    { label: 'Map', path: '/map', icon: MapIcon, activeMatch: (p: string) => p === '/map' },
    { label: 'For You', path: '/for-you', icon: Sparkles, activeMatch: (p: string) => p === '/for-you' },
    user?.role === 'admin'
      ? { label: 'Admin', path: '/admin', icon: Shield, activeMatch: (p: string) => p.startsWith('/admin') }
      : {
          label: canAccessFreelancerDashboard ? 'Dashboard' : 'Freelance',
          path: canAccessFreelancerDashboard ? '/freelancer-dashboard/requests' : '/become-freelancer',
          icon: Briefcase,
          activeMatch: (p: string) => p.startsWith('/freelancer-dashboard') || p === '/become-freelancer',
        },
    { label: 'Profile', path: user?.id ? `/profile/${user.id}` : '/explore', icon: User, activeMatch: (p: string) => p.startsWith('/profile/') },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1200] flex items-center justify-around border-t border-gray-200 bg-white/95 backdrop-blur-lg py-2 md:hidden">
      {tabs.map((tab) => {
        const isActive = tab.activeMatch(location.pathname);
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            <Icon className="h-5 w-5" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
