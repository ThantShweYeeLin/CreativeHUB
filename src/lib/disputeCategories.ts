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
