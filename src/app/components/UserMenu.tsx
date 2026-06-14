import { Send, MessageCircle, Heart, Settings, LogOut, Crown, Package } from 'lucide-react';

interface UserMenuProps {
  onClose: () => void;
  onSelectItem: (item: 'requests' | 'messages' | 'favorites' | 'settings' | 'premium' | 'bookings') => void;
  onLogout: () => void;
}

export function UserMenu({ onClose, onSelectItem, onLogout }: UserMenuProps) {
  const menuItems = [
    { id: 'bookings' as const, label: 'My Bookings', icon: Package },
    { id: 'requests' as const, label: 'Requests', icon: Send },
    { id: 'messages' as const, label: 'Messages', icon: MessageCircle },
    { id: 'favorites' as const, label: 'Favorites', icon: Heart },
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
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu Dropdown */}
      <div className="absolute top-16 right-6 z-50 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-fadeIn">
        <div className="py-2">
          {/* Premium Option - Featured */}
          <button
            onClick={() => handleClick('premium')}
            className="w-full mx-2 my-2 px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl hover:shadow-lg transition-all group"
          >
            <Crown className="w-5 h-5" />
            <div className="flex-1 text-left">
              <span className="font-bold block">Go Premium</span>
              <span className="text-xs text-gray-300">Unlock exclusive features</span>
            </div>
          </button>

          {/* Divider */}
          <div className="my-2 border-t border-gray-200" />

          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all group"
              >
                <Icon className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
                <span className="font-medium text-gray-900 group-hover:text-gray-900 transition-colors">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-gray-200" />

          {/* Log Out */}
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
        </div>
      </div>
    </>
  );
}
