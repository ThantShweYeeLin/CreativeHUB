import { useState } from 'react';
import { CheckCircle2, Package, X } from 'lucide-react';
import { DataService } from '../../../lib/dataService';

type Role = 'client' | 'freelancer';
type DeliveryStatus = 'not_applicable' | 'pending' | 'in_progress' | 'delivered' | null;

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Noon Bangkok avoids the date rolling over a day when re-displayed in a
// different timezone — this is only ever an estimate, not a precise
// instant, so this is deliberately loose.
function dateStringToTimestamp(dateStr: string) {
  return new Date(`${dateStr}T12:00:00+07:00`).toISOString();
}

function formatDeliveryDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Some services never have a post-appointment result (makeup, hair); some
// always do (photo/video editing, final design files); some depend on
// what was agreed (a model booking with or without usage deliverables).
// So this only ever appears once the freelancer has actually said which
// applies — never presumed either way from the booking's status alone.
export function DeliveryCard({
  booking,
  role,
  onRefresh,
  canReportDeliveryIssue = false,
  onReportDeliveryIssue,
}: {
  booking: any;
  role: Role;
  onRefresh: () => void | Promise<void>;
  /** Client only — whether the existing dispute form is actually reachable right now (right escrow state, no dispute already open). */
  canReportDeliveryIssue?: boolean;
  /** Client only — opens the existing "Report a Problem" form pre-selected to 'deliverables_not_received'. Never files a dispute automatically. */
  onReportDeliveryIssue?: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateDateDraft, setUpdateDateDraft] = useState('');
  const [updateReasonDraft, setUpdateReasonDraft] = useState('');
  const [acknowledgedReceived, setAcknowledgedReceived] = useState(false);

  const status: DeliveryStatus = booking.delivery_status ?? null;
  const isPastEstimate = booking.estimated_delivery_at && new Date(booking.estimated_delivery_at).getTime() < Date.now();

  const handleDecideYes = async () => {
    if (!dateDraft) {
      setError('Choose an estimated delivery date.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await DataService.setBookingDeliveryPlan(booking.id, {
      hasDeliverables: true,
      estimatedDeliveryAt: dateStringToTimestamp(dateDraft),
      deliveryNotes: notesDraft.trim() || undefined,
    });
    setIsSubmitting(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to save the delivery estimate.');
      return;
    }
    setShowEstimateForm(false);
    await onRefresh();
  };

  const handleDecideNo = async () => {
    setIsSubmitting(true);
    setError(null);
    const response = await DataService.setBookingDeliveryPlan(booking.id, { hasDeliverables: false });
    setIsSubmitting(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to save.');
      return;
    }
    await onRefresh();
  };

  const handleUpdateEstimate = async () => {
    if (!updateDateDraft) return;
    setIsSubmitting(true);
    setError(null);
    const response = await DataService.updateBookingDeliveryEstimate(booking.id, {
      estimatedDeliveryAt: dateStringToTimestamp(updateDateDraft),
      reason: updateReasonDraft.trim() || undefined,
    });
    setIsSubmitting(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update the estimate.');
      return;
    }
    setShowUpdateForm(false);
    setUpdateDateDraft('');
    setUpdateReasonDraft('');
    await onRefresh();
  };

  const handleMarkStatus = async (next: 'in_progress' | 'delivered') => {
    setIsSubmitting(true);
    setError(null);
    const response = await DataService.updateBookingDeliveryStatus(booking.id, next);
    setIsSubmitting(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update status.');
      return;
    }
    await onRefresh();
  };

  // Client view never presumes a delivery story before the freelancer has
  // declared one, and says nothing at all for a service that never has one.
  if (role === 'client') {
    if (!status || status === 'not_applicable') return null;

    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-900" />
          <h2 className="font-bold text-gray-900">Result Delivery</h2>
        </div>
        {status === 'delivered' ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
              <p className="font-bold text-green-900">Results Delivered</p>
            </div>
            {booking.estimated_delivery_at && (
              <p className="text-sm text-green-800">Estimated delivery was {formatDeliveryDate(booking.estimated_delivery_at)}.</p>
            )}
            {booking.delivery_notes && <p className="mt-1 text-sm text-green-800">{booking.delivery_notes}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {status === 'in_progress' ? 'Results being prepared' : 'Results pending'}
            </p>
            {booking.estimated_delivery_at && (
              <p className="mt-1 text-sm text-gray-700">Estimated delivery: {formatDeliveryDate(booking.estimated_delivery_at)}</p>
            )}
            {booking.delivery_notes && <p className="mt-1 text-sm text-gray-600">{booking.delivery_notes}</p>}
            {isPastEstimate && !acknowledgedReceived && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Your estimated delivery date has passed. Have you received your results?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setAcknowledgedReceived(true)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Yes, I received them
                  </button>
                  {canReportDeliveryIssue && onReportDeliveryIssue ? (
                    <button
                      onClick={onReportDeliveryIssue}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                    >
                      No, report a delivery issue
                    </button>
                  ) : (
                    <p className="text-xs text-amber-700">If not, you can report a delivery issue from this page.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Freelancer view.
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Package className="w-5 h-5 text-gray-900" />
        <h2 className="font-bold text-gray-900">Result Delivery</h2>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!status ? (
        !showEstimateForm ? (
          <div>
            <p className="mb-3 text-sm text-gray-700">
              Does this booking include deliverables prepared after the appointment (e.g. edited photos, video, or files)?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowEstimateForm(true)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Yes, deliverables included
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => void handleDecideNo()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                No further items
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Estimated result delivery</p>
              <button onClick={() => setShowEstimateForm(false)} className="text-gray-400 hover:text-gray-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="date"
              min={todayDateString()}
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Delivery notes (optional) — e.g. how results will be delivered"
              className="mb-3 w-full min-h-[60px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="mb-3 text-xs text-gray-500">This is an estimate, not a guarantee — you can update it later if plans change.</p>
            <button
              disabled={isSubmitting || !dateDraft}
              onClick={() => void handleDecideYes()}
              className="w-full rounded-xl bg-gray-900 py-2.5 px-4 text-sm font-bold text-white hover:bg-black transition-all disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save estimate'}
            </button>
          </div>
        )
      ) : status === 'not_applicable' ? (
        <p className="text-sm text-gray-500">No deliverables after this booking.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">
            {status === 'delivered' ? 'Delivered' : status === 'in_progress' ? 'In progress' : 'Pending'}
          </p>
          {booking.estimated_delivery_at && (
            <p className="mt-1 text-sm text-gray-700">Estimated delivery: {formatDeliveryDate(booking.estimated_delivery_at)}</p>
          )}
          {booking.delivery_notes && <p className="mt-1 text-sm text-gray-600">{booking.delivery_notes}</p>}

          {status !== 'delivered' && !showUpdateForm && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
              <button
                onClick={() => {
                  setUpdateDateDraft(booking.estimated_delivery_at ? booking.estimated_delivery_at.slice(0, 10) : '');
                  setShowUpdateForm(true);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Update estimate
              </button>
              {status === 'pending' && (
                <button
                  disabled={isSubmitting}
                  onClick={() => void handleMarkStatus('in_progress')}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  Mark in progress
                </button>
              )}
              <button
                disabled={isSubmitting}
                onClick={() => void handleMarkStatus('delivered')}
                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                Mark delivered
              </button>
            </div>
          )}

          {status !== 'delivered' && showUpdateForm && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <input
                type="date"
                min={todayDateString()}
                value={updateDateDraft}
                onChange={(e) => setUpdateDateDraft(e.target.value)}
                className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />
              <input
                value={updateReasonDraft}
                onChange={(e) => setUpdateReasonDraft(e.target.value)}
                placeholder="Reason for the change (optional)"
                className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="flex gap-2">
                <button
                  disabled={isSubmitting || !updateDateDraft}
                  onClick={() => void handleUpdateEstimate()}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  Save
                </button>
                <button onClick={() => setShowUpdateForm(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function isDeliveryCardEligible(escrowState: string) {
  return escrowState !== 'awaiting_deposit' && escrowState !== 'annulled';
}
