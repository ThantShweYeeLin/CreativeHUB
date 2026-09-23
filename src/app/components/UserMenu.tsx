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
    { id: 'requests' as const, label: 'My Requests', icon: Send },
    { id: 'bookings' as const, label: 'My Booked List', icon: Package },
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
      <div className="absolute top-16 right-4 z-[1210] w-64 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_20px_60px_rgba(56,189,248,0.25)] animate-fadeIn sm:right-6">
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3">
          <p className="text-sm font-bold text-white">Menu</p>
        </div>
        <div className="py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className="group flex w-full items-center gap-3 px-4 py-2.5 transition-all hover:bg-sky-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition-colors group-hover:bg-gradient-to-br group-hover:from-sky-500 group-hover:to-blue-600 group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex flex-1 items-center gap-1.5 font-medium text-gray-800 transition-colors group-hover:text-gray-900">
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
              className="group flex w-full items-center gap-3 px-4 py-2.5 transition-all hover:bg-red-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors group-hover:bg-red-500 group-hover:text-white">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="font-medium text-gray-800 transition-colors group-hover:text-red-600">
                Log Out
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                onGoToLogin();
                onClose();
              }}
              className="group flex w-full items-center gap-3 px-4 py-2.5 transition-all hover:bg-sky-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition-colors group-hover:bg-gradient-to-br group-hover:from-sky-500 group-hover:to-blue-600 group-hover:text-white">
                <LogIn className="h-4 w-4" />
              </span>
              <span className="font-medium text-gray-800 transition-colors group-hover:text-sky-700">
                Log In
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
