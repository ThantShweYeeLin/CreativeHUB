import type { DisputeFlowCategory } from './disputeCategories';

export type EvidenceType = 'photo' | 'video' | 'screenshot' | 'document' | 'message' | 'other';

export const EVIDENCE_TYPE_OPTIONS: { value: EvidenceType; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'document', label: 'Document' },
  { value: 'message', label: 'Message/communication' },
  { value: 'other', label: 'Other' },
];

// Shared shape for an in-progress (not-yet-uploaded) evidence item, used by
// both the client's ReportProblemFlow and the freelancer's
// RespondToDisputeForm — one row per file, each independently tagged with a
// type and optional description (see supabase/dispute_evidence.sql).
export interface LocalEvidenceItem {
  id: string;
  file: File | null;
  evidenceType: EvidenceType;
  description: string;
}

export function createEvidenceItem(defaultType: EvidenceType = 'photo'): LocalEvidenceItem {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: null, evidenceType: defaultType, description: '' };
}

export interface QuickQuestion {
  id: string;
  label: string;
  placeholder?: string;
}

export interface DisputeCategoryConfig {
  // Short structured questions shown above the free-text explanation —
  // corroborating detail the platform's own records can't establish on
  // their own (e.g. the client's own arrival time for a no-show claim).
  quickQuestions: QuickQuestion[];
  // Whether at least one evidence item is required to submit. Only true
  // where the platform genuinely cannot evaluate the claim without it — a
  // no-show or late-arrival claim is already covered by check-in records,
  // so evidence there is only ever helpful, never required.
  evidenceRequired: boolean;
  evidenceHelperText: string;
  suggestedEvidenceTypes: EvidenceType[];
}

export const DISPUTE_CATEGORY_CONFIG: Record<DisputeFlowCategory, DisputeCategoryConfig> = {
  no_show: {
    quickQuestions: [
      { id: 'arrival_time', label: 'What time did you arrive at the location?' },
      { id: 'checked_in', label: 'Did you check in via the app? If not, why not?' },
    ],
    evidenceRequired: false,
    evidenceHelperText: 'Both check-ins and the scheduled time already cover this — evidence here is optional, not required.',
    suggestedEvidenceTypes: ['photo', 'message'],
  },
  late_arrival: {
    quickQuestions: [
      { id: 'arrival_time', label: 'What time did the freelancer actually arrive?' },
      { id: 'delay_minutes', label: 'Roughly how late were they?' },
    ],
    evidenceRequired: false,
    evidenceHelperText: 'Check-in timestamps already cover this — evidence here is optional, not required.',
    suggestedEvidenceTypes: ['photo', 'message'],
  },
  not_performed: {
    quickQuestions: [],
    evidenceRequired: false,
    evidenceHelperText: 'Check-ins, booking status, and the agreement already give us context — add messages or photos if they help explain what happened.',
    suggestedEvidenceTypes: ['message', 'photo'],
  },
  deliverables_not_received: {
    quickQuestions: [
      { id: 'requested_results', label: 'Have you messaged the freelancer asking for the results?' },
    ],
    evidenceRequired: true,
    evidenceHelperText: 'The platform can see the delivery status the freelancer set, but not whether files were actually sent to you — please include proof of non-receipt (e.g. a message asking for the results).',
    suggestedEvidenceTypes: ['message', 'screenshot'],
  },
  additional_payment_requested: {
    quickQuestions: [
      { id: 'amount_requested', label: 'How much extra were you asked to pay?' },
      { id: 'stated_reason', label: 'What reason did they give, if any?' },
    ],
    evidenceRequired: true,
    evidenceHelperText: "The platform only has a record of the originally agreed price — it has no way to see a request made outside the app, so please include a screenshot or message of the request.",
    suggestedEvidenceTypes: ['screenshot', 'message'],
  },
  unauthorized_change: {
    quickQuestions: [
      { id: 'what_changed', label: 'What changed compared to what you originally agreed?' },
    ],
    evidenceRequired: false,
    evidenceHelperText: "We'll show the agreement snapshot against the booking's current details below — add messages or screenshots if they add context.",
    suggestedEvidenceTypes: ['message', 'screenshot'],
  },
  unexpected_cancellation: {
    quickQuestions: [
      { id: 'notice_given', label: 'When were you notified of the cancellation, if at all?' },
    ],
    evidenceRequired: false,
    evidenceHelperText: 'The cancellation record below already covers who cancelled, when, and why — evidence here is optional.',
    suggestedEvidenceTypes: ['message'],
  },
  other: {
    quickQuestions: [],
    evidenceRequired: false,
    evidenceHelperText: 'Add any evidence that helps explain the situation.',
    suggestedEvidenceTypes: ['photo', 'video', 'screenshot', 'document', 'message', 'other'],
  },
};
