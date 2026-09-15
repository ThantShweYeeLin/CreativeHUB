import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, CheckCircle } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { formatCurrencyAmount } from '../../../lib/currency';
import { DisputeTimeline, DISPUTE_CATEGORY_LABEL } from '../bookingTracking/DisputeTimeline';
import { AttendanceTimeline } from '../bookingTracking/AttendanceTimeline';
import { PlatformRecordsPanel } from '../bookingTracking/PlatformRecordsPanel';
import type { AttendanceConfirmation, AttendanceReport } from '../../../lib/attendanceVerification';

// Loads a booking + its events/attendance/evidence-signed-urls once, shared
// by both the general booking detail route and the dispute detail route so
// there's exactly one fetch implementation. AdminBookingDetail itself stays
// presentational — it takes the results as props, it doesn't fetch them.
export function useAdminBookingDetail(bookingId: string | undefined) {
  const [booking, setBooking] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [disputeEvidence, setDisputeEvidence] = useState<any[]>([]);
  const [confirmations, setConfirmations] = useState<AttendanceConfirmation[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<AttendanceReport | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!bookingId) return;
    setIsLoading(true);
    setError(null);
    const bookingResponse = await DataService.getBooking(bookingId);
    if (bookingResponse.error || !bookingResponse.data) {
      setError((bookingResponse.error as any)?.message || 'Booking not found.');
      setIsLoading(false);
      return;
    }
    setBooking(bookingResponse.data);

    const [eventsResponse, disputeEvidenceResponse, confirmationsResponse, reportResponse] = await Promise.all([
      DataService.getBookingEvents(bookingId),
      DataService.getDisputeEvidence(bookingId),
      DataService.getBookingAttendanceConfirmations(bookingId),
      DataService.getBookingAttendanceReport(bookingId),
    ]);
    const bookingEvents = eventsResponse.data || [];
    const bookingDisputeEvidence = disputeEvidenceResponse.data || [];
    setEvents(bookingEvents);
    setDisputeEvidence(bookingDisputeEvidence);
    setConfirmations(confirmationsResponse.data || []);
    setAttendanceReport(reportResponse.data || null);

    const paths = [
      ...bookingEvents.flatMap((e: any) => (e.evidence_photos as string[]) || []),
      ...bookingDisputeEvidence.map((item: any) => item.storage_path).filter(Boolean),
    ];
    const entries = await Promise.all(
      Array.from(new Set(paths)).map(async (path) => {
        const res = await DataService.getBookingEvidenceSignedUrl(path as string);
        return [path, res.url] as const;
      })
    );
    setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)) as Record<string, string>);

    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  return { booking, events, disputeEvidence, confirmations, attendanceReport, signedUrls, isLoading, error, refresh };
}

const EVENT_LABEL: Record<string, string> = {
  deposit_paid: 'Deposit paid',
  completion_submitted: 'Completion submitted',
  confirmed: 'Client confirmed completion',
  complain: 'Problem reported',
  evidence: 'Responded with evidence',
  conceded: 'Conceded — no evidence provided',
  released: 'Deposit released to freelancer',
  refunded: 'Deposit refunded to client',
  annulled: 'Booking annulled (deposit deadline lapsed)',
  // Legacy actions from the retired GPS check-in system — kept so old
  // bookings' history still renders a readable label instead of a raw
  // action string.
  checked_in: 'Checked in',
  check_in_failed: 'Check-in attempt failed',
  location_set: 'Booking location set',
  presence_confirmed: "Confirmed the other party's presence",
  attendance_report_submitted: 'Reported an attendance problem',
  attendance_evidence_requested: 'Admin requested additional attendance evidence',
  attendance_report_resolved: 'Admin resolved the attendance report',
  reschedule_proposed: 'Reschedule proposed',
  reschedule_accepted: 'Reschedule accepted',
  reschedule_declined: 'Reschedule declined',
  reschedule_withdrawn: 'Reschedule proposal withdrawn',
  delivery_date_set: 'Estimated delivery set',
  delivery_date_updated: 'Estimated delivery updated',
  deliverables_marked_in_progress: 'Deliverables marked in progress',
  deliverables_delivered: 'Deliverables marked delivered',
};

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  not_applicable: 'No deliverables',
  pending: 'Pending',
  in_progress: 'In progress',
  delivered: 'Delivered',
};

// A signal for the admin, not a fault determination — matches the same
// definition src/lib/dataService.ts's getAdminDashboardStats/getAdminBookings
// use for the dashboard count and the bookings list filter.
function isDeliveryOverdue(booking: any) {
  return (
    Boolean(booking.estimated_delivery_at) &&
    (booking.delivery_status === 'pending' || booking.delivery_status === 'in_progress') &&
    new Date(booking.estimated_delivery_at).getTime() < Date.now()
  );
}

