import { Bell, Check, MessageCircle, Heart, MessageSquare, Users, X as XIcon } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

export interface NotificationPanelItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  actorName: string;
  actorAvatar: string | null;
  actorId: string | null;
  requesterId: string | null;
  relatedId?: string | null;
  createdAt: string;
  read: boolean;
}

interface NotificationsPanelProps {
  onClose: () => void;
  notifications: NotificationPanelItem[];
  isLoading?: boolean;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onOpenRequests?: (notification?: NotificationPanelItem) => void;
  onOpenMessages?: () => void;
  onOpenProfile?: (notification: NotificationPanelItem) => void;
  onAcceptFriendRequest?: (notification: NotificationPanelItem) => void;
  onDenyFriendRequest?: (notification: NotificationPanelItem) => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'request_accepted':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'request_rejected':
      return <XIcon className="w-4 h-4 text-red-600" />;
    case 'request':
      return <Check className="w-4 h-4 text-blue-600" />;
    case 'message':
      return <MessageCircle className="w-4 h-4 text-gray-900" />;
    case 'like':
      return <Heart className="w-4 h-4 text-red-500" />;
    case 'comment':
      return <MessageSquare className="w-4 h-4 text-gray-900" />;
    case 'follow':
      return <Users className="w-4 h-4 text-green-600" />;
    case 'friend_request':
      return <Users className="w-4 h-4 text-blue-600" />;
    case 'friend_request_accepted':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'friend_request_declined':
      return <XIcon className="w-4 h-4 text-red-600" />;
    case 'booking_cancelled':
      return <XIcon className="w-4 h-4 text-red-600" />;
    case 'booking_completed':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'review':
      return <MessageSquare className="w-4 h-4 text-gray-900" />;
    case 'team_invitation':
      return <Users className="w-4 h-4 text-blue-600" />;
    case 'team_member_joined':
      return <Users className="w-4 h-4 text-green-600" />;
    case 'account_security':
      return <Bell className="w-4 h-4 text-amber-600" />;
    case 'ai_match_results':
      return <Check className="w-4 h-4 text-indigo-600" />;
    case 'portfolio_matched_ai':
      return <Check className="w-4 h-4 text-indigo-600" />;
    case 'payment_update':
      return <Bell className="w-4 h-4 text-blue-600" />;
    case 'payment_released':
      return <Check className="w-4 h-4 text-green-600" />;
    default:
      return <Bell className="w-4 h-4 text-gray-600" />;
  }
};

function formatRelativeTime(value: string) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) {
    return 'now';
  }

  const diffMs = Date.now() - created;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const normalizeNotificationText = (notification: NotificationPanelItem) => {
  const rawMessage = (notification.message || notification.title || '').trim();
  if (!rawMessage) {
    return '';
  }

  const actorName = notification.actorName?.trim();
  if (actorName) {
    const actorPattern = new RegExp(`^${actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\-–]?\\s*`, 'i');
    const stripped = rawMessage.replace(actorPattern, '');
    if (stripped !== rawMessage) {
      return stripped;
    }
  }

  return rawMessage;
};

export function NotificationsPanel({
  onClose,
  notifications,
  isLoading = false,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenRequests,
  onOpenMessages,
  onOpenProfile,
  onAcceptFriendRequest,
  onDenyFriendRequest,
}: NotificationsPanelProps) {
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
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="px-3 py-1 bg-gradient-to-r from-gray-900 to-black text-white text-xs font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
              {onMarkAllAsRead && unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-sm text-gray-600">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-600">No notifications yet.</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => {
                  if (!notification.read) {
                    onMarkAsRead?.(notification.id);
                  }

                  if (notification.type === 'friend_request') {
                    onOpenProfile?.(notification);
                    onClose();
                    return;
                  }

                  if (notification.type.includes('request')) {
                    onOpenRequests?.(notification);
                    onClose();
                    return;
                  }

                  if (notification.type.includes('message')) {
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
                        src={notification.actorAvatar || DEFAULT_AVATAR_URL}
                        alt={notification.actorName}
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
                      <span className="font-bold">{notification.actorName}</span>{' '}
                      <span className="text-gray-700">{normalizeNotificationText(notification)}</span>
                    </p>
                    {notification.type === 'friend_request' && (
                      <div className="mt-3 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                        <button
                          onClick={() => onAcceptFriendRequest?.(notification)}
                          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => onDenyFriendRequest?.(notification)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{formatRelativeTime(notification.createdAt)}</p>
                  </div>

                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="w-2 h-2 bg-gray-900 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="w-full text-center text-xs font-medium text-gray-500">Realtime updates enabled</p>
        </div>
      </div>
    </>
  );
}
