import { Camera } from 'lucide-react';

export const DISPUTE_CATEGORY_LABEL: Record<string, string> = {
  no_show: 'Freelancer did not show up',
  not_performed: 'Freelancer did not perform the service',
  differed_from_agreement: 'Service significantly differed from agreement',
  // Legacy value from before categories were split into the two above -
  // kept so older dispute events still render a readable label.
  not_as_agreed: 'Service was not as agreed',
  other: 'Other',
};

interface DisputeTimelineProps {
  events: any[];
  signedUrls: Record<string, string>;
}

export function DisputeTimeline({ events, signedUrls }: DisputeTimelineProps) {
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
      {disputeEvents.map((event) => (
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
          {event.reason && <p className="mt-1 text-sm text-gray-600">"{event.reason}"</p>}
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
        </div>
      ))}
    </div>
  );
}
