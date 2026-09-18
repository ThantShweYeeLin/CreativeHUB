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
