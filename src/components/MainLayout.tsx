import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Menu } from 'lucide-react';
import logoImage from '../imports/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { UserMenu } from '../app/components/UserMenu';
import { NotificationsPanel } from '../app/components/NotificationsPanel';
import { DataService } from '../lib/dataService';
import { ImageWithFallback } from './common/ImageWithFallback';
import { DEFAULT_AVATAR_URL } from '../lib/defaults';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUserAvatar() {
      if (!user?.id) {
        setProfileAvatarUrl(null);
        return;
      }

      const response = await DataService.getUser(user.id);
      if (!isMounted) return;

      if (response.error) {
        setProfileAvatarUrl(user.avatar_url || null);
      } else {
        setProfileAvatarUrl(response.data?.avatar_url || user.avatar_url || null);
      }
    }

    loadUserAvatar();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.avatar_url]);

  const handleMenuSelection = (item: 'requests' | 'messages' | 'favorites' | 'settings' | 'premium' | 'bookings') => {
    setShowUserMenu(false);
    switch (item) {
      case 'requests':
        navigate('/requests');
        break;
      case 'favorites':
        navigate('/favorites');
        break;
      case 'messages':
        navigate('/messages');
        break;
      case 'premium':
        navigate('/premium');
        break;
      case 'bookings':
        navigate('/my-bookings');
        break;
      case 'settings':
        // TODO: Implement settings page
        break;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1680px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <button
              onClick={() => navigate('/explore')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img
                src={logoImage}
                alt="CreativeHUB"
                className="h-12 md:h-14 w-auto object-contain"
              />
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {[
                { label: 'Explore', path: '/explore' },
                { label: 'Map', path: '/map' },
                { label: 'Freelancers', path: '/freelancers' },
                { label: 'For You', path: '/for-you' },
              ].map((tab) => (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="relative py-2 font-semibold transition-colors text-gray-600 hover:text-gray-900"
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => navigate('/freelancer-dashboard/portfolio')}
                className="hidden md:block px-6 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                Freelancer Dashboard
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                {showNotifications && (
                  <NotificationsPanel
                    onClose={() => setShowNotifications(false)}
                    onOpenRequests={() => {
                      setShowNotifications(false);
                      navigate('/requests');
                    }}
                    onOpenMessages={() => {
                      setShowNotifications(false);
                      navigate('/messages');
                    }}
                  />
                )}
              </div>
              <button
                onClick={() => navigate('/client-profile')}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:shadow-lg transition-shadow ring-2 ring-gray-200"
              >
                <ImageWithFallback
                  src={profileAvatarUrl || DEFAULT_AVATAR_URL}
                  alt="Profile picture"
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
                {showUserMenu && (
                  <UserMenu
                    onClose={() => setShowUserMenu(false)}
                    onSelectItem={handleMenuSelection}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-8">
        {children}
      </main>
    </div>
  );
}
