import { Send, MessageCircle, Heart, Settings, LogOut, LogIn, Package, Users, Bookmark, Ticket } from 'lucide-react';

interface UserMenuProps {
  onClose: () => void;
  onSelectItem: (item: 'requests' | 'messages' | 'favorites' | 'savedPosts' | 'settings' | 'bookings' | 'groupRequest' | 'tickets') => void;
  onLogout: () => void;
  isAuthenticated: boolean;
  onGoToLogin: () => void;
}

export function UserMenu({ onClose, onSelectItem, onLogout, isAuthenticated, onGoToLogin }: UserMenuProps) {
  const menuItems = [
    { id: 'bookings' as const, label: 'My Booked List', icon: Package },
    { id: 'requests' as const, label: 'My Requests', icon: Send },
    { id: 'groupRequest' as const, label: 'Group Request', icon: Users },
    { id: 'messages' as const, label: 'Messages', icon: MessageCircle },
    { id: 'favorites' as const, label: 'Favorites', icon: Heart },
    { id: 'savedPosts' as const, label: 'Saved Posts', icon: Bookmark },
    { id: 'tickets' as const, label: 'Create a Ticket', icon: Ticket },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ] as const;

  type MenuItemId = UserMenuProps['onSelectItem'] extends (item: infer T) => any ? T : never;

  const handleClick = (item: MenuItemId) => {
    onSelectItem(item);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1205]"
        onClick={onClose}
      />

      {/* Menu Dropdown */}
      <div className="absolute top-16 right-6 z-[1210] w-56 bg-white rounded-2xl shadow-[0_20px_60px_rgba(56,189,248,0.25)] border border-sky-100 overflow-hidden animate-fadeIn">
        <div className="py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-sky-50 transition-all group"
              >
                <Icon className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
                <span className="font-medium text-gray-900 group-hover:text-gray-900 transition-colors">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-sky-100" />

          {/* Log Out / Log In */}
          {isAuthenticated ? (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 transition-all group"
            >
              <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition-colors" />
              <span className="font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                Log Out
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                onGoToLogin();
                onClose();
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-sky-50 transition-all group"
            >
              <LogIn className="w-5 h-5 text-gray-600 group-hover:text-sky-600 transition-colors" />
              <span className="font-medium text-gray-900 group-hover:text-sky-600 transition-colors">
                Log In
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
