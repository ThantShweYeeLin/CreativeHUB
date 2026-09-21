import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Bell, Menu } from 'lucide-react';
import logoImage from '../imports/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { HeaderExtrasContext, type HeaderExtras } from '../contexts/HeaderExtrasContext';
import { UserMenu } from '../app/components/UserMenu';
import { AuthPromptModal } from '../app/components/AuthPromptModal';
import { NotificationPanelItem, NotificationsPanel } from '../app/components/NotificationsPanel';
import { DataService } from '../lib/dataService';
import { FeedService } from '../lib/feedService';
import { supabase } from '../lib/supabase';
import { Avatar } from './common/Avatar';
import { DEFAULT_AVATAR_URL } from '../lib/defaults';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationPanelItem[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [canAccessFreelancerDashboard, setCanAccessFreelancerDashboard] = useState(false);
  const [headerExtras, setHeaderExtras] = useState<HeaderExtras | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const unreadNotificationsCount = notifications.filter((item) => !item.read).length;

  const mapNotificationRecord = (row: any): NotificationPanelItem => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    const rawMessageText = typeof row.message === 'string' ? row.message : '';
    const isGenericActorName = (value?: string | null) => /^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(value || ''));
    const inferredActorName = (() => {
      const match = rawMessageText.match(/^(.+?)\s+(?:sent|accepted|declined|rejected|cancelled)\b/i);
      const candidate = match?.[1]?.trim();
      if (candidate && !isGenericActorName(candidate)) {
        return candidate;
      }
      return isGenericActorName(rawMessageText) ? 'Freelancer' : null;
    })();
    const resolvedActorName = [
      actor?.full_name,
      row.metadata?.requester_name,
      row.metadata?.actor_name,
      row.metadata?.name,
      inferredActorName,
    ].find((value) => !!value && !isGenericActorName(String(value)));
    // No identifiable person behind this notification (anonymous actor or a
    // system-generated one) — show the app logo instead of a person avatar,
    // set alongside actorAvatar below.
    const isAnonymousActor = !resolvedActorName;
    const finalActorName = resolvedActorName || 'CreativeHUB';

    const projectNameFromText = (() => {
      const text = rawMessageText.replace(/^(?:creative\s*hub\s+)?/i, '').trim();
      const match = text.match(/(?:accepted|rejected|cancelled)\s+(.+?)(?:\.|$)/i);
      if (match?.[1]) {
        return match[1].trim().replace(/[.]+$/, '');
      }
      return String(row.metadata?.project_name || row.metadata?.projectName || '').trim().replace(/[.]+$/, '');
    })();

    const buildTypeMessage = () => {
      const type = String(row.type || 'system');
      const projectName = projectNameFromText || 'project';

      if (type === 'request_accepted') {
        return `${finalActorName} accepted your booking for ${projectName}.`;
      }

      if (type === 'request_rejected') {
        return `${finalActorName} rejected ${projectName}.`;
      }

      if (type === 'request') {
        return `${finalActorName} requested a booking for '${projectName}.'`;
      }

      if (type === 'message' || type === 'group_message') {
        return `${finalActorName} sent you a message.`;
      }

      if (type === 'follow') {
        return `${finalActorName} followed you.`;
      }

      return String(row.title || 'Notification');
    };

    const fallbackMessage = buildTypeMessage();
    const normalizedMessage = typeof row.message === 'string' && row.message.trim().length > 0 ? row.message.trim() : fallbackMessage;
    const typeNeedsActorFirstMessage = [
      'message',
      'group_message',
      'follow',
      'booking_cancelled',
    ].includes(String(row.type || 'system'));
    const displayMessage = (
      typeNeedsActorFirstMessage ||
      /^(?:creative\s*hub|freelancer)\b/i.test(normalizedMessage) ||
      /^(?:accepted|rejected|sent)\b/i.test(normalizedMessage)
    )
      ? buildTypeMessage()
      : normalizedMessage;

    return {
      id: String(row.id),
      type: String(row.type || 'system'),
      title: String(row.title || 'Notification'),
      message: displayMessage,
      actorName: finalActorName,
      actorAvatar: actor?.avatar_url || (isAnonymousActor ? logoImage : null),
      actorGender: actor?.gender || null,
      actorId: actor?.id || row.actor_id || null,
      requesterId: row.metadata?.requester_id || row.actor_id || null,
      relatedId: row.related_id || null,
      counterBy: row.metadata?.counter_by || null,
      createdAt: String(row.created_at || new Date().toISOString()),
      read: Boolean(row.read),
    };
  };

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

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      setIsNotificationsLoading(true);
      try {
        const response = await DataService.getUserNotifications(user.id, { limit: 30 });
        if (!isMounted) {
          return;
        }

        if (response.error) {
          console.error('Failed to load notifications:', response.error);
        setNotifications([]);
      } else {
        const rows = response.data || [];
        const mapped = await Promise.all(
          rows.map(async (row: any) => {
            const notification = mapNotificationRecord(row);

            // A group message's "actor" is more useful shown as which group
            // chat it's in (a viewer in several group chats needs to know
            // where to look) than the individual sender's name — a
            // dedicated branch instead of the person-actor resolution chain
            // below, which has no notion of a group as the "actor".
            if (String(row.type || '') === 'group_message' && row.related_id) {
              const groupResponse = await supabase
                .from('group_conversations')
                .select('id, title')
                .eq('id', row.related_id)
                .maybeSingle();
              const groupTitle = groupResponse.data?.title || 'Group chat';
              return {
                ...notification,
                actorName: groupTitle,
                actorAvatar: null,
                message: `New message in ${groupTitle}.`,
              };
            }

            const rawMessageText = String(row.message || '');
            const shouldResolveActorName = (
              (
                !!notification.actorId ||
                !!row.actor_id ||
                !!row.metadata?.requester_id ||
                !!row.metadata?.actor_id ||
                !!row.related_id ||
                String(row.type || '') === 'request' ||
                String(row.type || '') === 'request_accepted' ||
                String(row.type || '') === 'request_rejected'
              ) &&
              (
                !notification.actorName ||
                /^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(notification.actorName || '')) ||
                /^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(row.message || '')) ||
                notification.actorName === 'Freelancer' ||
                notification.actorName === 'Someone' ||
                notification.actorName === 'User'
              )
            );

              if (!shouldResolveActorName) {
                return notification;
              }

              const actorId = String(notification.actorId || row.actor_id || row.metadata?.actor_id || row.metadata?.requester_id || '');
              let resolvedActorId = actorId;
              let fallbackActorName: string | null = null;
              let fallbackAvatar: string | null = null;

              if (!resolvedActorId && row.related_id) {
                const relatedRequestResponse = await supabase
                  .from('requests')
                  .select('id, freelancer_id, client_id, project_name')
                  .eq('id', row.related_id)
                  .maybeSingle();

                if (!relatedRequestResponse.error && relatedRequestResponse.data) {
                  const requestRow = relatedRequestResponse.data as any;
                  // For 'request' (a new incoming booking), the actor is the client who sent it -
                  // the freelancer is only the recipient. For request_accepted/request_rejected,
                  // the actor is the freelancer who responded - the client is the recipient.
                  const isFreelancerActorType = ['request_accepted', 'request_rejected'].includes(String(row.type || ''));
                  const relatedActorId = String(
                    (isFreelancerActorType ? requestRow.freelancer_id : requestRow.client_id) ||
                    requestRow.freelancer_id ||
                    requestRow.client_id ||
                    ''
                  );
                  if (relatedActorId) {
                    resolvedActorId = relatedActorId;
                  }
                }
              }

              if (!resolvedActorId && row.type === 'message' && row.related_id) {
                const conversationResponse = await supabase
                  .from('conversations')
                  .select('id, participant_1_id, participant_2_id')
                  .eq('id', row.related_id)
                  .maybeSingle();

                if (!conversationResponse.error && conversationResponse.data) {
                  const participantIds = [conversationResponse.data.participant_1_id, conversationResponse.data.participant_2_id]
                    .filter(Boolean)
                    .map(String);
                  const currentUserId = user?.id ? String(user.id) : '';
                  const otherParticipantId = participantIds.find((id) => id && id !== currentUserId);
                  if (otherParticipantId) {
                    resolvedActorId = otherParticipantId;
                  }
                }
              }

              if (!resolvedActorId && row.related_id && [
                'payment_update',
                'deposit_secured',
                'payment_released',
                'booking_deposit_paid',
                'booking_cancelled',
                'booking_completed',
                'attendance_window_open',
                'deposit_payment_required',
                'booking_completion_submitted',
                'attendance_remaining_balance',
              ].includes(String(row.type || ''))) {
                const bookingResponse = await supabase
                  .from('bookings')
                  .select('id, client_id, freelancer_id')
                  .eq('id', row.related_id)
                  .maybeSingle();

                if (!bookingResponse.error && bookingResponse.data) {
                  const bookingRow = bookingResponse.data as any;
                  const currentUserId = user?.id ? String(user.id) : '';
                  const otherPartyId = [bookingRow.client_id, bookingRow.freelancer_id]
                    .filter(Boolean)
                    .map(String)
                    .find((id) => id && id !== currentUserId);
                  if (otherPartyId) {
                    resolvedActorId = otherPartyId;
                  }
                }
              }

              if (!resolvedActorId && ['request', 'request_accepted', 'request_rejected'].includes(String(row.type || ''))) {
              const projectName = String(
                row.metadata?.project_name ||
                row.metadata?.projectName ||
                (typeof row.message === 'string' ? row.message.replace(/^.*?:\s*/i, '').trim() : '') ||
                ''
              ).replace(/[.]+$/, '');

              if (user?.id && projectName) {
                const requestResponse = await supabase
                  .from('requests')
                  .select('id, client_id, freelancer_id, project_name, client:client_id(id, full_name, avatar_url)')
                  .eq('freelancer_id', user.id)
                  .eq('project_name', projectName)
                  .order('created_at', { ascending: false })
                  .limit(1);

                if (!requestResponse.error && requestResponse.data?.[0]?.client_id) {
                  resolvedActorId = String(requestResponse.data[0].client_id);
                }
              }
            }

              if (!resolvedActorId) {
              const requestProjectName = String(
                row.metadata?.project_name ||
                row.metadata?.projectName ||
                (typeof row.message === 'string' ? row.message.replace(/^.*?:\s*/i, '').trim() : '') ||
                ''
              ).replace(/[.]+$/, '');

              if (user?.id && ['request', 'request_accepted', 'request_rejected'].includes(String(row.type || '')) && requestProjectName) {
                const legacyRequestResponse = await supabase
                  .from('requests')
                  .select('id, client_id, freelancer_id, project_name')
                  .eq('freelancer_id', user.id)
                  .eq('project_name', requestProjectName)
                  .order('created_at', { ascending: false })
                  .limit(1);

                if (!legacyRequestResponse.error && legacyRequestResponse.data?.[0]?.client_id) {
                  resolvedActorId = String(legacyRequestResponse.data[0].client_id);
                }
              }
              }

              if (!resolvedActorId) {
                const messageName = rawMessageText.match(/^(.+?)\s+(?:sent|accepted|declined|rejected|cancelled)\b/i)?.[1]?.trim();
                if (messageName && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(messageName)) {
                  return {
                    ...notification,
                    actorName: messageName,
                  };
                }
                if (row.metadata?.requester_name && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(row.metadata.requester_name))) {
                  return {
                    ...notification,
                    actorName: String(row.metadata.requester_name),
                  };
                }
                if (row.metadata?.actor_name && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(row.metadata.actor_name))) {
                  return {
                    ...notification,
                    actorName: String(row.metadata.actor_name),
                  };
                }
                return notification;
              }

              const actorResponse = await DataService.getUser(resolvedActorId);
              if (!actorResponse.error && actorResponse.data?.full_name) {
                fallbackActorName = actorResponse.data.full_name;
                fallbackAvatar = actorResponse.data.avatar_url || notification.actorAvatar;
              }

              if (fallbackActorName && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(fallbackActorName)) {
                return {
                  ...notification,
                  actorName: fallbackActorName,
                  actorAvatar: fallbackAvatar || notification.actorAvatar,
                };
              }

              if (row.metadata?.requester_name && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(row.metadata.requester_name))) {
                return {
                  ...notification,
                  actorName: String(row.metadata.requester_name),
                };
              }

              if (row.metadata?.actor_name && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(String(row.metadata.actor_name))) {
                return {
                  ...notification,
                  actorName: String(row.metadata.actor_name),
                };
              }

              const messageName = rawMessageText.match(/^(.+?)\s+(?:sent|accepted|declined|rejected|cancelled)\b/i)?.[1]?.trim();
              if (messageName && !/^(?:creative\s*hub|creativehub|freelancer|user|someone)\b/i.test(messageName)) {
                return {
                  ...notification,
                  actorName: messageName,
                };
              }

              return notification;
            })
          );

          setNotifications(mapped);
        }
      } catch (err) {
        console.error('Error while loading notifications:', err);
        setNotifications([]);
      } finally {
        setIsNotificationsLoading(false);
      }
    };

    loadNotifications();

    const channel = FeedService.subscribeToNotifications(user.id, () => {
      loadNotifications();
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user?.id]);

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
    );

    await DataService.markNotificationAsRead(notificationId);
  };

  const handleMarkAllNotificationsAsRead = async () => {
    if (!user?.id) {
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    await DataService.markAllNotificationsAsRead(user.id);
  };

  const resolveNotificationUserId = async (notification: NotificationPanelItem) => {
    if (notification.requesterId || notification.actorId) {
      return notification.requesterId || notification.actorId;
    }

    const searchName = notification.actorName?.trim();
    if (!searchName) {
      return null;
    }

    const searchResponse = await DataService.searchUsers(searchName, { limit: 1 });
    if (searchResponse.error || !searchResponse.data?.length) {
      return null;
    }

    return searchResponse.data[0].id;
  };

  const handleOpenNotificationProfile = async (notification: NotificationPanelItem) => {
    const targetUserId = await resolveNotificationUserId(notification);
    if (!targetUserId) {
      return;
    }

    setShowNotifications(false);
    navigate(`/profile/${targetUserId}`);
  };

  // Booking-related notifications (attendance checks, deposit reminders,
  // payment updates, cancellations, completions) all carry the booking's id
  // as relatedId — this resolves which side of that booking the viewer is
  // on (RLS guarantees they're one of the two) to pick the right route, and
  // appends a #section hash the tracking page scrolls to once it loads.
  const handleOpenNotificationBooking = async (notification: NotificationPanelItem) => {
    const bookingId = notification.relatedId;
    if (!bookingId || !user?.id) {
      return;
    }

    const bookingResponse = await supabase
      .from('bookings')
      .select('id, client_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (!bookingResponse.data) {
      return;
    }

    const isClient = String(bookingResponse.data.client_id) === String(user.id);
    const basePath = isClient ? `/booking/${bookingId}` : `/freelancer-booking/${bookingId}`;
    const section =
      notification.type === 'attendance_window_open'
        ? 'attendance-check'
        : notification.type === 'deposit_payment_required'
          ? 'deposit-section'
          : notification.type === 'booking_completion_submitted'
            ? 'report-a-problem-button'
            : null;

    setShowNotifications(false);
    navigate(section ? `${basePath}#${section}` : basePath);
  };

  const handleOpenNotificationGroupMessage = (notification: NotificationPanelItem) => {
    if (!notification.relatedId) {
      return;
    }
    setShowNotifications(false);
    navigate('/messages', { state: { openGroupConversationId: notification.relatedId } });
  };

  const MENU_ITEM_AUTH_MESSAGE: Record<'requests' | 'messages' | 'favorites' | 'savedPosts' | 'settings' | 'bookings' | 'groupRequest' | 'tickets', string> = {
    requests: 'Create an account to send and track requests.',
    groupRequest: 'Create an account to send a group request to multiple freelancers.',
    favorites: 'Create an account to save your favorite freelancers.',
    savedPosts: 'Create an account to save posts you like.',
    messages: 'Create an account to send and receive messages.',
    bookings: 'Create an account to see your booked list.',
    settings: 'Create an account to manage your account settings.',
    tickets: 'Create an account to create and track support tickets.',
  };

  const handleMenuSelection = (item: 'requests' | 'messages' | 'favorites' | 'savedPosts' | 'settings' | 'bookings' | 'groupRequest' | 'tickets') => {
    setShowUserMenu(false);

    if (!isAuthenticated) {
      setAuthPromptMessage(MENU_ITEM_AUTH_MESSAGE[item]);
      return;
    }

    switch (item) {
      case 'requests':
        navigate('/requests');
        break;
      case 'groupRequest':
        navigate('/group-request');
        break;
      case 'favorites':
        navigate('/favorites');
        break;
      case 'savedPosts':
        navigate('/saved-posts');
        break;
      case 'messages':
        navigate('/messages');
        break;
      case 'bookings':
        // "My Booked List" is always the client-side function - bookings this
        // user made with other freelancers - regardless of their account's
        // primary role. Freelancer-side bookings (where others booked them)
        // have their own entry point: the Freelancer Dashboard's Bookings tab.
        navigate('/my-bookings');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'tickets':
        navigate('/tickets');
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

  const navPills = (
    <nav className="hidden flex-shrink-0 items-center gap-1 rounded-full border border-sky-100 bg-white/60 p-1 md:flex">
      {[
        { label: 'Explore', path: '/explore' },
        { label: 'Map', path: '/map' },
        { label: 'For You', path: '/for-you' },
      ].map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              isActive
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                : 'text-gray-600 hover:bg-sky-50 hover:text-sky-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-[1200] bg-white/70 backdrop-blur-xl border-b border-sky-100">
        <div className="max-w-[1680px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <button
              onClick={() => navigate('/explore')}
              className="flex items-center gap-2 transition-transform hover:scale-105"
            >
              <img
                src={logoImage}
                alt="CreativeHUB"
                className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover shadow-sm ring-2 ring-white"
              />
            </button>

            {/* A page (Explore) that wants condensed header content keeps
                its search/actions nodes mounted here at all times, only
                toggling their own visibility internally - never adding or
                removing them from this row. That keeps the two spacer
                slots below at a constant width (so the nav links between
                them never jump as the page scrolls), and, being normal
                flex content rather than absolutely positioned, it can
                never overlap the account controls on the right or leave a
                stray gap. Each spacer is flex-1 (so the two split the
                space between logo/nav and nav/account-controls equally)
                with its content centered inside it - putting the search
                box in the middle of the logo<->nav gap, and the actions in
                the middle of the nav<->account-controls gap. */}
            <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
              {headerExtras?.search}
            </div>
            {navPills}
            {/* @container: lets a page's actions content (e.g. Explore's
                Advanced Filter/Event Assistant) respond to how much room is
                actually left in THIS slot - which depends on the logo/nav/
                account controls around it, not just the viewport - rather
                than a viewport breakpoint that has no idea whether this
                particular slot is currently wide or squeezed. */}
            <div className="@container hidden min-w-0 flex-1 items-center justify-center md:flex">
              {headerExtras?.actions}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              {headerExtras?.mobileActions && <div className="flex items-center gap-1.5 md:hidden">{headerExtras.mobileActions}</div>}
              <button
                onClick={() =>
                  navigate(
                    !isAuthenticated
                      ? '/signup'
                      : user?.role === 'admin'
                      ? '/admin'
                      : canAccessFreelancerDashboard
                      ? '/freelancer-dashboard/requests'
                      : '/become-freelancer'
                  )
                }
                className="whitespace-nowrap rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-500/30 transition-transform hover:scale-105 sm:px-6 sm:py-2.5 sm:text-sm"
              >
                {/* Shorter label below sm (640px) - not just a smaller font,
                    an actually shorter word - so there's guaranteed room
                    left over for the mobileActions icons beside it (see
                    above). The full label at sm+ never had that constraint. */}
                <span className="sm:hidden">
                  {!isAuthenticated
                    ? 'Get Started'
                    : user?.role === 'admin'
                    ? 'Admin'
                    : canAccessFreelancerDashboard
                    ? 'Dashboard'
                    : 'Freelance'}
                </span>
                <span className="hidden sm:inline">
                  {!isAuthenticated
                    ? 'Get Started'
                    : user?.role === 'admin'
                    ? 'Admin Dashboard'
                    : canAccessFreelancerDashboard
                    ? 'Freelancer Dashboard'
                    : 'Become a Freelancer'}
                </span>
              </button>
              <div className="relative">
                <button
                  ref={bellButtonRef}
                  onClick={() => {
                    if (!isAuthenticated) {
                      setAuthPromptMessage('Create an account to receive notifications about your bookings and messages.');
                      return;
                    }
                    setShowNotifications(!showNotifications);
                  }}
                  className="relative p-2 hover:bg-sky-50 rounded-full transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                  )}
                </button>
                {showNotifications && (
                  <NotificationsPanel
                    triggerRef={bellButtonRef}
                    onClose={() => setShowNotifications(false)}
                    notifications={notifications}
                    isLoading={isNotificationsLoading}
                    onMarkAsRead={handleMarkNotificationAsRead}
                    onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                    onOpenRequests={async (notification) => {
                      setShowNotifications(false);
                      const requestId = notification?.relatedId || notification?.id;
                      const openFreelancerRequests = () => {
                        navigate('/freelancer-dashboard/requests', requestId ? { state: { openRequestId: requestId } } : undefined);
                      };
                      const openClientRequests = () => {
                        navigate('/requests', requestId ? { state: { openRequestId: requestId } } : undefined);
                      };

                      // A counter offer always needs the *other* party to respond, regardless
                      // of the viewer's own account role: a client's counter offer is decided
                      // on the freelancer's Requests tab, a freelancer's counter offer is
                      // decided on the client's My Requests page.
                      if (notification?.type === 'request_countered') {
                        // Prefer resolving against the request's client_id/freelancer_id -
                        // those are fixed for the life of the request, unlike counter_by
                        // (or the request's *current* counter_by), which changes with every
                        // further round and would misroute an older notification once the
                        // negotiation has moved on since it was sent.
                        if (notification.relatedId && user?.id) {
                          const requestResponse = await supabase
                            .from('requests')
                            .select('client_id, freelancer_id')
                            .eq('id', notification.relatedId)
                            .maybeSingle();
                          const requestRow = requestResponse.data as any;
                          if (requestRow) {
                            if (String(requestRow.freelancer_id) === String(user.id)) {
                              openFreelancerRequests();
                              return;
                            }
                            if (String(requestRow.client_id) === String(user.id)) {
                              openClientRequests();
                              return;
                            }
                          }
                        }

                        // Fall back to who sent this specific counter - a fixed snapshot
                        // taken when the notification was created - for notifications whose
                        // related request can't be looked up (e.g. missing related_id on
                        // rows created before that started being tracked).
                        if (notification.counterBy === 'client') {
                          openFreelancerRequests();
                          return;
                        }
                        if (notification.counterBy === 'freelancer') {
                          openClientRequests();
                          return;
                        }
                      }

                      // Only a new incoming request belongs in the freelancer inbox.
                      // A freelancer can also send requests; acceptance/rejection updates for
                      // those requests belong to their own My Requests page.
                      if (notification?.type === 'request' && user?.role === 'freelancer') {
                        openFreelancerRequests();
                        return;
                      }

                      // Default: open client-side 'My Requests' page
                      openClientRequests();
                    }}
                    onOpenMessages={() => {
                      setShowNotifications(false);
                      navigate('/messages');
                    }}
                    onOpenProfile={handleOpenNotificationProfile}
                    onOpenBooking={handleOpenNotificationBooking}
                    onOpenGroupMessage={handleOpenNotificationGroupMessage}
                    onOpenTicket={(notification) => {
                      setShowNotifications(false);
                      if (notification.relatedId) {
                        // #conversation lands directly on the reply thread
                        // instead of the top of the page — see
                        // TicketDetailPage.tsx's hash-scroll effect.
                        navigate(`/tickets/${notification.relatedId}#conversation`);
                      } else {
                        navigate('/tickets');
                      }
                    }}
                    onOpenDisputeTicket={(notification) => {
                      setShowNotifications(false);
                      if (notification.relatedId) {
                        navigate(`/tickets/dispute/${notification.relatedId}#conversation`);
                      } else {
                        navigate('/tickets');
                      }
                    }}
                  />
                )}
              </div>
              {isAuthenticated && (
                <button
                  onClick={() => navigate('/client-profile')}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full cursor-pointer hover:shadow-lg transition-shadow ring-2 ring-sky-100"
                >
                  <Avatar
                    src={profileAvatarUrl || DEFAULT_AVATAR_URL}
                    alt="Profile picture"
                    gender={user?.gender}
                    sizeClassName="w-full h-full"
                  />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 hover:bg-sky-50 rounded-full transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
                {showUserMenu && (
                  <UserMenu
                    onClose={() => setShowUserMenu(false)}
                    onSelectItem={handleMenuSelection}
                    onLogout={handleLogout}
                    isAuthenticated={isAuthenticated}
                    onGoToLogin={() => navigate('/login')}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Condensed search, phone equivalent of the desktop `search` slot
              above (see HeaderExtrasContext.tsx) — that one's whole row is
              `hidden md:flex`, so on a narrow screen it can never show no
              matter how far the page scrolls. Kept always-mounted here too,
              same as `search` itself: a page toggles its own
              collapsed/expanded classes (height/opacity, never
              display:none) rather than passing null - display:none (which
              is what Tailwind's `hidden` does, and what conditional
              rendering amounts to) forcibly blurs a focused descendant,
              which was exactly what made typing Enter into it jump back to
              the full-size bar the moment the measurement that drives this
              flickered, however briefly, for any reason at all. No border/
              padding baked in here - the page's own node owns those so it
              can collapse them together with everything else. */}
          {headerExtras?.mobileSearch && <div className="md:hidden">{headerExtras.mobileSearch}</div>}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-8">
        <HeaderExtrasContext.Provider value={setHeaderExtras}>{children}</HeaderExtrasContext.Provider>
      </main>

      {authPromptMessage && (
        <AuthPromptModal message={authPromptMessage} onClose={() => setAuthPromptMessage(null)} />
      )}
    </div>
  );
}
