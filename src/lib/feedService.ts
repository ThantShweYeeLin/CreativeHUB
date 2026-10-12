import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export class FeedService {
  static subscribeToNotifications(userId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
      .subscribe();
  }

  // A request negotiation (counter offers, accept/reject) previously only
  // ever refreshed on mount or right after the current user's own action —
  // the OTHER party's response sat unseen until a manual page reload. Two
  // bindings because postgres_changes filters are a single equality check,
  // not an OR — userId shows up as either side of a request.
  static subscribeToRequests(userId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`requests-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `client_id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `freelancer_id=eq.${userId}` }, onChange)
      .subscribe();
  }

  // A booking tracking page (either party) previously only ever showed the
  // OTHER party's action (confirming attendance, an admin decision, a
  // reschedule response, deposit paid, a new dispute message, ...) after a
  // manual reload. Shared by both the client/freelancer tracking pages
  // (useBookingTracking) and the admin dispute/booking detail pages
  // (useAdminBookingDetail) — same three tables matter to both.
  static subscribeToBooking(bookingId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`booking-${bookingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_events', filter: `booking_id=eq.${bookingId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_evidence', filter: `booking_id=eq.${bookingId}` }, onChange)
      .subscribe();
  }

  // A ticket's conversation (TicketThread, shared by the client's and the
  // admin's ticket detail pages) previously only ever refreshed after the
  // viewer's own reply — the other side's message sat unseen until a manual
  // reload.
  static subscribeToTicketMessages(ticketId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`ticket-messages-${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${ticketId}` }, onChange)
      .subscribe();
  }

  // Toast host (App.tsx) — unlike subscribeToNotifications above (which just
  // signals "something changed" for a full refetch), a toast needs the
  // actual inserted row's title/message/type/related_id to show without a
  // round trip, so this passes the raw payload through instead of discarding it.
  static subscribeToNewNotifications(userId: string, onInsert: (row: any) => void): RealtimeChannel {
    return supabase
      .channel(`notification-toasts-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => onInsert(payload.new)
      )
      .subscribe();
  }
}
