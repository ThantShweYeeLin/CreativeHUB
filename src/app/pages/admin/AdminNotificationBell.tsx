import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import { FeedService } from '../../../lib/feedService';
import { NotificationPanelItem, NotificationsPanel } from '../../components/NotificationsPanel';

// Admins previously had no notification bell at all — a client/freelancer's
// reply on a ticket or dispute only ever surfaced by an admin manually
// checking the list. Deliberately a much simpler mapper than MainLayout's
// mapNotificationRecord: admin-facing notification types are few and
// already write a complete, ready-to-display title/message server-side
// (see supabase/ticket_and_dispute_message_notifications.sql), so there's
// no per-type message reconstruction to do here.
function mapNotification(row: any): NotificationPanelItem {
  return {
    id: String(row.id),
    type: String(row.type || 'system'),
    title: String(row.title || 'Notification'),
    message: row.message || null,
    actorName: row.actor?.full_name || 'CreativeHUB',
    actorAvatar: row.actor?.avatar_url || null,
    actorGender: row.actor?.gender || null,
    actorId: row.actor_id || null,
    requesterId: row.actor_id || null,
    relatedId: row.related_id || null,
    createdAt: row.created_at,
    read: Boolean(row.read),
  };
}

// AdminLayout renders the bell twice — once in the desktop sidebar, once in
// the mobile topbar — so both are in the DOM at once (CSS just hides
// whichever doesn't match the viewport, not React). Two independent copies
// of this hook each opened their own Realtime channel with the SAME topic
// name (`notifications-<userId>`, from FeedService.subscribeToNotifications) —
// supabase-js reuses a channel object per topic, so the second instance's
// `.on(...)` call landed on the FIRST instance's already-`.subscribe()`d
// channel, which throws ("cannot add postgres_changes callbacks... after
// subscribe()") and crashed every admin page. Hoisting the fetch/subscribe
// into one hook, called once by AdminLayout, keeps it to a single channel
// no matter how many <AdminNotificationBell> buttons render from it.
export function useAdminNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationPanelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      const response = await DataService.getUserNotifications(user.id, { limit: 30 });
      if (isMounted) {
        setNotifications(response.error ? [] : (response.data || []).map(mapNotification));
        setIsLoading(false);
      }
    };

    void load();

    const channel = FeedService.subscribeToNotifications(user.id, () => {
      void load();
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    setNotifications((current) => current.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    await DataService.markNotificationAsRead(notificationId);
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    await DataService.markAllNotificationsAsRead(user.id);
  };

  return { notifications, isLoading, markAsRead, markAllAsRead };
}

export function AdminNotificationBell({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
}: {
  notifications: NotificationPanelItem[];
  isLoading: boolean;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
}) {
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <button
        ref={bellRef}
        onClick={() => setShowPanel((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-sky-50 hover:text-gray-900"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <NotificationsPanel
          onClose={() => setShowPanel(false)}
          notifications={notifications}
          isLoading={isLoading}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
          triggerRef={bellRef}
          onOpenTicket={(notification) => {
            setShowPanel(false);
            // #conversation lands directly on the reply thread instead of
            // the top of the page — see AdminTicketDetail.tsx's hash-scroll
            // effect.
            navigate(notification.relatedId ? `/admin/tickets/${notification.relatedId}#conversation` : '/admin');
          }}
          onOpenDisputeTicket={(notification) => {
            setShowPanel(false);
            // #dispute-messages lands directly on the "Message the client &
            // freelancer" section instead of the top of the page — see
            // AdminBookingDetail.tsx's hash-scroll effect.
            navigate(notification.relatedId ? `/admin/disputes/${notification.relatedId}#dispute-messages` : '/admin/disputes');
          }}
        />
      )}
    </>
  );
}
