import { supabase } from './supabase';
import { DataService } from './dataService';

export interface NavigableNotification {
  id: string;
  type: string;
  relatedId?: string | null;
  counterBy?: 'client' | 'freelancer' | null;
  actorId?: string | null;
  requesterId?: string | null;
  actorName?: string | null;
}

export interface NotificationRoute {
  path: string;
  state?: Record<string, any>;
}

// Same set MainLayout.tsx's onOpenBooking (handleOpenNotificationBooking)
// routes to a booking's tracking page for.
const BOOKING_STATUS_TYPES = new Set([
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
]);

// Mirrors MainLayout.tsx's own notification-click routing (the bell
// dropdown's onOpenRequests/onOpenProfile/onOpenBooking/etc. handlers) so a
// toast click — or any other surface that needs "where does this
// notification lead" — ends up in the exact same place a bell click would.
// Deliberately a standalone function rather than refactoring MainLayout to
// call it too: MainLayout's handlers already work and are wired through
// several closures (setShowNotifications, etc.) that aren't worth
// disturbing just to deduplicate — this is the version every OTHER surface
// (the toast host, the admin bell) calls instead.
export async function resolveNotificationRoute(
  notification: NavigableNotification,
  currentUser: { id: string; role?: string | null } | null | undefined,
  isAdmin: boolean
): Promise<NotificationRoute | null> {
  const type = notification.type;

  if (type === 'follow') {
    let targetUserId = notification.requesterId || notification.actorId;
    if (!targetUserId && notification.actorName?.trim()) {
      const searchResponse = await DataService.searchUsers(notification.actorName.trim(), { limit: 1 });
      targetUserId = searchResponse.data?.[0]?.id || null;
    }
    return targetUserId ? { path: `/profile/${targetUserId}` } : null;
  }

  if (type.includes('request')) {
    const requestId = notification.relatedId || notification.id;

    // A counter offer always needs the *other* party to respond, regardless
    // of the viewer's own account role.
    if (type === 'request_countered' && notification.relatedId && currentUser?.id) {
      const requestResponse = await supabase
        .from('requests')
        .select('client_id, freelancer_id')
        .eq('id', notification.relatedId)
        .maybeSingle();
      const requestRow = requestResponse.data as any;
      if (requestRow) {
        if (String(requestRow.freelancer_id) === String(currentUser.id)) {
          return { path: '/freelancer-dashboard/requests', state: { openRequestId: requestId } };
        }
        if (String(requestRow.client_id) === String(currentUser.id)) {
          return { path: '/requests', state: { openRequestId: requestId } };
        }
      }
      // Fall back to who sent this specific counter for notifications whose
      // related request can't be looked up.
      if (notification.counterBy === 'client') {
        return { path: '/freelancer-dashboard/requests', state: { openRequestId: requestId } };
      }
      if (notification.counterBy === 'freelancer') {
        return { path: '/requests', state: { openRequestId: requestId } };
      }
    }

    // Only a new incoming request belongs in the freelancer inbox.
    if (type === 'request' && currentUser?.role === 'freelancer') {
      return { path: '/freelancer-dashboard/requests', state: { openRequestId: requestId } };
    }

    return { path: '/requests', state: { openRequestId: requestId } };
  }

  if (type === 'group_message') {
    return notification.relatedId ? { path: '/messages', state: { openGroupConversationId: notification.relatedId } } : null;
  }

  // #conversation / #dispute-messages land directly on the reply thread
  // instead of the top of the page — see the matching hash-scroll effects
  // in TicketDetailPage.tsx, AdminTicketDetail.tsx, DisputeTicketDetailPage.tsx
  // and AdminBookingDetail.tsx.
  if (type === 'dispute_message') {
    if (!notification.relatedId) return { path: isAdmin ? '/admin/disputes' : '/tickets' };
    return isAdmin
      ? { path: `/admin/disputes/${notification.relatedId}#dispute-messages` }
      : { path: `/tickets/dispute/${notification.relatedId}#conversation` };
  }

  if (type.startsWith('ticket_')) {
    if (!notification.relatedId) return { path: isAdmin ? '/admin' : '/tickets' };
    return isAdmin
      ? { path: `/admin/tickets/${notification.relatedId}#conversation` }
      : { path: `/tickets/${notification.relatedId}#conversation` };
  }

  if (type.includes('message')) {
    return { path: '/messages' };
  }

  if (BOOKING_STATUS_TYPES.has(type)) {
    const bookingId = notification.relatedId;
    if (!bookingId || !currentUser?.id) return null;
    const bookingResponse = await supabase.from('bookings').select('id, client_id').eq('id', bookingId).maybeSingle();
    if (!bookingResponse.data) return null;
    const isClient = String((bookingResponse.data as any).client_id) === String(currentUser.id);
    const basePath = isClient ? `/booking/${bookingId}` : `/freelancer-booking/${bookingId}`;
    const section =
      type === 'attendance_window_open'
        ? 'attendance-check'
        : type === 'deposit_payment_required'
          ? 'deposit-section'
          : type === 'booking_completion_submitted'
            ? 'report-a-problem-button'
            : null;
    return { path: section ? `${basePath}#${section}` : basePath };
  }

  // No dedicated destination for this type (likes, comments, reviews, team
  // invites, etc.) — nowhere to navigate.
  return null;
}
