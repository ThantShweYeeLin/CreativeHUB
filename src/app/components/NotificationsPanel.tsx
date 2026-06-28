import { Bell, Check, MessageCircle, Heart, MessageSquare, X as XIcon } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';

interface NotificationsPanelProps {
  onClose: () => void;
  onOpenRequests?: () => void;
  onOpenMessages?: () => void;
}

const notifications = [
  {
    id: 1,
    type: 'request_accepted',
    user: 'makeup_by_naychi',
    message: 'has accepted your request!!',
    avatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200',
    time: '5m ago',
    read: false
  },
  {
    id: 2,
    type: 'message',
    user: 'daily_fits',
    message: 'has sent a message!',
    avatar: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=200',
    time: '2h ago',
    read: false
  },
  {
    id: 3,
    type: 'like',
    user: 'pro_photographer',
    message: 'liked your post!',
    avatar: 'https://images.unsplash.com/photo-1706661912295-bd1dc10ffe7f?w=200',
    time: '1d ago',
    read: true
  },
  {
    id: 4,
    type: 'request_rejected',
    user: 'style_studio',
    message: 'rejected your request!',
    avatar: 'https://images.unsplash.com/photo-1671454390265-c0ed999cd528?w=200',
    time: '2d ago',
    read: true
  },
  {
    id: 5,
    type: 'comment',
    user: 'creative_lens',
    message: 'commented on your post!',
    avatar: 'https://images.unsplash.com/photo-1758613653231-bae4e1131dde?w=200',
    time: '3d ago',
    read: true
  },
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'request_accepted':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'request_rejected':
      return <XIcon className="w-4 h-4 text-red-600" />;
    case 'message':
      return <MessageCircle className="w-4 h-4 text-gray-900" />;
    case 'like':
      return <Heart className="w-4 h-4 text-red-500" />;
    case 'comment':
      return <MessageSquare className="w-4 h-4 text-gray-900" />;
    default:
      return <Bell className="w-4 h-4 text-gray-600" />;
  }
};

export function NotificationsPanel({ onClose, onOpenRequests, onOpenMessages }: NotificationsPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Notifications Dropdown */}
      <div className="absolute top-16 right-0 md:right-32 z-50 w-screen md:w-96 bg-white md:rounded-2xl shadow-2xl border-t md:border border-gray-200 overflow-hidden animate-fadeIn max-h-[calc(100vh-4rem)] md:max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-gradient-to-r from-gray-900 to-black text-white text-xs font-bold rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                if (notification.type === 'request_accepted') {
                  onOpenRequests?.();
                  onClose();
                } else if (notification.type === 'request_rejected') {
                  onOpenRequests?.();
                  onClose();
                } else if (notification.type === 'message') {
                  onOpenMessages?.();
                  onClose();
                }
              }}
              className={`px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                !notification.read ? 'bg-gray-50/50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white">
                    <ImageWithFallback
                      src={notification.avatar}
                      alt={notification.user}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Notification Type Icon */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-bold">@{notification.user}</span>{' '}
                    <span className="text-gray-700">{notification.message}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                </div>

                {/* Unread Indicator */}
                {!notification.read && (
                  <div className="w-2 h-2 bg-gray-900 rounded-full flex-shrink-0 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <button className="w-full text-center text-sm font-semibold text-gray-900 hover:text-black transition-colors">
            View All Notifications
          </button>
        </div>
      </div>
    </>
  );
}
