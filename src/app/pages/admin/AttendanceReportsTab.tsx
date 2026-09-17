import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Ban, CheckCircle, FileText, Camera } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { formatCurrencyAmount } from '../../../lib/currency';
import {
  getReportReasonLabel,
  ATTENDANCE_STATE_LABEL,
  type AttendanceReportDecision,
} from '../../../lib/attendanceVerification';

type SubTab = 'open' | 'resolved';

const DECISION_LABEL: Record<AttendanceReportDecision, string> = {
  confirm_client_no_show: 'Confirm Client No-Show',
  confirm_freelancer_no_show: 'Confirm Freelancer No-Show',
  reject_report: 'Reject Report',
  mark_mutual_dispute: 'Mark as Mutual Dispute',
  resolve_without_penalty: 'Resolve Without Penalty',
};

export function AttendanceReportsTab() {
  const [subTab, setSubTab] = useState<SubTab>('open');
  const [openReports, setOpenReports] = useState<any[]>([]);
  const [resolvedReports, setResolvedReports] = useState<any[]>([]);
  const [confirmationsByBooking, setConfirmationsByBooking] = useState<Record<string, any[]>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const [openResponse, resolvedResponse] = await Promise.all([
      DataService.getAllAttendanceReportsForAdmin(),
      DataService.getResolvedAttendanceReportsForAdmin(),
    ]);
    if (openResponse.error || resolvedResponse.error) {
      setError((openResponse.error as any)?.message || (resolvedResponse.error as any)?.message || 'Unable to load attendance reports.');
      setIsLoading(false);
      return;
    }
    setOpenReports(openResponse.data);
    setResolvedReports(resolvedResponse.data);

    const allReports = [...openResponse.data, ...resolvedResponse.data];
    const confirmationEntries = await Promise.all(
      allReports.map(async (r: any) => {
        const res = await DataService.getBookingAttendanceConfirmations(r.booking_id);
        return [r.booking_id, res.data || []] as const;
      })
    );
    setConfirmationsByBooking(Object.fromEntries(confirmationEntries));

    const paths = allReports.flatMap((r: any) => (r.evidence_paths as string[]) || []);
    const urlEntries = await Promise.all(
      Array.from(new Set(paths)).map(async (path) => {
        const res = await DataService.getBookingEvidenceSignedUrl(path);
        return [path, res.url] as const;
      })
    );
    setSignedUrls(Object.fromEntries(urlEntries.filter(([, url]) => url)) as Record<string, string>);

    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // A report's `source` (see DataService.getAllAttendanceReportsForAdmin)
  // says which pair of RPCs applies to it: 'ticket' for reports now living
  // in support_tickets (the current, submit_attendance_ticket path), or
  // 'legacy' for ones still in attendance_reports (filed before that
  // migration) - same decision values either way, just a different id/RPC.
  const handleDecision = async (report: any, decision: AttendanceReportDecision) => {
    setPendingId(report.id);
    setError(null);
    const response =
      report.source === 'ticket'
        ? await DataService.adminResolveAttendanceTicket(report.id, decision, decisionReason.trim() || undefined)
        : await DataService.adminResolveAttendanceReport(report.id, decision, decisionReason.trim() || undefined);
    setPendingId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to resolve this report.');
      return;
    }
    setDecisionReason('');
    setExpandedId(null);
    await load();
  };

  const handleRequestEvidence = async (report: any) => {
    // The ticket-based RPC requires a note explaining what's being asked
    // for (the legacy one didn't) - reusing the same decision-reason box
    // for it rather than adding a second textarea just for this.
    if (report.source === 'ticket' && !decisionReason.trim()) {
      setError('Add a note above explaining what evidence you need before requesting it.');
      return;
    }
    setPendingId(report.id);
    setError(null);
    const response =
      report.source === 'ticket'
        ? await DataService.adminRequestTicketEvidence(report.id, decisionReason.trim())
        : await DataService.adminRequestAttendanceEvidence(report.id);
    setPendingId(null);
    if (response.error) {
      setError((response.error as any).message || 'Unable to request more evidence.');
      return;
    }
    setDecisionReason('');
    await load();
  };

  const subTabOptions: Array<{ id: SubTab; label: string; count: number }> = useMemo(
    () => [
      { id: 'open', label: 'Open / Under Review', count: openReports.length },
      { id: 'resolved', label: 'Resolved', count: resolvedReports.length },
    ],
    [openReports.length, resolvedReports.length]
  );

  const renderEvidence = (report: any) => {
    const paths: string[] = report.evidence_paths || [];
    if (!paths.length) return <p className="text-sm text-gray-500">No evidence submitted.</p>;
    return (
      <div className="grid grid-cols-4 gap-2">
        {paths.map((path) => (
          <div key={path} className="aspect-square overflow-hidden rounded-lg border border-sky-100 bg-sky-50/50">
            {signedUrls[path] && !path.toLowerCase().endsWith('.pdf') && !path.toLowerCase().endsWith('.heic') ? (
              <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                {path.toLowerCase().endsWith('.pdf') ? <FileText className="h-5 w-5 text-gray-400" /> : <Camera className="h-5 w-5 text-gray-400" />}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderReportCard = (report: any) => {
    const b = report.booking || {};
    const confirmations = confirmationsByBooking[report.booking_id] || [];
    const clientConfirmation = confirmations.find((c: any) => c.confirmer_role === 'client');
    const freelancerConfirmation = confirmations.find((c: any) => c.confirmer_role === 'freelancer');
    const isExpanded = expandedId === report.id;

    return (
      <div key={report.id} className="rounded-2xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)] overflow-hidden">
        <button
          onClick={() => setExpandedId(isExpanded ? null : report.id)}
          className="w-full flex flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-sky-50"
        >
          <div>
            <p className="font-bold text-gray-900">
              {b.project_name || 'Booking'} — {b.client?.full_name || 'Client'} vs {b.freelancer?.full_name || 'Freelancer'}
            </p>
            <p className="text-xs text-gray-500">
              Reported by {report.reporter_role === 'client' ? 'Client' : 'Freelancer'}: {getReportReasonLabel(report.reason)}
            </p>
          </div>
          {/* Ticket-sourced reports (source === 'ticket') use support_tickets'
              status enum (open/in_progress/resolved/closed), one more value
              than the legacy attendance_reports one (open/under_review/
              resolved) this badge was written for - 'closed' folds into the
              resolved styling/label, 'in_progress' into under_review's. */}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              report.status === 'resolved' || report.status === 'closed'
                ? 'bg-sky-50 text-gray-700'
                : report.status === 'under_review' || report.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {ATTENDANCE_STATE_LABEL[
              (report.status === 'open'
                ? 'disputed'
                : report.status === 'in_progress'
                  ? 'under_review'
                  : report.status === 'closed'
                    ? 'resolved'
                    : report.status) as keyof typeof ATTENDANCE_STATE_LABEL
            ]}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t border-sky-100 p-5 space-y-4">
            <div className="rounded-xl bg-sky-50/50 p-4 text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">Booking</p>
              <p>Deposit: {formatCurrencyAmount(Math.round(Number(b.budget || 0) * 0.3), 'THB')}</p>
              {b.start_date && <p>Scheduled: {b.start_date} {b.start_time ? String(b.start_time).slice(0, 5) : ''}</p>}
              {b.location_address && <p>Location: {b.location_address}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-sky-50/50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Client Confirmation</p>
                <p className="text-sm text-gray-700">
                  {clientConfirmation ? `✓ Confirmed at ${new Date(clientConfirmation.confirmed_at).toLocaleString()}` : 'Not confirmed'}
                </p>
              </div>
              <div className="rounded-xl bg-sky-50/50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Freelancer Confirmation</p>
                <p className="text-sm text-gray-700">
                  {freelancerConfirmation ? `✓ Confirmed at ${new Date(freelancerConfirmation.confirmed_at).toLocaleString()}` : 'Not confirmed'}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-sky-50/50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Report</p>
              <p className="text-sm text-gray-700 mb-2">{getReportReasonLabel(report.reason)}</p>
              {report.explanation && <p className="text-sm text-gray-600 mb-2">"{report.explanation}"</p>}
              {renderEvidence(report)}
            </div>

            {(report.status === 'resolved' || report.status === 'closed') && (
              <div className="rounded-xl bg-sky-50/50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Final Decision</p>
                <p className="text-sm text-gray-700">{DECISION_LABEL[report.admin_decision as AttendanceReportDecision] || report.admin_decision}</p>
                {report.admin_decision_reason && <p className="mt-1 text-sm text-gray-600">{report.admin_decision_reason}</p>}
              </div>
            )}

            {report.status !== 'resolved' && report.status !== 'closed' && (
              <div className="border-t border-sky-100 pt-4">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Decision reason (optional)</label>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Notes for this decision..."
                  className="mb-3 w-full min-h-[70px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={pendingId === report.id}
                    onClick={() => void handleDecision(report, 'confirm_client_no_show')}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Ban className="h-3.5 w-3.5" /> Confirm Client No-Show
                  </button>
                  <button
                    disabled={pendingId === report.id}
                    onClick={() => void handleDecision(report, 'confirm_freelancer_no_show')}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Ban className="h-3.5 w-3.5" /> Confirm Freelancer No-Show
                  </button>
                  <button
                    disabled={pendingId === report.id}
                    onClick={() => void handleDecision(report, 'reject_report')}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                  >
                    Reject Report
                  </button>
                  <button
                    disabled={pendingId === report.id}
                    onClick={() => void handleDecision(report, 'mark_mutual_dispute')}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                  >
                    Mark as Mutual Dispute
                  </button>
                  <button
                    disabled={pendingId === report.id}
                    onClick={() => void handleDecision(report, 'resolve_without_penalty')}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Resolve Without Penalty
                  </button>
                  {report.status === 'open' && (
                    <button
                      disabled={pendingId === report.id}
                      onClick={() => void handleRequestEvidence(report)}
                      className="flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                    >
                      <AlertCircle className="h-3.5 w-3.5" /> Request Additional Evidence
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const listForSubTab = subTab === 'open' ? openReports : resolvedReports;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {subTabOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setSubTab(option.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              subTab === option.id ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
            }`}
          >
            {option.label} ({option.count})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
        </div>
      ) : listForSubTab.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No attendance reports here.</p>
      ) : (
        <div className="space-y-3">{listForSubTab.map(renderReportCard)}</div>
      )}
    </div>
  );
}
