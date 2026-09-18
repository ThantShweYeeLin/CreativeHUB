// Standalone security/lifecycle check for the support-ticket system — exercises
// the RLS/RPC boundary in supabase/admin_system_2_rest.sql,
// supabase/support_ticket_messages.sql, supabase/support_ticket_evidence.sql,
// and supabase/support_ticket_privacy_and_lifecycle.sql against a real
// Supabase project using real throwaway auth users, not through the UI —
// same pattern as scripts/attendance-verification-check.ts.
//
// Usage:
//   pnpm exec tsx --env-file=.env.local scripts/ticket-safety-check.ts
//
// Requires (from .env.local): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. The service-role client is used ONLY to seed
// and tear down test fixtures (including promoting one throwaway user to
// role: 'admin') — every actual ticket/message/note/dispute call goes
// through a normal per-user session, exactly like the app does.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let passCount = 0;
let failCount = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passCount += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failCount += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log('        ', detail);
  }
}

async function createTestUser(role: 'client' | 'freelancer' | 'admin', label: string) {
  const email = `ticket-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'Ticket-Test-Pass-1!';

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw new Error(`Failed to create test user: ${createError?.message}`);

  const client: SupabaseClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`Failed to sign in test user: ${signInError?.message}`);

  // 'admin' isn't a real account role elsewhere in the app (client/freelancer
  // only) — it's what is_admin() checks for, so this is the one place a test
  // fixture needs it.
  const { error: profileError } = await client.from('users').upsert({
    id: created.user.id,
    email,
    full_name: `Ticket Test ${label}`,
    role: role === 'admin' ? 'client' : role,
  } as any);
  if (profileError) throw new Error(`Failed to create profile row: ${profileError.message}`);

  if (role === 'admin') {
    const { error: promoteError } = await admin.from('users').update({ role: 'admin' } as any).eq('id', created.user.id);
    if (promoteError) throw new Error(`Failed to promote test user to admin: ${promoteError.message}`);
  }

  return { id: created.user.id, client };
}

async function cleanupUser(userId: string) {
  await admin.from('users').delete().eq('id', userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

async function createTicket(userClient: SupabaseClient, userId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await userClient
    .from('support_tickets')
    .insert({
      user_id: userId,
      category: 'technical',
      description: 'Ticket safety check fixture ticket.',
      ...overrides,
    } as any)
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create test ticket: ${error?.message}`);
  return data as any;
}

