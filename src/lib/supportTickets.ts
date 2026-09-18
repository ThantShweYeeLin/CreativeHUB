export type TicketCategory = 'technical' | 'payment' | 'account' | 'booking' | 'suggestion' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'awaiting_evidence' | 'resolved' | 'closed';

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  technical: 'Technical problem',
  payment: 'Payment problem',
  account: 'Account problem',
  booking: 'Booking problem',
  suggestion: 'Suggestion / Feedback',
  other: 'Other',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  awaiting_evidence: 'Needs your input',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_STATUS_COLOR: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  awaiting_evidence: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-600',
};

// Client-facing wording only (My Tickets card + Ticket Details page) - the
// admin dashboard keeps TICKET_STATUS_LABEL above (e.g. "Open", "Needs your
// input") since that's the precise, ops-oriented status admins triage by.
// These are the friendlier translations a client reads, per status:
//   open              -> "Submitted"              -> ticket received
//   in_progress       -> "In progress"             -> support is reviewing
//   awaiting_evidence -> "More information needed" -> client must respond
//   resolved          -> "Resolved"                -> issue addressed
//   closed            -> "Closed"                  -> no further action
export const CLIENT_TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Submitted',
  in_progress: 'In progress',
  awaiting_evidence: 'More information needed',
  resolved: 'Resolved',
  closed: 'Closed',
};

// Short one-line status preview, shown on the My Tickets card.
export const CLIENT_TICKET_STATUS_MESSAGE: Record<TicketStatus, string> = {
  open: 'Your ticket has been received.',
  in_progress: 'Support is reviewing your ticket.',
  awaiting_evidence: 'Please provide the requested information.',
  resolved: 'The issue has been addressed.',
  closed: 'This ticket is closed. Contact support if you need further help.',
};

// Longer explanation shown in the "Current status" card on the ticket
// details page - never mentions internal notes, other users' evidence, or
// moderation details, only what's happening to the client's own ticket.
export const CLIENT_TICKET_STATUS_DETAIL: Record<TicketStatus, string> = {
  open: 'Your ticket has been received and is in the queue for a support administrator to review.',
  in_progress: 'Our support team is reviewing your ticket. You can reply below if you have more information.',
  awaiting_evidence: "We need more information from you before we can continue. See below for exactly what's needed.",
  resolved: "This issue has been addressed. If it's still a problem, reply below and we'll reopen it.",
  closed: 'This ticket is closed. Contact support if you need further help.',
};

// related_booking_id is a uuid column - matches any RFC 4122 UUID
// regardless of version, not just v4, since that's all Postgres itself
// requires.
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidBookingId(value: string): boolean {
  return UUID_FORMAT.test(value.trim());
}

// Content-based, not category-based - selecting "Booking problem" alone must
// never block/redirect (payment failures, technical errors, and general
// booking questions are legitimate tickets too). Only a description that
// actually reads like a no-show/late-arrival/missing-deliverable report
// should route to the booking's own dispute flow instead of a plain ticket.
const DISPUTE_REPORT_PATTERN =
  /\b(no[\s-]?show|didn'?t\s+show|did\s+not\s+show|never\s+show(?:ed)?|never\s+arriv(?:ed|e)|didn'?t\s+arriv(?:e|ed)|did\s+not\s+arrive|missing\s+deliverable|didn'?t\s+deliver|did\s+not\s+deliver|never\s+deliver(?:ed)?|not\s+delivered|incomplete\s+(?:service|work|job)|didn'?t\s+finish|did\s+not\s+finish|unfinished\s+(?:service|work|job))\b/i;

export function looksLikeDisputeReport(description: string): boolean {
  return DISPUTE_REPORT_PATTERN.test(description);
}
