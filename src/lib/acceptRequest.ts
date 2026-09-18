import { DataService } from './dataService';
import { extractBudgetMeta, stripBudgetMeta } from './requestBudget';
import { extractScheduleMeta, addMinutesToTime, minutesBetween, combineBangkokDateTime } from './requestSchedule';
import { DEPOSIT_DEADLINE_HOURS } from './bookingEscrow';

const DEFAULT_BOOKING_DURATION_MINUTES = 120;
// The platform holds this share of the fee as an escrowed deposit; the rest
// is settled directly between client and freelancer (see
// src/app/pages/admin/AdminBookingDetail.tsx's note on that). Older bookings
// created before this was persisted also fall back to 30% client-side
// (src/app/pages/bookingTracking/useBookingTracking.ts) — that fallback is
// hardcoded independently of this constant (it's the rate those specific
// legacy rows were actually charged), so it won't silently drift if this
// ever changes again.
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
  // counter_time comes back from Postgres's `time` column as "HH:MM:SS", not
  // the "HH:MM" combineBangkokDateTime below expects — left un-truncated,
  // "${date}T${time}:00Z" became a malformed, doubled-up seconds string
  // (e.g. "...T16:00:00:00Z"), producing an Invalid Date whose later
  // .toISOString() call threw (surfaced in Safari as a bare "Invalid Date"
  // error), leaving the accept flow stuck with no visible reason why.
  const startDate = isAcceptedCounter ? request.counter_date : scheduleMeta?.date || null;
  const startTime = isAcceptedCounter ? String(request.counter_time).slice(0, 5) : scheduleMeta?.time || null;

  // The original ask's duration (end - start) is what a counter offer's
  // start_time carries forward when the counter didn't propose its own end
  // time (see supabase/counter_end_time.sql) — falls back to the same
  // default session length src/lib/availability.ts assumes when nothing
  // else is known.
  const originalDurationMinutes =
    scheduleMeta?.time && scheduleMeta?.endTime
      ? minutesBetween(scheduleMeta.time, scheduleMeta.endTime)
      : DEFAULT_BOOKING_DURATION_MINUTES;
  const endTime = isAcceptedCounter
    ? request.counter_end_time
      ? String(request.counter_end_time).slice(0, 5)
      : addMinutesToTime(startTime as string, originalDurationMinutes)
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
  const freelancerResponse = await DataService.getUser(String(request.freelancer_id));
  const freelancerName = freelancerResponse.data?.full_name || 'your freelancer';

  await DataService.createNotification({
    user_id: request.client_id,
    actor_id: request.freelancer_id,
    type: 'deposit_payment_required',
    title: 'Deposit payment required',
    // Instructional, not informational — the freelancer isn't the one being
    // told to pay, so their name can't be the sentence's grammatical
    // subject the way NotificationsPanel's bold actor-name prefix would
    // otherwise imply ("<b>BabyGurl</b> Pay the deposit..." reads like a
    // command directed AT her). Naming her as the object of "to" instead
    // frames it as a reminder about paying HER, not a command directed at
    // her — see NotificationsPanel.tsx's per-type suppression of that bold
    // prefix for 'deposit_payment_required' (needed here since the message
    // still contains her name — without it the bold prefix would repeat it).
    message: `Please pay the deposit for '${request.project_name}' to ${freelancerName} within ${DEPOSIT_DEADLINE_HOURS} hours to confirm your booking.`,
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
