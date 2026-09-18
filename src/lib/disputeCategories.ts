// Single source of truth for the "What happened?" category picker in the
// client's Report a Problem flow, and for how each category is labeled
// everywhere it's displayed (dispute timeline, admin review page).
//
// Two categories are deliberately NOT part of the dispute/evidence system —
// they're subjective/taste-based rather than something the platform can
// objectively check against its own records, so they route to the existing
// Reviews feature instead (see supabase/dispute_categories_v2.sql for the
// schema-side rationale). Everything else routes into the dispute flow.
//
// 'differed_from_agreement' is kept in DISPUTE_CATEGORY_LABEL (but not in
// REPORT_PROBLEM_CATEGORIES as a dispute-routed option) purely so old
// disputed bookings that used it under the previous 4-category system still
// render a real label instead of the raw DB value.

export type DisputeFlowCategory =
  | 'no_show'
  | 'late_arrival'
  | 'not_performed'
  | 'deliverables_not_received'
  | 'additional_payment_requested'
  | 'unauthorized_change'
  | 'unexpected_cancellation'
  | 'other';

export type ReviewRoutedCategory = 'differed_from_agreement' | 'quality_issue';

export interface ReportProblemCategoryDef {
  id: DisputeFlowCategory | ReviewRoutedCategory;
  label: string;
  hint: string;
  routesTo: 'dispute' | 'review';
}

// Client-facing copy (reporting on the freelancer). Kept as the default
// export for backward compatibility with existing callers that don't pass
// a role — see REPORT_PROBLEM_CATEGORIES_FREELANCER below and
// getReportProblemCategories(role) for the freelancer-facing mirror
// (reporting on the client).
export const REPORT_PROBLEM_CATEGORIES: ReportProblemCategoryDef[] = [
  {
    id: 'no_show',
    label: "Freelancer didn't show up",
    hint: 'No one checked in for the booking at all.',
    routesTo: 'dispute',
  },
  {
    id: 'late_arrival',
    label: 'Freelancer arrived late',
    hint: 'They showed up, but significantly after the scheduled time.',
    routesTo: 'dispute',
  },
  {
    id: 'not_performed',
    label: "Service didn't happen",
    hint: "The freelancer was present, but the service itself wasn't carried out.",
    routesTo: 'dispute',
  },
  {
    id: 'deliverables_not_received',
    label: 'Results/deliverables not received',
    hint: 'The service happened, but the promised files, photos, or other deliverables never arrived.',
    routesTo: 'dispute',
  },
  {
    id: 'additional_payment_requested',
    label: 'Additional payment requested',
    hint: 'You were asked to pay more than what was agreed.',
    routesTo: 'dispute',
  },
  {
    id: 'unauthorized_change',
    label: 'Booking changed without agreement',
    hint: "Something about the booking changed and you didn't agree to it.",
    routesTo: 'dispute',
  },
  {
    id: 'unexpected_cancellation',
    label: 'Unexpected cancellation',
    hint: 'The booking was cancelled without proper notice.',
    routesTo: 'dispute',
  },
  {
    id: 'differed_from_agreement',
    label: 'Service differed from agreement',
    hint: 'The service happened, but the style, quality, or execution differed from what was agreed.',
    routesTo: 'review',
  },
  {
    id: 'quality_issue',
    label: 'Quality issue',
    hint: "You're unhappy with the quality of the work.",
    routesTo: 'review',
  },
  {
    id: 'other',
    label: 'Other',
    hint: "Something else that isn't covered above.",
    routesTo: 'dispute',
  },
];

