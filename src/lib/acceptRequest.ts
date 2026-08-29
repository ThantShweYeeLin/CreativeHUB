import { DataService } from './dataService';
import { extractBudgetMeta, stripBudgetMeta } from './requestBudget';
import { extractScheduleMeta } from './requestSchedule';

// Shared by both sides of a request/counter-offer negotiation
// (FreelancerDashboard accepting a request or a client's counter, and
// RequestsPage accepting a freelancer's counter) so the booking-creation +
// conversation + group-request-progress cascade only lives in one place.
export async function acceptRequestAndCreateBooking(request: any, overrideBudget?: number): Promise<{ error: Error | null }> {
  const budgetMeta = extractBudgetMeta(request.message, request.description);
  const budget = overrideBudget ?? Number(budgetMeta?.max ?? request.budget ?? 0);
  const scheduleMeta = extractScheduleMeta(request.message, request.description);

  const bookingResponse = await DataService.createBooking({
    client_id: request.client_id,
    freelancer_id: request.freelancer_id,
    project_name: request.project_name,
    description: stripBudgetMeta(request.description || request.message || 'Auto-created from accepted request.'),
    budget,
    status: 'pending',
    payment_status: 'unpaid',
    deliverables: `Auto-created from request ${request.id}`,
    start_date: scheduleMeta?.date || null,
    start_time: scheduleMeta?.time || null,
  } as any);

  if (bookingResponse.error) {
    return { error: new Error((bookingResponse.error as any).message || 'Request accepted, but booking conversion failed.') };
  }

  await DataService.ensureConversation(request.client_id, request.freelancer_id);

  const groupMeta = DataService.getRequestGroupMeta(request);
  if (groupMeta?.group_id) {
    const progressResponse = await DataService.getClientRequestsWithProgress(request.client_id);
    const groupRows = (progressResponse.data || []).filter((row: any) => row.group_meta?.group_id === groupMeta.group_id);
    const accepted = groupRows.filter((row: any) => row.status === 'accepted').length;
    const total = groupRows.length || groupMeta.recipients.length;

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

    if (accepted === total && total > 1) {
      const recipients = Array.from(new Set(groupRows.map((row: any) => String(row.freelancer_id))));
      const members = Array.from(new Set([request.client_id, ...recipients]));
      const groupConversation = await DataService.ensureGroupConversationForRequest({
        groupRequestId: groupMeta.group_id,
        title: `${request.project_name || 'Group project'} team`,
        createdBy: request.client_id,
        memberIds: members,
      });

      if (groupConversation.data?.id) {
        await DataService.sendGroupMessage({
          conversationId: groupConversation.data.id,
          senderId: request.client_id,
          content: `All ${total} members accepted. This group chat is now ready for collaboration on ${request.project_name || 'your project'}.`,
        });
      }
    }
  }

  return { error: null };
}