async function createBooking(clientId: string, freelancerId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from('bookings')
    .insert({
      client_id: clientId,
      freelancer_id: freelancerId,
      project_name: 'Ticket safety check test booking',
      budget: 100,
      status: 'confirmed',
      payment_status: 'deposit_paid',
      ...overrides,
    } as any)
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create test booking: ${error?.message}`);
  return data as any;
}

// Mirrors src/lib/dataService.ts's openBookingDispute exactly (can't import
// that module here — it pulls in src/lib/supabase.ts, which reads
// import.meta.env, a Vite-only construct that doesn't exist under plain
// tsx/Node execution). Any assertion below about "the app's dispute
// duplicate-guard" depends on this staying in sync with that function.
async function openBookingDispute(userClient: SupabaseClient, bookingId: string) {
  const bookingResponse = await userClient.from('bookings').select('client_id, freelancer_id, dispute_status').eq('id', bookingId).single();
  if (bookingResponse.error || !bookingResponse.data) return { data: null, error: bookingResponse.error };
  const booking = bookingResponse.data as any;
  if (booking.dispute_status && booking.dispute_status !== 'none') {
    return { data: null, error: { message: 'A dispute has already been filed for this booking.' } };
  }
  const { data, error } = await userClient
    .from('bookings')
    .update({ dispute_status: 'under_admin_review', dispute_round: 1, dispute_awaiting: null, dispute_response_deadline: null } as any)
    .eq('id', bookingId)
    .eq('dispute_status', booking.dispute_status ?? 'none')
    .select()
    .single();
  if (error || !data) return { data: null, error: error || { message: 'A dispute has already been filed for this booking.' } };
  return { data, error: null };
}

async function main() {
  console.log('Support ticket safety/workflow check\n');

  const owner = await createTestUser('client', 'owner');
  const outsider = await createTestUser('client', 'outsider');
  const freelancer = await createTestUser('freelancer', 'freelancer');
  const admin1 = await createTestUser('admin', 'admin1');

  try {
    // ============================================================
    console.log('1. Cross-user ticket access is denied');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);

      const { data: outsiderRead, error: outsiderError } = await outsider.client.from('support_tickets').select('*').eq('id', ticket.id).maybeSingle();
      check('non-owner, non-admin cannot read the ticket', !outsiderError && outsiderRead === null, { outsiderError, outsiderRead });

      const { data: adminRead, error: adminError } = await admin1.client.from('support_tickets').select('*').eq('id', ticket.id).maybeSingle();
      check('admin CAN read the ticket', !adminError && adminRead?.id === ticket.id, { adminError, adminRead });

      const { data: ownerRead, error: ownerError } = await owner.client.from('support_tickets').select('*').eq('id', ticket.id).maybeSingle();
      check('owner CAN read their own ticket', !ownerError && ownerRead?.id === ticket.id, { ownerError, ownerRead });

      // A freelancer account with no relationship to this ticket at all is
      // just another "outsider" as far as this table's RLS is concerned —
      // confirms the denial isn't accidentally scoped to "client role only".
      const { data: freelancerRead, error: freelancerError } = await freelancer.client.from('support_tickets').select('*').eq('id', ticket.id).maybeSingle();
      check('an unrelated freelancer account cannot read the ticket either', !freelancerError && freelancerRead === null, { freelancerError, freelancerRead });

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('2. Admin-only private notes are genuinely private (DB level, not UI)');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);
      const secretNote = 'SECRET_INTERNAL_NOTE_' + Math.random().toString(36).slice(2, 10);

      const { error: nonAdminRpcError } = await owner.client.rpc('admin_add_ticket_note', { p_ticket_id: ticket.id, p_note: 'should not work' });
      check('non-admin cannot call admin_add_ticket_note', Boolean(nonAdminRpcError), nonAdminRpcError?.message);

      const { data: addedNote, error: addNoteError } = await admin1.client.rpc('admin_add_ticket_note', { p_ticket_id: ticket.id, p_note: secretNote });
      check('admin can call admin_add_ticket_note', !addNoteError && addedNote?.note === secretNote, addNoteError?.message);

      const { data: ownerNotesRead, error: ownerNotesError } = await owner.client.from('support_ticket_admin_notes').select('*').eq('ticket_id', ticket.id);
      check('ticket owner querying support_ticket_admin_notes directly gets nothing', !ownerNotesError && (ownerNotesRead || []).length === 0, {
        ownerNotesError,
        ownerNotesRead,
      });

      const { data: adminNotesRead, error: adminNotesError } = await admin1.client.from('support_ticket_admin_notes').select('*').eq('ticket_id', ticket.id);
      check(
        'admin querying support_ticket_admin_notes directly sees the note',
        !adminNotesError && (adminNotesRead || []).some((n: any) => n.note === secretNote),
        { adminNotesError, adminNotesRead }
      );

      // Not even an admin can write to this table by a plain insert — only
      // the security-definer RPC can (it bypasses RLS as the function
      // owner). No INSERT policy exists at all, so this must fail for
      // everyone, admin included.
      const { error: adminDirectInsertError } = await admin1.client.from('support_ticket_admin_notes').insert({
        ticket_id: ticket.id,
        admin_id: admin1.id,
        note: 'direct insert attempt',
      } as any);
      check('even an admin session cannot INSERT into support_ticket_admin_notes directly', Boolean(adminDirectInsertError), adminDirectInsertError?.message);

      const { error: statusRpcError } = await admin1.client.rpc('admin_update_ticket_status', {
        p_ticket_id: ticket.id,
        p_status: 'resolved',
        p_notes: secretNote,
      });
      check('admin_update_ticket_status with a private note succeeds', !statusRpcError, statusRpcError?.message);

      const { data: events } = await owner.client.from('support_ticket_events').select('*').eq('ticket_id', ticket.id);
      const statusChangedEvent = (events || []).find((e: any) => e.action === 'status_changed');
      check('the status_changed timeline event the owner can read has no note text at all', statusChangedEvent && statusChangedEvent.note === null, statusChangedEvent);
      check(
        'the private note text never leaked into any event the owner can read',
        !(events || []).some((e: any) => e.note && e.note.includes(secretNote)),
        events
      );

      const { data: notifications } = await owner.client.from('notifications').select('*').eq('related_id', ticket.id).eq('type', 'ticket_status_updated');
      check(
        'the notification sent to the owner is generic, never the private note text',
        (notifications || []).length > 0 && !(notifications || []).some((n: any) => n.message?.includes(secretNote)),
        notifications
      );

      const { error: nonAdminStatusError } = await owner.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'closed' });
      check('non-admin cannot call admin_update_ticket_status', Boolean(nonAdminStatusError), nonAdminStatusError?.message);

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('3. Public replies remain visible to the ticket owner');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);
      const replyText = 'PUBLIC_REPLY_' + Math.random().toString(36).slice(2, 10);

      const { error: replyError } = await admin1.client.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: admin1.id,
        message: replyText,
      } as any);
      check('admin can send a reply', !replyError, replyError?.message);

      const { data: ownerSeesReply, error: ownerMsgError } = await owner.client.from('support_ticket_messages').select('*').eq('ticket_id', ticket.id);
      check('ticket owner can see the admin reply', !ownerMsgError && (ownerSeesReply || []).some((m: any) => m.message === replyText), {
        ownerMsgError,
        ownerSeesReply,
      });

      const { data: outsiderMsgRead, error: outsiderMsgError } = await outsider.client.from('support_ticket_messages').select('*').eq('ticket_id', ticket.id);
      check('an unrelated user cannot see the reply', !outsiderMsgError && (outsiderMsgRead || []).length === 0, { outsiderMsgError, outsiderMsgRead });

      const { data: replyNotification } = await owner.client.from('notifications').select('*').eq('related_id', ticket.id).eq('type', 'ticket_reply');
      check('the owner was notified of the reply', (replyNotification || []).length > 0, replyNotification);

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('4. Awaiting-evidence transition works end to end');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);
      const evidenceNote = 'Please attach a screenshot of the error.';

      const { error: nonAdminEvidenceReqError } = await owner.client.rpc('admin_request_ticket_evidence', { p_ticket_id: ticket.id, p_note: evidenceNote });
      check('non-admin cannot call admin_request_ticket_evidence', Boolean(nonAdminEvidenceReqError), nonAdminEvidenceReqError?.message);

      const { data: afterRequest, error: requestError } = await admin1.client.rpc('admin_request_ticket_evidence', {
        p_ticket_id: ticket.id,
        p_note: evidenceNote,
      });
      check('admin can request evidence', !requestError && afterRequest?.status === 'awaiting_evidence', requestError?.message || afterRequest);

      const { data: evidenceReqNotification } = await owner.client.from('notifications').select('*').eq('related_id', ticket.id).eq('type', 'ticket_evidence_requested');
      check(
        'owner is notified with the (intentionally public) evidence-request note',
        (evidenceReqNotification || []).some((n: any) => n.message === evidenceNote),
        evidenceReqNotification
      );

      const { error: wrongUserSubmitError } = await outsider.client.rpc('submit_ticket_evidence', {
        p_ticket_id: ticket.id,
        p_note: 'not my ticket',
        p_evidence_paths: [],
      });
      check('a non-owner cannot submit evidence on someone else\'s ticket', Boolean(wrongUserSubmitError), wrongUserSubmitError?.message);

      const { data: afterSubmit, error: submitError } = await owner.client.rpc('submit_ticket_evidence', {
        p_ticket_id: ticket.id,
        p_note: 'Here it is.',
        p_evidence_paths: ['fake/evidence.png'],
      });
      check('owner submitting evidence returns the ticket to in_progress', !submitError && afterSubmit?.status === 'in_progress', submitError?.message || afterSubmit);

      const { error: repeatSubmitError } = await owner.client.rpc('submit_ticket_evidence', { p_ticket_id: ticket.id, p_note: 'again', p_evidence_paths: [] });
      check('submitting evidence again once no longer awaiting_evidence is rejected (re-derived server-side, not trusted from caller)', Boolean(repeatSubmitError), repeatSubmitError?.message);

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('5. Resolved-ticket reply reopens it; closed tickets reject replies');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);
      await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'resolved' });

      const { error: replyOnResolvedError } = await owner.client.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: owner.id,
        message: 'Actually, still broken.',
      } as any);
      check('owner CAN reply to a resolved ticket', !replyOnResolvedError, replyOnResolvedError?.message);

      const { data: reopenedTicket } = await owner.client.from('support_tickets').select('status').eq('id', ticket.id).single();
      check('the reply reopened the ticket to in_progress', reopenedTicket?.status === 'in_progress', reopenedTicket);

      const { data: reopenEvent } = await owner.client.from('support_ticket_events').select('*').eq('ticket_id', ticket.id).eq('action', 'reopened');
      check('a reopened timeline event was logged', (reopenEvent || []).length > 0, reopenEvent);

      await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'resolved' });
      const { error: adminReplyOnResolvedError } = await admin1.client.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: admin1.id,
        message: 'One more thing.',
      } as any);
      check('admin can also reply to a resolved ticket', !adminReplyOnResolvedError, adminReplyOnResolvedError?.message);
      const { data: stillResolved } = await owner.client.from('support_tickets').select('status').eq('id', ticket.id).single();
      check('an admin reply does NOT trigger the reopen (only the owner\'s own reply does)', stillResolved?.status === 'resolved', stillResolved);

      await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'closed' });
      const { error: replyOnClosedError } = await owner.client.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: owner.id,
        message: 'Reopen please.',
      } as any);
      check('owner CANNOT reply to a closed ticket (rejected by RLS, not just hidden in the UI)', Boolean(replyOnClosedError), replyOnClosedError?.message);

      const { error: adminReplyOnClosedError } = await admin1.client.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: admin1.id,
        message: 'Reopen please.',
      } as any);
      check('admin also cannot reply to a closed ticket', Boolean(adminReplyOnClosedError), adminReplyOnClosedError?.message);

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('6. Resolve and close are distinct actions, and reject invalid statuses');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);
      const { data: resolved } = await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'resolved' });
      check('resolve sets status to resolved (not closed)', resolved?.status === 'resolved', resolved);
      const { data: closed } = await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'closed' });
      check('close is a separate, later action that sets status to closed', closed?.status === 'closed', closed);

      const { error: invalidStatusError } = await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'made_up_status' });
      check('an invalid status value is rejected', Boolean(invalidStatusError), invalidStatusError?.message);

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('7. Audit log (admin_actions) is written and stays admin-only');
    // ============================================================
    {
      const ticket = await createTicket(owner.client, owner.id);
      await admin1.client.rpc('admin_update_ticket_status', { p_ticket_id: ticket.id, p_status: 'in_progress', p_notes: 'audit check' });

      const { data: actionsAsAdmin } = await admin1.client.from('admin_actions').select('*').eq('target_id', ticket.id);
      check(
        'admin_actions recorded the status-update action',
        (actionsAsAdmin || []).some((a: any) => a.action_type === 'update_ticket_status' && a.target_type === 'ticket'),
        actionsAsAdmin
      );

      const { data: actionsAsOwner, error: actionsAsOwnerError } = await owner.client.from('admin_actions').select('*').eq('target_id', ticket.id);
      check('a non-admin cannot read the audit log at all', !actionsAsOwnerError && (actionsAsOwner || []).length === 0, {
        actionsAsOwnerError,
        actionsAsOwner,
      });

      await admin.from('support_tickets').delete().eq('id', ticket.id);
    }

    // ============================================================
    console.log('8. Legitimate payment/technical/general tickets are never blocked');
    // ============================================================
    {
      const technicalTicket = await createTicket(owner.client, owner.id, { category: 'technical', description: 'The upload button is broken on my phone.' });
      check('a technical ticket is created normally', Boolean(technicalTicket?.id), technicalTicket);

      const booking = await createBooking(owner.id, freelancer.id);
      const paymentTicket = await createTicket(owner.client, owner.id, {
        category: 'payment',
        description: 'My deposit payment failed with a gateway error.',
        related_booking_id: booking.id,
      });
      check('a payment-failure ticket (booking-adjacent) is created normally, not blocked', Boolean(paymentTicket?.id), paymentTicket);

      await admin.from('support_tickets').delete().eq('id', technicalTicket.id);
      await admin.from('support_tickets').delete().eq('id', paymentTicket.id);
      await admin.from('bookings').delete().eq('id', booking.id);
    }

    // ============================================================
    console.log('9. Duplicate dispute submissions cannot both succeed');
    // ============================================================
    {
      const booking = await createBooking(owner.id, freelancer.id);

      const first = await openBookingDispute(owner.client, booking.id);
      check('first dispute report succeeds', !first.error && first.data?.dispute_status === 'under_admin_review', first.error);

      const second = await openBookingDispute(freelancer.client, booking.id);
      check('a second, sequential dispute report on the same booking is rejected', Boolean(second.error), second.error);

      const raceBooking = await createBooking(owner.id, freelancer.id);
      const [raceA, raceB] = await Promise.all([openBookingDispute(owner.client, raceBooking.id), openBookingDispute(freelancer.client, raceBooking.id)]);
      const successes = [raceA, raceB].filter((r) => !r.error && r.data);
      const failures = [raceA, raceB].filter((r) => r.error);
      check('exactly one of two concurrent dispute reports on the same booking succeeds', successes.length === 1 && failures.length === 1, {
        raceA,
        raceB,
      });

      await admin.from('bookings').delete().eq('id', booking.id);
      await admin.from('bookings').delete().eq('id', raceBooking.id);
    }
  } finally {
    // admin_actions.admin_id has no ON DELETE CASCADE (by design — an audit
    // log shouldn't quietly lose rows just because an account is later
    // deleted) — the rows this run generated have to go first, or deleting
    // the admin fixture user below fails with a foreign-key violation and
    // leaves it behind.
    await admin.from('admin_actions').delete().eq('admin_id', admin1.id);
    await cleanupUser(owner.id);
    await cleanupUser(outsider.id);
    await cleanupUser(freelancer.id);
    await cleanupUser(admin1.id);
  }

  console.log(`\n${passCount} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
