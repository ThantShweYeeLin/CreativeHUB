import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import { FeedService } from '../../../lib/feedService';
import { resolveNotificationRoute } from '../../../lib/notificationNavigation';

interface ToastItem {
  id: string;
  title: string;
  message: string | null;
  type: string;
  relatedId: string | null;
  actorId: string | null;
  counterBy: 'client' | 'freelancer' | null;
  actorName: string | null;
}

const AUTO_DISMISS_MS = 5000;
const EXIT_DURATION_MS = 300;

// Slides in from the right (entered=false -> true flips the transform),
// sits for AUTO_DISMISS_MS, then slides back out (leaving=true) before
// actually being removed from the list — removing it immediately on timeout
// would just pop it out of existence mid-screen instead of animating away.
function ToastCard({ item, onDismiss, onOpen }: { item: ToastItem; onDismiss: () => void; onOpen: () => void }) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setEntered(true));
    const dismissTimer = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(onDismiss, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  return (
    <div
      role="alert"
      onClick={() => {
        onOpen();
        setLeaving(true);
      }}
      className={`pointer-events-auto w-80 max-w-[calc(100vw-2rem)] cursor-pointer rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_20px_60px_rgba(56,189,248,0.25)] transition-all duration-300 ease-out ${
        entered && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{item.title}</p>
          {item.message && <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{item.message}</p>}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLeaving(true);
          }}
          className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-sky-50 hover:text-gray-700"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Mounted once at the app root (App.tsx) so it's present for both regular
// users and admins regardless of which layout the current route uses —
// MainLayout's bell dropdown and AdminNotificationBell both already show
// notifications on demand, but neither surfaced a NEW one arriving while
// you're not looking at the bell at all, the way other sites' toast/
// snackbar popups do.
export function NotificationToastHost() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setToasts([]);
      return;
    }

    const channel = FeedService.subscribeToNewNotifications(user.id, (row) => {
      setToasts((current) => [
        ...current,
        {
          id: String(row.id),
          title: String(row.title || 'Notification'),
          message: row.message || null,
          type: String(row.type || 'system'),
          relatedId: row.related_id ? String(row.related_id) : null,
          actorId: row.actor_id ? String(row.actor_id) : null,
          counterBy: row.metadata?.counter_by || null,
          actorName: row.metadata?.actor_name || row.metadata?.requester_name || null,
        },
      ]);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  if (!user?.id || toasts.length === 0) {
    return null;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[2000] flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={() => setToasts((current) => current.filter((t) => t.id !== item.id))}
          onOpen={() => {
            void DataService.markNotificationAsRead(item.id);
            void resolveNotificationRoute(
              { id: item.id, type: item.type, relatedId: item.relatedId, counterBy: item.counterBy, actorId: item.actorId, actorName: item.actorName },
              user ? { id: user.id, role: user.role } : null,
              isAdmin
            ).then((route) => {
              if (route) navigate(route.path, route.state ? { state: route.state } : undefined);
            });
          }}
        />
      ))}
    </div>
  );
}
