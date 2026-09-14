import { Camera, FileText } from 'lucide-react';

// Re-exported for the two existing import sites (this file's own use below,
// and AdminBookingDetail.tsx) — the actual category-to-label mapping lives
// in src/lib/disputeCategories.ts alongside the full "What happened?"
// category picker, so both stay in sync from one source.
export { DISPUTE_CATEGORY_LABEL } from '../../../lib/disputeCategories';
import { DISPUTE_CATEGORY_LABEL } from '../../../lib/disputeCategories';

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  photo: 'Photo',
  video: 'Video',
  screenshot: 'Screenshot',
  document: 'Document',
  message: 'Message',
  other: 'Other',
};

interface DisputeTimelineProps {
  events: any[];
  signedUrls: Record<string, string>;
  // Per-item tagged evidence (supabase/dispute_evidence.sql) — associated
  // with a round's complain/evidence event by (round, submitter role),
  // since one client submission and one freelancer response happen per
  // round. Optional so existing callers that haven't been updated yet keep
  // working (falls back to just the legacy evidence_photos rendering).
  disputeEvidence?: any[];
}

export function DisputeTimeline({ events, signedUrls, disputeEvidence = [] }: DisputeTimelineProps) {
  // Normal per-round complain/evidence/concede events, plus the round-less
  // system escalation notes (72h timeout, round cap) and admin's own
  // actions (decision, request-more-evidence) - everything else (deposit
  // paid, completion submitted, etc.) isn't part of the dispute itself.
  const disputeEvents = events.filter(
    (event) => event.round != null || event.actor === 'admin' || (event.actor === 'system' && event.action === 'complain')
  );

  const actorLabel = (actor: string) => (actor === 'client' ? 'Client' : actor === 'freelancer' ? 'Freelancer' : actor === 'admin' ? 'Admin' : 'System');

  return (
    <div className="mb-4 space-y-3 border-l-2 border-gray-200 pl-4">
      {disputeEvents.map((event) => {
        const itemsForEvent =
          event.round != null && (event.actor === 'client' || event.actor === 'freelancer')
            ? disputeEvidence.filter((item) => item.round === event.round && item.role === event.actor)
            : [];

        return (
          <div key={event.id} className="relative">
            <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
            <p className="text-xs text-gray-500">
              {event.round != null ? `Round ${event.round} — ` : ''}{actorLabel(event.actor)} ·{' '}
              {new Date(event.created_at).toLocaleString()}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {event.action === 'complain' && event.actor === 'client' && `Reported a problem${event.category ? ` (${DISPUTE_CATEGORY_LABEL[event.category] || event.category})` : ''}`}
              {event.action === 'complain' && event.actor !== 'client' && (event.actor === 'admin' ? 'Requested more evidence' : 'Escalated for review')}
              {event.action === 'evidence' && 'Responded with evidence'}
              {event.action === 'conceded' && 'Conceded — no evidence provided'}
              {event.action === 'refunded' && 'Decision: refunded the client'}
              {event.action === 'released' && 'Decision: released to the freelancer'}
            </p>
            {event.reason && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">"{event.reason}"</p>}
            {event.evidence_text && <p className="mt-1 text-sm text-gray-600">{event.evidence_text}</p>}
            {(event.evidence_photos || []).length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {(event.evidence_photos as string[]).map((path) => (
                  <div key={path} className="aspect-square overflow-hidden rounded bg-gray-100">
                    {signedUrls[path] ? (
                      <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Camera className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {itemsForEvent.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {itemsForEvent.map((item) => (
                  <div key={item.id} className="flex gap-2 rounded-lg border border-gray-200 bg-white p-2">
                    {item.storage_path && signedUrls[item.storage_path] ? (
                      <img src={signedUrls[item.storage_path]} alt={item.evidence_type} className="h-12 w-12 flex-shrink-0 rounded object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                        <FileText className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {EVIDENCE_TYPE_LABEL[item.evidence_type] || item.evidence_type}
                      </p>
                      {item.description && <p className="text-sm text-gray-700">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
