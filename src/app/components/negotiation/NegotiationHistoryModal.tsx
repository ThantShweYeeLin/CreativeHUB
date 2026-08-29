import { useEffect, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { formatCurrencyAmount } from '../../../lib/currency';
import { extractScheduleMeta, formatScheduleMeta } from '../../../lib/requestSchedule';

interface NegotiationHistoryModalProps {
  request: any;
  onClose: () => void;
  canAccept: boolean;
  canReject: boolean;
  canCounter: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCounter: () => void;
  onMessage: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  request: 'Requested',
  counter: 'Counter Offer',
  accept: 'Accepted Offer',
  reject: 'Rejected Offer',
};

export function NegotiationHistoryModal({
  request,
  onClose,
  canAccept,
  canReject,
  canCounter,
  onAccept,
  onReject,
  onCounter,
  onMessage,
}: NegotiationHistoryModalProps) {
  const [offers, setOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      const response = await DataService.getRequestOffers(request.id);
      if (isMounted) {
        setOffers(response.data || []);
        setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [request.id]);

  const hasCounter = request.status === 'countered' || request.status === 'accepted';
  const currentPrice = hasCounter && request.counter_price != null ? Number(request.counter_price) : Number(request.budget || 0);
  const includesList = (request.includes || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);
  const originalSchedule = extractScheduleMeta(request.message, request.description);
  const currentSchedule = hasCounter && request.counter_date ? { date: request.counter_date, time: (request.counter_time || '00:00').slice(0, 5) } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between rounded-t-3xl border-b border-gray-200 bg-white px-4 py-4 md:px-8 md:py-6">
          <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Counter Offer Details</h2>
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-6 p-4 md:p-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Original Request</th>
                  <th className="px-4 py-3">
                    Current Offer
                    {request.counter_by && (
                      <span className="ml-1 font-normal normal-case text-gray-400">
                        ({request.counter_by === 'freelancer' ? "freelancer's" : "client's"})
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-700">Service</td>
                  <td className="px-4 py-3 text-gray-900" colSpan={2}>{request.project_name}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-700">Date & Time</td>
                  <td className="px-4 py-3 text-gray-900">{originalSchedule ? formatScheduleMeta(originalSchedule) : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {currentSchedule ? formatScheduleMeta(currentSchedule) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-700">Price</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrencyAmount(Number(request.budget || 0), 'THB')}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {hasCounter ? formatCurrencyAmount(currentPrice, 'THB') : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-700">Deliverables</td>
                  <td className="px-4 py-3 text-gray-500">Not specified</td>
                  <td className="px-4 py-3 text-gray-900">
                    {includesList.length > 0 ? (
                      <ul className="space-y-0.5">
                        {includesList.map((item: string, index: number) => (
                          <li key={index}>✓ {item}</li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {request.counter_message && (
            <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Message</p>
              "{request.counter_message}"
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Negotiation History</h3>
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : offers.length === 0 ? (
              <p className="text-sm text-gray-500">No history yet.</p>
            ) : (
              <div className="space-y-3 border-l-2 border-gray-200 pl-4">
                {offers.map((offer) => (
                  <div key={offer.id} className={`relative ${offer.action === 'accept' ? 'rounded-xl bg-green-50 p-3' : ''}`}>
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
                    <p className="text-xs text-gray-500">
                      Round {offer.round} — {new Date(offer.created_at).toLocaleDateString()} · {offer.offered_by === 'client' ? 'Client' : 'Freelancer'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {ACTION_LABEL[offer.action] || offer.action}
                      {offer.price != null && ` — ${formatCurrencyAmount(Number(offer.price), 'THB')}`}
                      {offer.date && ` · ${formatScheduleMeta({ date: offer.date, time: (offer.time || '00:00').slice(0, 5) })}`}
                    </p>
                    {offer.message && <p className="mt-1 text-sm text-gray-600">"{offer.message}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-200 bg-white px-4 py-4 md:px-8">
          {canAccept && (
            <button
              onClick={onAccept}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Check className="h-4 w-4" /> Accept
            </button>
          )}
          {canCounter && (
            <button onClick={onCounter} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
              Counter Offer
            </button>
          )}
          {canReject && (
            <button onClick={onReject} className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200">
              <X className="h-4 w-4" /> Reject
            </button>
          )}
          <button onClick={onMessage} className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <MessageCircle className="h-4 w-4" /> Message
          </button>
        </div>
      </div>
    </div>
  );
}
