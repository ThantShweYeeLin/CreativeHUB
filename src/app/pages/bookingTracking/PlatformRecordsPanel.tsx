import type { DisputeFlowCategory } from '../../../lib/disputeCategories';

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : null);

interface PlatformRecordsPanelProps {
  category: DisputeFlowCategory | string;
  booking: any;
  events: any[];
  confirmations: any[];
  // The client's own flow phrases check-in/cancellation rows in the second
  // person ("Your check-in"); the admin review page needs the same data
  // phrased neutrally ("Client's check-in") since the admin isn't a
  // participant. Same underlying computation either way.
  viewerRole?: 'client' | 'neutral';
}

// Step 3 of the dispute flow: platform records auto-collected and shown as
// read-only context, never something the reporting party fills in
// themselves. Reused as-is on the admin review page (Phase 5) so the admin
// sees exactly the same auto-checks the client saw when reporting, per
// category — see the evidence matrix in the original feature spec.
export function PlatformRecordsPanel({ category, booking, events, confirmations, viewerRole = 'client' }: PlatformRecordsPanelProps) {
  const agreement = booking?.confirmed_agreement || null;
  const clientCheckIn = confirmations.find((c) => c.confirmer_role === 'client')?.confirmed_at || null;
  const freelancerCheckIn = confirmations.find((c) => c.confirmer_role === 'freelancer')?.confirmed_at || null;
  const scheduledAt = booking?.start_at || null;
  const clientCheckInLabel = viewerRole === 'client' ? 'Your check-in' : "Client's check-in";

  const row = (label: string, value: string | null) => (
    <div key={label} className="flex justify-between gap-3 py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-right text-xs font-semibold text-gray-900">{value ?? 'Not recorded'}</span>
    </div>
  );

  let rows: JSX.Element[] = [];

  if (category === 'no_show' || category === 'late_arrival') {
    rows = [
      row('Scheduled time', formatDateTime(scheduledAt)),
      row('Location', booking?.location_address || 'Not set'),
      row(clientCheckInLabel, formatDateTime(clientCheckIn) || 'Not checked in'),
      row("Freelancer's check-in", formatDateTime(freelancerCheckIn) || 'Not checked in'),
      row('Cancellation status', booking?.status === 'cancelled' ? `Cancelled ${formatDateTime(booking.cancelled_at) || ''}` : 'Not cancelled'),
    ];
  } else if (category === 'not_performed') {
    const completedEvent = events.find((e) => e.action === 'completion_submitted');
    rows = [
      row('Booking status', booking?.status || null),
      row(clientCheckInLabel, formatDateTime(clientCheckIn) || 'Not checked in'),
      row("Freelancer's check-in", formatDateTime(freelancerCheckIn) || 'Not checked in'),
      row('Marked complete', completedEvent ? formatDateTime(completedEvent.created_at) : 'Not marked complete'),
      row('Agreed service', agreement?.service || booking?.project_name || null),
    ];
  } else if (category === 'deliverables_not_received') {
    rows = [
      row('Estimated delivery date', formatDateTime(booking?.estimated_delivery_at) || 'Not set'),
      row('Delivery status', booking?.delivery_status || 'Not set'),
      row('Delivery notes', booking?.delivery_notes || '—'),
      row('Agreed deliverables', agreement?.deliverables || 'Not recorded in the agreement'),
    ];
  } else if (category === 'additional_payment_requested') {
    rows = [
      row('Agreed price', agreement?.price != null ? `${Number(agreement.price).toLocaleString()} THB` : `${Number(booking?.budget || 0).toLocaleString()} THB`),
      row('Agreed deposit', agreement?.deposit_amount != null ? `${Number(agreement.deposit_amount).toLocaleString()} THB` : null),
      row('Current payment status', booking?.payment_status || null),
    ];
  } else if (category === 'unauthorized_change') {
    const changeEvents = events.filter((e) => e.action === 'agreement_amended');
    rows = [
      row('Originally agreed service', agreement?.service || null),
      row('Originally agreed price', agreement?.price != null ? `${Number(agreement.price).toLocaleString()} THB` : null),
      row('Current price', `${Number(booking?.budget || 0).toLocaleString()} THB`),
      row('Logged changes', changeEvents.length > 0 ? `${changeEvents.length} change(s) recorded` : 'No changes logged on this booking'),
    ];
  } else if (category === 'unexpected_cancellation') {
    const cancelledByLabel =
      booking?.cancelled_by && booking.cancelled_by === booking?.client_id
        ? viewerRole === 'client'
          ? 'You'
          : 'Client'
        : booking?.cancelled_by && booking.cancelled_by === booking?.freelancer_id
        ? 'Freelancer'
        : null;
    rows = [
      row('Booking status', booking?.status || null),
      row('Cancelled by', cancelledByLabel),
      row('Cancelled at', formatDateTime(booking?.cancelled_at)),
      row('Reason given', booking?.cancellation_reason || null),
      row('Payment status', booking?.payment_status || null),
    ];
  } else {
    rows = [
      row('Agreed service', agreement?.service || booking?.project_name || null),
      row('Booking status', booking?.status || null),
      row('Payment status', booking?.payment_status || null),
    ];
  }

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Platform records</p>
      <div className="divide-y divide-gray-100">{rows}</div>
    </div>
  );
}
