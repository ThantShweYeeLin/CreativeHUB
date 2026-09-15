import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { REPORT_PROBLEM_CATEGORIES, type DisputeFlowCategory } from '../../../lib/disputeCategories';
import { DISPUTE_CATEGORY_CONFIG, EVIDENCE_TYPE_OPTIONS, createEvidenceItem, type LocalEvidenceItem } from '../../../lib/disputeFlowConfig';
import { BookingReviewPrompt } from './BookingReviewPrompt';
import { EvidenceItemEditor } from './EvidenceItemEditor';
import { PlatformRecordsPanel } from './PlatformRecordsPanel';

interface ReportProblemFlowProps {
  bookingId: string;
  userId: string;
  booking: any;
  events: any[];
  confirmations: any[];
  freelancerId: string;
  freelancerName: string;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
  // Lets DeliveryCard's "report a delivery issue" shortcut skip straight to
  // the details step, already knowing which category applies — the client
  // already told us what's wrong by clicking that specific button.
  initialCategory?: DisputeFlowCategory;
}

type Step = 'category' | 'review_redirect' | 'details' | 'summary';

// Step 1 of the dispute flow (see supabase/dispute_categories_v2.sql and
// src/lib/disputeCategories.ts for the category design/rationale): what
// happened, then route either into the dispute/evidence system or, for the
// two subjective/taste categories, into the existing Reviews feature
// instead. Steps 2-6 for the 8 dispute categories: category-specific
// quick questions, auto-collected platform records shown as read-only
// context, tiered evidence upload (src/lib/disputeFlowConfig.ts decides
// what's required vs. optional per category), a review summary, then
// submit.
export function ReportProblemFlow({ bookingId, userId, booking, events, confirmations, freelancerId, freelancerName, onClose, onSubmitted, initialCategory }: ReportProblemFlowProps) {
  const [step, setStep] = useState<Step>(initialCategory ? 'details' : 'category');
  const [category, setCategory] = useState<DisputeFlowCategory | null>(initialCategory ?? null);
  const [quickAnswers, setQuickAnswers] = useState<Record<string, string>>({});
  const [explanation, setExplanation] = useState('');
  const [evidenceItems, setEvidenceItems] = useState<LocalEvidenceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryDef = category ? REPORT_PROBLEM_CATEGORIES.find((option) => option.id === category) : null;
  const config = category ? DISPUTE_CATEGORY_CONFIG[category] : null;

  const selectCategory = (id: DisputeFlowCategory | 'differed_from_agreement' | 'quality_issue', routesTo: 'dispute' | 'review') => {
    setError(null);
    if (routesTo === 'review') {
      setStep('review_redirect');
      return;
    }
    setCategory(id as DisputeFlowCategory);
    setQuickAnswers({});
    setEvidenceItems([]);
    setStep('details');
  };

  const addEvidenceItem = () => {
    setEvidenceItems((current) => [...current, createEvidenceItem(config?.suggestedEvidenceTypes[0])]);
  };

  const updateEvidenceItem = (id: string, patch: Partial<LocalEvidenceItem>) => {
    setEvidenceItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeEvidenceItem = (id: string) => {
    setEvidenceItems((current) => current.filter((item) => item.id !== id));
  };

  const proceedToSummary = () => {
    if (!explanation.trim()) {
      setError('Describe the problem before continuing.');
      return;
    }
    if (config?.evidenceRequired && !evidenceItems.some((item) => item.file)) {
      setError('This category needs at least one piece of evidence — the platform has no other way to check it.');
      return;
    }
    setError(null);
    setStep('summary');
  };

  const handleSubmit = async () => {
    if (!category) return;
    setIsSubmitting(true);
    setError(null);

    const answerLines = (config?.quickQuestions || [])
      .map((q) => (quickAnswers[q.id]?.trim() ? `${q.label} ${quickAnswers[q.id].trim()}` : null))
      .filter(Boolean);
    const formattedReason = [...answerLines, explanation.trim()].filter(Boolean).join('\n');

    const response = await DataService.openBookingDispute(bookingId, {
      category,
      reason: formattedReason,
    });

    if (response.error) {
      setIsSubmitting(false);
      setError((response.error as any).message || 'Unable to submit dispute.');
      return;
    }

    for (const item of evidenceItems) {
      if (!item.file) continue;
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(userId, bookingId, item.file);
      if (uploadResponse.error || !uploadResponse.path) {
        continue;
      }
      await DataService.submitDisputeEvidenceItem({
        bookingId,
        round: 1,
        submittedBy: userId,
        role: 'client',
        evidenceType: item.evidenceType,
        storagePath: uploadResponse.path,
        description: item.description.trim() || null,
      });
    }

    setIsSubmitting(false);
    await onSubmitted();
  };

  if (step === 'category') {
    return (
      <div className="mt-2 rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold text-gray-900">What happened?</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {REPORT_PROBLEM_CATEGORIES.map((option) => (
            <button
              key={option.id}
              onClick={() => selectCategory(option.id, option.routesTo)}
              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2.5 text-left text-sm hover:border-sky-400 hover:bg-sky-50"
            >
              <span className="block font-semibold text-gray-900">{option.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'review_redirect') {
    return (
      <div className="mt-2 rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setStep('category')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-700">
          This sounds like a style or quality concern rather than a platform policy issue — those are best shared as a
          review. Reviews help other clients make informed choices, and your rating directly reflects your experience.
        </p>
        <p className="mb-4 text-xs text-gray-500">
          If something else happened too — like non-delivery or an unauthorized extra charge — you can report that
          separately from the category list.
        </p>
        <BookingReviewPrompt bookingId={bookingId} viewerId={userId} revieweeId={freelancerId} revieweeName={freelancerName} />
      </div>
    );
  }

  if (step === 'details' && category && config) {
    return (
      <div className="mt-2 rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          {initialCategory ? (
            <p className="font-bold text-gray-900">Report a Problem</p>
          ) : (
            <button onClick={() => setStep('category')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{categoryDef?.label}</p>

        <PlatformRecordsPanel category={category} booking={booking} events={events} confirmations={confirmations} />

        {config.quickQuestions.length > 0 && (
          <div className="mb-3 space-y-2">
            {config.quickQuestions.map((q) => (
              <div key={q.id}>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{q.label}</label>
                <input
                  value={quickAnswers[q.id] || ''}
                  onChange={(e) => setQuickAnswers((current) => ({ ...current, [q.id]: e.target.value }))}
                  className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        <label className="mb-1 block text-xs font-semibold text-gray-600">Describe the problem</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Describe the issue in detail..."
          className="mb-3 w-full min-h-[80px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
        />

        <EvidenceItemEditor
          items={evidenceItems}
          onAdd={addEvidenceItem}
          onUpdate={updateEvidenceItem}
          onRemove={removeEvidenceItem}
          label={`Evidence ${config.evidenceRequired ? '(required)' : '(optional)'}`}
          helperText={config.evidenceHelperText}
        />

        <button
          onClick={proceedToSummary}
          className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all"
        >
          Review Report
        </button>
      </div>
    );
  }

  if (step === 'summary' && category && categoryDef) {
    return (
      <div className="mt-2 rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setStep('details')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Review before submitting</p>
        <p className="mb-3 font-bold text-gray-900">{categoryDef.label}</p>

        {(DISPUTE_CATEGORY_CONFIG[category].quickQuestions || []).map((q) =>
          quickAnswers[q.id]?.trim() ? (
            <p key={q.id} className="mb-1 text-sm text-gray-700">
              <span className="text-gray-500">{q.label}</span> {quickAnswers[q.id]}
            </p>
          ) : null
        )}

        <p className="mb-3 mt-2 whitespace-pre-line text-sm text-gray-700">{explanation}</p>

        {evidenceItems.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Evidence ({evidenceItems.filter((i) => i.file).length})</p>
            {evidenceItems.filter((i) => i.file).map((item) => (
              <div key={item.id} className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-gray-900">{EVIDENCE_TYPE_OPTIONS.find((o) => o.value === item.evidenceType)?.label}</span>
                <span className="text-gray-500"> — {item.file?.name}</span>
                {item.description && <p className="mt-0.5 text-gray-600">{item.description}</p>}
              </div>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        <p className="mb-3 text-xs text-gray-500">
          Provide information and evidence that can help us review your report. This report is reviewed alongside the
          booking agreement and platform records, and the freelancer will have a chance to respond — it isn't decided
          on evidence alone.
        </p>
        <button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    );
  }

  return null;
}
