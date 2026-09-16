import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Bell, Check, MessageCircle, Heart, MessageSquare, Users, X as XIcon } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import type { Gender } from '../../lib/database.types';

export interface NotificationPanelItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  actorName: string;
  actorAvatar: string | null;
  actorGender?: Gender | null;
  actorId: string | null;
  requesterId: string | null;
  relatedId?: string | null;
  counterBy?: 'client' | 'freelancer' | null;
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
  onOpenGroupMessage?: (notification: NotificationPanelItem) => void;
  onOpenBooking?: (notification: NotificationPanelItem) => void;
  onOpenSupportTicket?: (notification: NotificationPanelItem) => void;
  /** The bell button's ref — used to measure where to anchor the portaled
   * panel on desktop (see the positioning effect below). Optional so the
   * panel still renders sensibly (falling back to its static Tailwind
   * position) if a caller doesn't pass one. */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const DESKTOP_BREAKPOINT = 768; // Tailwind's `md`

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
    case 'booking_cancelled':
      return <XIcon className="w-4 h-4 text-red-600" />;
    case 'booking_disputed':
      return <AlertCircle className="w-4 h-4 text-amber-600" />;
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
    case 'deposit_secured':
      return <Bell className="w-4 h-4 text-blue-600" />;
    case 'payment_released':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'ticket_reply':
      return <MessageSquare className="w-4 h-4 text-sky-600" />;
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

  const cleanedMessage = rawMessage
    .replace(/^(?:creative\s*hub|creativehub)\s+(?:ai\s+)?/i, '')
    .replace(/^(?:creative\s*hub|creativehub)$/i, '')
    .replace(/^(?:creative\s*hub|creativehub)\s+/i, '')
    .replace(/^(?:freelancer|user|someone)\s+(?=(?:new\s+booking\s+request|accepted|rejected|sent|declined|cancelled|followed)\b)/i, '')
    .trim();

  if (!cleanedMessage) {
    return rawMessage;
  }

  const actorName = notification.actorName?.trim();
  if (actorName) {
    const actorPattern = new RegExp(`^${actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
    const stripped = cleanedMessage.replace(actorPattern, '');
    if (stripped !== cleanedMessage) {
      return stripped || cleanedMessage;
    }
  }

  const legacyVerbPattern = /^(?:accepted|rejected|sent)\s+/i;
  if (legacyVerbPattern.test(cleanedMessage)) {
    return cleanedMessage;
  }

  return cleanedMessage;
};

// 'deposit_payment_required' / 'attendance_window_open' suppress the usual
// bold actor-name prefix (see the render below) because their message text
// already names the other party mid-sentence, as its object ("...to
// BabyGurl...", "...with BabyGurl...") rather than as the sentence's
// subject — a separate bold prefix would just repeat that name. But the
// name should still read as emphasized, just in place rather than up
// front, so this bolds that one inline occurrence instead of leaving it as
// plain text.
const renderMessageWithBoldName = (message: string, name?: string | null) => {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return message;
  }
  const index = message.indexOf(trimmedName);
  if (index === -1) {
    return message;
  }
  return (
    <>
      {message.slice(0, index)}
      <span className="font-bold">{trimmedName}</span>
      {message.slice(index + trimmedName.length)}
    </>
  );
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
  onOpenGroupMessage,
  onOpenBooking,
  onOpenSupportTicket,
  triggerRef,
}: NotificationsPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;
  // Desktop-only anchor, measured from the bell button rather than assumed
  // as a fixed px offset from the viewport edge — the header's content sits
  // inside a `max-w-[1680px] mx-auto` container, so on any screen wider
  // than that a hardcoded "right: Npx" drifts away from the bell by however
  // much wider the viewport is than the container. null on mobile (and
  // before the first measurement) leaves the static Tailwind classes
  // (inset-x-0 top-16) in charge instead.
  const [desktopPosition, setDesktopPosition] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!triggerRef?.current || window.innerWidth < DESKTOP_BREAKPOINT) {
      setDesktopPosition(null);
      return;
    }

    const measure = () => {
      if (!triggerRef.current || window.innerWidth < DESKTOP_BREAKPOINT) {
        setDesktopPosition(null);
        return;
      }
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 12;
      const edgeMargin = 8;
      // Flush with the bell's own right edge — simplest anchor that's
      // guaranteed to track the button itself, regardless of how the
      // header lays out everything to either side of it.
      setDesktopPosition({
        top: rect.bottom + gap,
        right: Math.max(edgeMargin, window.innerWidth - rect.right),
      });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [triggerRef]);

  return createPortal(
    <>
      {/* Backdrop — z-[1500], above every other overlay in the app
          (MobileBottomNav at z-[1200]; modals, the search filter panel and
          the chat widget all sit at z-[1300]-[1400]) so a tap literally
          anywhere else on the page closes this, full stop, rather than
          only working over plain page background and losing out to
          whichever of those happens to come later in the DOM.
          This whole panel is portaled to document.body (see the
          createPortal call wrapping this return) rather than rendered
          inline where the bell button lives — the header it would
          otherwise be nested in uses `backdrop-blur-xl`, and browsers
          treat an element with a backdrop-filter as establishing a
          containing block for `fixed` descendants the same way `filter`
          does. Nested inline, this backdrop's "fixed inset-0" was
          computed relative to the HEADER's box, not the viewport — so it
          only ever covered the header strip, and taps on the actual page
          below did nothing. Portaling out from under that ancestor is
          what makes "fixed" actually mean the full viewport again. */}
      <div
        className="fixed inset-0 z-[1500]"
        onClick={onClose}
      />

      {/* Notifications Dropdown. `fixed` (not `absolute`) even on desktop
          now that this is portaled to body with no positioned ancestor to
          anchor an `absolute` element to anyway. On mobile the static
          `inset-x-0 top-16` classes place it (full-width, below the
          header); on desktop `desktopPosition` (measured from the bell
          button — see the effect above) overrides them via inline style,
          since a static Tailwind offset can't track the button's real
          position once this is portaled away from where the button lives. */}
      <div
        className="fixed inset-x-0 top-16 md:inset-x-auto z-[1501] bg-white md:rounded-2xl shadow-[0_20px_60px_rgba(56,189,248,0.25)] border-t md:border border-sky-100 overflow-hidden animate-fadeIn max-h-[calc(100vh-4rem)] md:max-h-[600px] md:w-96 flex flex-col"
        style={desktopPosition ? { top: desktopPosition.top, right: desktopPosition.right } : undefined}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="px-3 py-1 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold rounded-full">
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

                  // Whichever branch matches (or none, for a type with no
                  // dedicated destination — likes, comments, reviews, team
                  // invites, etc.) always ends in onClose() below, so tapping
                  // any notification closes the panel, not just the ones
                  // with somewhere to navigate to.
                  if (notification.type === 'follow') {
                    onOpenProfile?.(notification);
                  } else if (notification.type.includes('request')) {
                    onOpenRequests?.(notification);
                  } else if (notification.type === 'group_message') {
                    onOpenGroupMessage?.(notification);
                  } else if (notification.type === 'ticket_reply') {
                    onOpenSupportTicket?.(notification);
                  } else if (notification.type.includes('message')) {
                    onOpenMessages?.();
                  } else if (
                    [
                      'attendance_window_open',
                      'deposit_payment_required',
                      'payment_update',
                      'deposit_secured',
                      'payment_released',
                      'booking_deposit_paid',
                      'booking_cancelled',
                      'booking_completed',
                      'booking_completion_submitted',
                      'booking_disputed',
                    ].includes(notification.type)
                  ) {
                    onOpenBooking?.(notification);
                  }

                  onClose();
                }}
                className={`px-6 py-4 border-b border-sky-100 hover:bg-sky-50 transition-colors cursor-pointer ${
                  !notification.read ? 'bg-sky-50/50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar — hidden for system notifications with no real
                      actor to attribute to a person (e.g. a dispute report,
                      which is deliberately anonymized on the freelancer's
                      side; see openBookingDispute). */}
                  {notification.type === 'booking_disputed' ? (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 ring-2 ring-white">
                      {getNotificationIcon(notification.type)}
                    </div>
                  ) : (
                    <div className="relative flex-shrink-0">
                      <Avatar
                        src={notification.actorAvatar || DEFAULT_AVATAR_URL}
                        alt={notification.actorName}
                        gender={notification.actorGender}
                        sizeClassName="w-12 h-12 ring-2 ring-white rounded-full"
                        badgePosition="top-right"
                      />
                      {/* Notification Type Icon */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {/* deposit_payment_required / attendance_window_open are
                          instructional, not informational — the recipient is
                          the one being told to act (pay a deposit, check in),
                          not the actor named in the message, so a bold name
                          up front would read like a command directed AT that
                          other person instead of a reminder TO the
                          recipient; their message already names that person
                          inline (bolded separately below), so the prefix
                          would just repeat it.
                          payment_update / payment_released / booking_completed
                          are plain system status confirmations — the
                          recipient already knows what they themselves paid/
                          received/booked, so naming the OTHER party as if
                          they caused it reads as a misattribution rather
                          than useful context; these just state the fact,
                          with no actor at all. */}
                      {!['booking_disputed', 'deposit_payment_required', 'attendance_window_open', 'payment_update', 'payment_released', 'booking_completed'].includes(notification.type) && (
                        <span className="font-bold">{notification.actorName || 'User'}</span>
                      )}{' '}
                      <span className="text-gray-700">
                        {['deposit_payment_required', 'attendance_window_open'].includes(notification.type)
                          ? renderMessageWithBoldName(normalizeNotificationText(notification), notification.actorName)
                          : normalizeNotificationText(notification)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatRelativeTime(notification.createdAt)}</p>
                  </div>

                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="w-2 h-2 bg-sky-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-sky-100 bg-sky-50/60">
          <p className="w-full text-center text-xs font-medium text-gray-500">Realtime updates enabled</p>
        </div>
      </div>
    </>,
    document.body
  );
}