// Freelancer-facing mirror (reporting on the client) — same category ids
// (the dispute/admin side is role-agnostic; only the wording of what's
// being reported differs), used when Report a Problem is opened from the
// freelancer's booking tracking page.
export const REPORT_PROBLEM_CATEGORIES_FREELANCER: ReportProblemCategoryDef[] = [
  {
    id: 'no_show',
    label: "Client didn't show up",
    hint: 'No one checked in for the booking at all.',
    routesTo: 'dispute',
  },
  {
    id: 'late_arrival',
    label: 'Client arrived late',
    hint: 'They showed up, but significantly after the scheduled time.',
    routesTo: 'dispute',
  },
  {
    id: 'additional_payment_requested',
    label: 'Client refused agreed payment',
    hint: 'The client refused to pay the amount or terms you originally agreed on.',
    routesTo: 'dispute',
  },
  {
    id: 'unauthorized_change',
    label: 'Booking changed without agreement',
    hint: "Something about the booking changed and you didn't agree to it.",
    routesTo: 'dispute',
  },
  {
    id: 'unexpected_cancellation',
    label: 'Unexpected cancellation',
    hint: 'The booking was cancelled without proper notice.',
    routesTo: 'dispute',
  },
  {
    id: 'other',
    label: 'Other',
    hint: "Something else that isn't covered above.",
    routesTo: 'dispute',
  },
];

export function getReportProblemCategories(role: 'client' | 'freelancer'): ReportProblemCategoryDef[] {
  return role === 'freelancer' ? REPORT_PROBLEM_CATEGORIES_FREELANCER : REPORT_PROBLEM_CATEGORIES;
}

// Client-facing status wording for the "Booking dispute" entries shown in
// My Tickets / the dispute ticket-style detail view — mirrors
// CLIENT_TICKET_STATUS_LABEL/_MESSAGE/_DETAIL in supportTickets.ts, but for
// bookings.dispute_status instead of support_tickets.status. 'open' is a
// legacy value no longer written by openBookingDispute (disputes now go
// straight to 'under_admin_review' on filing) but kept here so any old
// disputed booking still shows a real label instead of the raw DB value.
export type DisputeStatus = 'open' | 'under_admin_review' | 'resolved';

export const CLIENT_DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: 'Under review',
  under_admin_review: 'Under review',
  resolved: 'Resolved',
};

export const CLIENT_DISPUTE_STATUS_COLOR: Record<DisputeStatus, string> = {
  open: 'bg-amber-100 text-amber-700',
  under_admin_review: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
};

// Short one-line status preview, shown on the My Tickets card.
export const CLIENT_DISPUTE_STATUS_MESSAGE: Record<DisputeStatus, string> = {
  open: 'Your dispute is being reviewed by CreativeHUB Admin. You will be notified when there is an update.',
  under_admin_review: 'Your dispute is being reviewed by CreativeHUB Admin. You will be notified when there is an update.',
  resolved: 'CreativeHUB Admin has made a final decision on this dispute.',
};

// Longer explanation shown in the "Current status" card on the dispute's
// ticket-style detail page.
export const CLIENT_DISPUTE_STATUS_DETAIL: Record<DisputeStatus, string> = {
  open: 'CreativeHUB support is reviewing the evidence and platform records for this dispute. You can add more information below if needed.',
  under_admin_review: 'CreativeHUB support is reviewing the evidence and platform records for this dispute. You can add more information below if needed.',
  resolved: 'This dispute has been resolved. See the decision below for the outcome, including what happened to the deposit.',
};

export const DISPUTE_CATEGORY_LABEL: Record<string, string> = {
  no_show: "Freelancer didn't show up",
  late_arrival: 'Freelancer arrived late',
  not_performed: "Service didn't happen",
  deliverables_not_received: 'Results/deliverables not received',
  additional_payment_requested: 'Additional payment requested',
  unauthorized_change: 'Booking changed without agreement',
  unexpected_cancellation: 'Unexpected cancellation',
  other: 'Other',
  // Legacy values — no longer written by the current picker, kept so
  // existing disputed bookings still display a real label.
  differed_from_agreement: 'Service significantly differed from agreement',
  not_as_agreed: 'Not as agreed',
};
