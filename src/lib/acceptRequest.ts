import { DataService } from './dataService';
import { extractBudgetMeta, stripBudgetMeta } from './requestBudget';
import { extractScheduleMeta, addMinutesToTime, minutesBetween, combineBangkokDateTime } from './requestSchedule';
import { DEPOSIT_DEADLINE_HOURS } from './bookingEscrow';

const DEFAULT_BOOKING_DURATION_MINUTES = 120;
// Matches the deposit percentage src/app/pages/bookingTracking/useBookingTracking.ts
// has always computed client-side — persisted here now instead of only
// ever derived on the fly, so it's a stable, auditable figure.
const DEPOSIT_PERCENTAGE = 0.3;

// Shared by both sides of a request/counter-offer negotiation
// (FreelancerDashboard accepting a request or a client's counter, and
// RequestsPage accepting a freelancer's counter) so the booking-creation +
// conversation + group-request-progress cascade only lives in one place.
export async function acceptRequestAndCreateBooking(request: any, overrideBudget?: number): Promise<{ error: Error | null }> {
  const budgetMeta = extractBudgetMeta(request.message, request.description);
  const budget = overrideBudget ?? Number(budgetMeta?.max ?? request.budget ?? 0);
  const scheduleMeta = extractScheduleMeta(request.message, request.description);
  const isAcceptedCounter = request.status === 'countered' && request.counter_date && request.counter_time;
  // A counter offer may have proposed a different date/time — if the offer
  // being accepted is a counter, that takes precedence over the original ask.
  const startDate = isAcceptedCounter ? request.counter_date : scheduleMeta?.date || null;
  const startTime = isAcceptedCounter ? request.counter_time : scheduleMeta?.time || null;

  // The original ask's duration (end - start) is what a counter offer's
  // start_time carries forward — a counter only proposes a new *start*
  // (see supabase/counter_schedule.sql), not its own end time. Falls back
  // to the same default session length src/lib/availability.ts assumes
  // when nothing else is known.
  const originalDurationMinutes =
    scheduleMeta?.time && scheduleMeta?.endTime
      ? minutesBetween(scheduleMeta.time, scheduleMeta.endTime)
      : DEFAULT_BOOKING_DURATION_MINUTES;
  const endTime = isAcceptedCounter
    ? addMinutesToTime(startTime, originalDurationMinutes)
    : scheduleMeta?.endTime || (startTime ? addMinutesToTime(startTime, DEFAULT_BOOKING_DURATION_MINUTES) : null);

  const startAt = startDate && startTime ? combineBangkokDateTime(startDate, startTime) : null;
  const endAt = startDate && endTime ? combineBangkokDateTime(startDate, endTime) : null;
  const depositAmount = Math.round(budget * DEPOSIT_PERCENTAGE);

  const groupMeta = DataService.getRequestGroupMeta(request);

  // Booking Agreement Lock — an immutable snapshot of what was actually
  // agreed, taken once right here. Every other booking field stays freely
  // editable afterward (DataService.updateBooking()/rescheduleBooking()),
  // but this one never changes again — it's the baseline the dispute
  // system compares "what's true now" against instead of only ever seeing
  // already-edited values. See supabase/booking_agreement_lock.sql.
  const confirmedAgreement = {
    service: request.project_name || null,
    description: stripBudgetMeta(request.description || request.message || null),
    deliverables: request.includes || null,
    price: budget,
    deposit_amount: depositAmount,
    scheduled_start_at: startAt?.toISOString() || null,
    scheduled_end_at: endAt?.toISOString() || null,
    locked_at: new Date().toISOString(),
  };

  const bookingResponse = await DataService.createBooking({
    client_id: request.client_id,
    freelancer_id: request.freelancer_id,
    project_name: request.project_name,
    description: stripBudgetMeta(request.description || request.message || 'Auto-created from accepted request.'),
    budget,
    // Stays 'pending' until the client pays the deposit (BookingTrackingClientPage's
    // Transfer Deposit flips it to 'confirmed') — this is the first state of
    // the deposit escrow lifecycle, not a bug. See src/lib/bookingEscrow.ts.
    // From this point on, supabase's bookings_no_overlap exclusion
    // constraint holds this exact time range exclusively for this
    // freelancer — a second accept that would overlap it is rejected by
    // the database itself (DataService.createBooking translates that into
    // DataService.BOOKING_SLOT_TAKEN_MESSAGE).
    status: 'pending',
    payment_status: 'unpaid',
    deliverables: `Auto-created from request ${request.id}`,
    start_date: startDate,
    start_time: startTime,
    end_time: endTime,
    start_at: startAt?.toISOString() || null,
    end_at: endAt?.toISOString() || null,
    deposit_amount: depositAmount,
    deposit_deadline: new Date(Date.now() + DEPOSIT_DEADLINE_HOURS * 60 * 60 * 1000).toISOString(),
    confirmed_agreement: confirmedAgreement,
    // Lets checkGroupDepositsAndCreateChat (src/lib/groupDepositChat.ts)
    // find every sibling booking from this same group request once each
    // one's deposit gets paid — the group chat is created then, not at
    // acceptance time (see that file for why).
    group_id: groupMeta?.group_id || null,
  } as any);

  if (bookingResponse.error) {
    return { error: new Error((bookingResponse.error as any).message || 'Request accepted, but booking conversion failed.') };
  }

  await DataService.ensureConversation(request.client_id, request.freelancer_id, { forceAccepted: true });

  // A freshly-accepted request becomes a 'pending' booking that lapses into
  // 'annulled' if the deposit isn't paid within DEPOSIT_DEADLINE_HOURS (see
  // reconcile_booking_escrow) — the client otherwise has no prompt telling
  // them that clock has started, so this fires once, right when it starts.
  await DataService.createNotification({
    user_id: request.client_id,
    actor_id: request.freelancer_id,
    type: 'deposit_payment_required',
    title: 'Deposit payment required',
    message: `Pay the deposit for "${request.project_name}" within ${DEPOSIT_DEADLINE_HOURS} hours to confirm your booking.`,
    related_id: bookingResponse.data.id,
    post_id: null,
    comment_id: null,
    metadata: { booking_id: bookingResponse.data.id },
    read: false,
  } as any);

  if (groupMeta?.group_id) {
    // Not getClientRequestsWithProgress(request.client_id) — that queries
    // `requests` under the current user's own RLS, which is almost always
    // the freelancer accepting, not the client. RLS only lets them see
    // rows where they themselves are a participant, so it could never see
    // a sibling freelancer's row in the same group. getGroupRequestMembers
    // bypasses that via a security-definer RPC, so this sees every
    // member's real status regardless of who's asking.
    const progressResponse = await DataService.getGroupRequestMembers(groupMeta.group_id);
    const groupRows = progressResponse.data || [];
    // A rejection is terminal for that one member only — it must never block
    // the rest of the group from completing, so rejected rows are dropped
    // from both the "still needs to respond" pool and the completion check
    // entirely (rather than counted as a slot that can never be accepted).
    const activeGroupRows = groupRows.filter((row: any) => row.status !== 'rejected');
    const accepted = activeGroupRows.filter((row: any) => row.status === 'accepted').length;
    const total = activeGroupRows.length || groupMeta.recipients.length;

    await DataService.createNotification({
      user_id: request.client_id,
      actor_id: request.freelancer_id,
      type: 'group_request_progress',
      title: 'Group booking progress',
      message: `${accepted} out of ${total} people have accepted your request.`,
      related_id: request.id,
      post_id: null,
      comment_id: null,
      metadata: { group_id: groupMeta.group_id, accepted, total },
      read: false,
    } as any);
    // The group chat itself is created once every member's deposit is
    // paid, not here at acceptance — see checkGroupDepositsAndCreateChat
    // in src/lib/groupDepositChat.ts, called from
    // BookingTrackingClientPage's deposit-transfer handler.
  }

  return { error: null };
}
