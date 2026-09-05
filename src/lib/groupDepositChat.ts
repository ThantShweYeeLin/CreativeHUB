import { DataService } from './dataService';

// A group request's team chat used to auto-create the moment every
// recipient accepted — but an accepted-and-unfunded booking is still
// cancellable within its 24h deposit window, so "the group project is
// really happening" is a better fit for every member's deposit landing,
// not just every acceptance. Called from BookingTrackingClientPage's
// deposit-transfer handler with the just-updated booking (payment_status
// already 'deposit_paid' at that point) — a no-op for any non-group
// booking.
export async function checkGroupDepositsAndCreateChat(booking: any, actingUserId: string): Promise<void> {
  const groupId = booking?.group_id;
  if (!groupId) {
    return;
  }

  // bookings RLS only shows a caller their own bookings — the client here
  // is the one authenticated user who legitimately spans every booking in
  // the group (they're the client on all of them), but this still goes
  // through the same security-definer path as the acceptance-side check
  // for consistency rather than assuming that always holds.
  const { data: members, error } = await DataService.getGroupBookingMembers(groupId);
  if (error || !members) {
    console.error('Failed to check group deposit progress:', error);
    return;
  }

  const total = members.length;
  const allPaid = total > 1 && members.every((member) => member.payment_status === 'deposit_paid' || member.payment_status === 'paid');
  if (!allPaid) {
    return;
  }

  const recipients = Array.from(new Set(members.map((member) => String(member.freelancer_id))));
  const groupMembers = Array.from(new Set([booking.client_id, ...recipients]));

  const groupConversation = await DataService.ensureGroupConversationForRequest({
    groupRequestId: groupId,
    title: `${booking.project_name || 'Group project'} team`,
    createdBy: actingUserId,
    memberIds: groupMembers,
  });

  if (groupConversation.data?.id) {
    await DataService.sendGroupMessage({
      conversationId: groupConversation.data.id,
      senderId: actingUserId,
      content: `All ${total} deposits are secured. This group chat is now ready for collaboration on ${booking.project_name || 'your project'}.`,
    });
  } else if (groupConversation.error) {
    console.error('Failed to create group chat after all deposits paid:', groupConversation.error);
  }
}