function daysOverdue(estimatedDeliveryAt: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(estimatedDeliveryAt).getTime()) / (24 * 60 * 60 * 1000)));
}

function actorLabel(actor: string) {
  return actor === 'client' ? 'Client' : actor === 'freelancer' ? 'Freelancer' : actor === 'admin' ? 'Admin' : 'System';
}

function BookingEventsTimeline({ events }: { events: any[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No events recorded yet.</p>;
  }
  return (
    <div className="space-y-3 border-l-2 border-gray-200 pl-4">
      {events.map((event) => (
        <div key={event.id} className="relative">
          <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
          <p className="text-xs text-gray-500">{actorLabel(event.actor)} · {new Date(event.created_at).toLocaleString()}</p>
          <p className="text-sm font-semibold text-gray-900">{EVENT_LABEL[event.action] || event.action}</p>
          {event.reason && <p className="mt-0.5 text-sm text-gray-600">"{event.reason}"</p>}
        </div>
      ))}
    </div>
  );
}

export function AdminBookingDetail({
  booking,
  events,
  disputeEvidence = [],
  confirmations,
  attendanceReport,
  signedUrls,
  showResolutionControls,
  onResolved,
}: {
  booking: any;
  events: any[];
  disputeEvidence?: any[];
  confirmations: AttendanceConfirmation[];
  attendanceReport: AttendanceReport | null;
  signedUrls: Record<string, string>;
  showResolutionControls: boolean;
  onResolved: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [decisionReason, setDecisionReason] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const deposit = booking.deposit_amount != null ? Number(booking.deposit_amount) : Math.round(Number(booking.budget || 0) * 0.3);
  const clientClaim = events.find((e) => e.actor === 'client' && e.action === 'complain');
  const freelancerResponse = [...events].reverse().find((e) => e.actor === 'freelancer' && e.action === 'evidence');
  const hasDispute = booking.dispute_status && booking.dispute_status !== 'none';
  const canDecide = showResolutionControls && booking.dispute_status === 'under_admin_review';
  const agreement = booking.confirmed_agreement || null;

  const handleDecision = async (decision: 'refund' | 'release') => {
    setIsPending(true);
    setActionError(null);
    const response = await DataService.adminResolveDispute(booking.id, decision, decisionReason.trim() || undefined);
    setIsPending(false);
    if (response.error) {
      setActionError((response.error as any).message || 'Unable to resolve dispute.');
      return;
    }
    setDecisionReason('');
    await onResolved();
  };

  return (
    <div className="space-y-6">
      {/* Booking header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{booking.project_name}</h2>
            <p className="text-xs text-gray-500">#{String(booking.id).slice(0, 8).toUpperCase()} · Created {new Date(booking.created_at).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{booking.status}</span>
            {hasDispute && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 capitalize">{booking.dispute_status.replace('_', ' ')}</span>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
          <button onClick={() => navigate(`/admin/users/${booking.client_id}`)} className="rounded-xl bg-gray-50 p-3 text-left hover:bg-gray-100">
            <p className="text-xs font-semibold uppercase text-gray-500">Client</p>
            <p className="mt-1 font-semibold text-gray-900">{booking.client?.full_name || 'Client'}</p>
          </button>
          <button onClick={() => navigate(`/admin/users/${booking.freelancer_id}`)} className="rounded-xl bg-gray-50 p-3 text-left hover:bg-gray-100">
            <p className="text-xs font-semibold uppercase text-gray-500">Freelancer</p>
            <p className="mt-1 font-semibold text-gray-900">{booking.freelancer?.full_name || 'Freelancer'}</p>
          </button>
        </div>
      </div>

      {/* Locked agreement — the immutable snapshot taken the moment this
          booking was confirmed (supabase/booking_agreement_lock.sql). This
          is what to check a claim against, not the "Current booking
          details" panel below, which reflects live values that may have
          since been edited or rescheduled. */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-lg font-bold text-gray-900">Locked Agreement</h3>
        {agreement ? (
          <>
            <p className="mb-3 text-xs text-gray-500">
              Snapshot taken at booking confirmation{agreement.locked_at ? ` (${new Date(agreement.locked_at).toLocaleString()})` : ''} — never edited afterward.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Service</p>
                <p className="mt-1 text-gray-900">{agreement.service || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Price / Deposit</p>
                <p className="mt-1 text-gray-900">
                  {agreement.price != null ? formatCurrencyAmount(Number(agreement.price), 'THB') : '—'}
                  {agreement.deposit_amount != null ? ` (deposit ${formatCurrencyAmount(Number(agreement.deposit_amount), 'THB')})` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Scheduled time</p>
                <p className="mt-1 text-gray-900">{agreement.scheduled_start_at ? new Date(agreement.scheduled_start_at).toLocaleString() : '—'}</p>
              </div>
              {agreement.deliverables && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Deliverables</p>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{agreement.deliverables}</p>
                </div>
              )}
              {agreement.description && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{agreement.description}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            No locked agreement recorded — this booking was confirmed before the Booking Agreement Lock existed. Use the current booking details below instead.
          </p>
        )}
      </div>

      {/* Current booking details — live, mutable fields, which may have
          changed since the agreement above was locked in. */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">Current Booking Details</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Schedule</p>
            <p className="mt-1 text-gray-900">
              {booking.start_date ? new Date(`${booking.start_date}T00:00:00`).toLocaleDateString() : '—'}
              {booking.start_time ? ` · ${booking.start_time.slice(0, 5)}` : ''}
              {booking.end_time ? ` – ${booking.end_time.slice(0, 5)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Location</p>
            <p className="mt-1 text-gray-900">{booking.location_address || '—'}</p>
          </div>
          {booking.deliverables && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-gray-500">Deliverables</p>
              <p className="mt-1 whitespace-pre-wrap text-gray-700">{booking.deliverables}</p>
            </div>
          )}
          {booking.description && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-gray-700">{booking.description}</p>
            </div>
          )}
          {booking.delivery_status && (
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Estimated result delivery</p>
              <p className="mt-1 text-gray-900">
                {DELIVERY_STATUS_LABEL[booking.delivery_status] || booking.delivery_status}
                {booking.estimated_delivery_at && booking.delivery_status !== 'not_applicable'
                  ? ` — ${new Date(booking.estimated_delivery_at).toLocaleDateString()}`
                  : ''}
              </p>
              {isDeliveryOverdue(booking) && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  ⚠ Overdue by {daysOverdue(booking.estimated_delivery_at)} day{daysOverdue(booking.estimated_delivery_at) === 1 ? '' : 's'}
                </p>
              )}
              {booking.delivery_notes && <p className="mt-0.5 text-sm text-gray-600">{booking.delivery_notes}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Financial summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">Financial summary</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Total booking value</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrencyAmount(Number(booking.budget || 0), 'THB')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">CreativeHUB protected deposit</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrencyAmount(deposit, 'THB')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Deposit status</p>
            <p className="mt-1 capitalize text-gray-900">{booking.payment_status || 'unpaid'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          CreativeHUB only holds the protected deposit shown above — the remaining balance is settled directly between the client and freelancer and is not held by the platform.
        </p>
      </div>

      {/* Attendance */}
      <AttendanceTimeline
        events={events}
        confirmations={confirmations}
        report={attendanceReport}
        scheduledAt={booking.start_at ? new Date(booking.start_at) : null}
      />

      {/* Booking timeline */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">Booking timeline</h3>
        <BookingEventsTimeline events={events} />
      </div>

      {/* Dispute info */}
      {hasDispute && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-gray-900">Dispute</h3>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Client's report</p>
              {clientClaim ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">{DISPUTE_CATEGORY_LABEL[clientClaim.category] || clientClaim.category}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{clientClaim.reason}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No report recorded.</p>
              )}
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Freelancer's response</p>
              {freelancerResponse ? (
                <p className="text-sm text-gray-700">{freelancerResponse.evidence_text || '(no written response)'}</p>
              ) : (
                <p className="text-sm text-gray-500">No response submitted.</p>
              )}
            </div>
          </div>

          {clientClaim?.category && (
            <PlatformRecordsPanel category={clientClaim.category} booking={booking} events={events} confirmations={confirmations} viewerRole="neutral" />
          )}

          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Dispute timeline &amp; evidence</p>
          <DisputeTimeline events={events} signedUrls={signedUrls} disputeEvidence={disputeEvidence} />

          {canDecide && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Resolution reason</label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Why are you making this decision?"
                className="mb-3 w-full min-h-[70px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />
              {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isPending}
                  onClick={() => void handleDecision('refund')}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <Ban className="h-4 w-4" /> Refund Deposit to Client
                </button>
                <button
                  disabled={isPending}
                  onClick={() => void handleDecision('release')}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" /> Release Deposit to Freelancer
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">This action will be recorded in the administrative audit log.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
