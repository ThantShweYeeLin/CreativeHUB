import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Menu } from 'lucide-react';
import logoImage from '../imports/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { UserMenu } from '../app/components/UserMenu';
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
  const { signOut, user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPanelItem[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [canAccessFreelancerDashboard, setCanAccessFreelancerDashboard] = useState(false);

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
    const actorName = [
      actor?.full_name,
      row.metadata?.requester_name,
      row.metadata?.actor_name,
      row.metadata?.name,
      inferredActorName,
    ].find((value) => !!value && !isGenericActorName(String(value))) || 'User';
    const finalActorName = actorName || 'User';

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
        return `${finalActorName} accepted ${projectName}.`;
      }

      if (type === 'request_rejected') {
        return `${finalActorName} rejected ${projectName}.`;
      }

      if (type === 'request') {
        return `${finalActorName}: A new booking request - ${projectName}.`;
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
      actorAvatar: actor?.avatar_url || null,
      actorGender: actor?.gender || null,
      actorId: actor?.id || row.actor_id || null,
      requesterId: row.metadata?.requester_id || row.actor_id || null,
      relatedId: row.related_id || null,
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
        navigate('/settings');
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
      <header className="sticky top-0 z-[1200] bg-white/80 backdrop-blur-lg border-b border-gray-200">
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
                onClick={() =>
                  navigate(canAccessFreelancerDashboard ? '/freelancer-dashboard/portfolio' : '/become-freelancer')
                }
                className="hidden md:block px-6 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                {canAccessFreelancerDashboard ? 'Freelancer Dashboard' : 'Become a Freelancer'}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
                {showNotifications && (
                  <NotificationsPanel
                    onClose={() => setShowNotifications(false)}
                    notifications={notifications}
                    isLoading={isNotificationsLoading}
                    onMarkAsRead={handleMarkNotificationAsRead}
                    onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                    onOpenRequests={(notification) => {
                      setShowNotifications(false);
                      const requestId = notification?.relatedId || notification?.id;
                      // Only a new incoming request belongs in the freelancer inbox.
                      // A freelancer can also send requests; acceptance/rejection updates for
                      // those requests belong to their own My Requests page.
                      if (notification?.type === 'request' && user?.role === 'freelancer') {
                        if (requestId) {
                          navigate('/freelancer-dashboard/requests', { state: { openRequestId: requestId } });
                        } else {
                          navigate('/freelancer-dashboard/requests');
                        }
                        return;
                      }

                      // Default: open client-side 'My Requests' page
                      if (requestId) {
                        navigate('/requests', { state: { openRequestId: requestId } });
                      } else {
                        navigate('/requests');
                      }
                    }}
                    onOpenMessages={() => {
                      setShowNotifications(false);
                      navigate('/messages');
                    }}
                    onOpenProfile={handleOpenNotificationProfile}
                  />
                )}
              </div>
              <button
                onClick={() => navigate('/client-profile')}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full cursor-pointer hover:shadow-lg transition-shadow ring-2 ring-gray-200"
              >
                <Avatar
                  src={profileAvatarUrl || DEFAULT_AVATAR_URL}
                  alt="Profile picture"
                  gender={user?.gender}
                  sizeClassName="w-full h-full"
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
