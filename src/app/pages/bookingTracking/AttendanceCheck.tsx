import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import {
  getAttendanceState,
  getAttendanceWindow,
  type AttendanceConfirmation,
  type AttendanceReport,
} from '../../../lib/attendanceVerification';

type Role = 'client' | 'freelancer';

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function AttendanceCheck({
  bookingId,
  scheduledAt,
  role,
  confirmations,
  report,
  onRefresh,
  onReportProblem,
}: {
  bookingId: string;
  scheduledAt: Date | null;
  role: Role;
  confirmations: AttendanceConfirmation[];
  report: AttendanceReport | null;
  onRefresh: () => Promise<void>;
  /** No-shows/lateness/conduct issues are booking disputes, not support
   * tickets — this opens the parent page's own Report a Problem flow
   * (ReportProblemFlow) rather than creating anything itself. Previously
   * this button ("Create a Ticket") created a support_tickets row via
   * submit_attendance_ticket, a second, disconnected reporting path
   * alongside the real dispute system for the exact same scenarios. */
  onReportProblem: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Opportunistic, cron-free notification that the window has opened —
  // safe no-op if already notified or not yet open.
  useEffect(() => {
    void DataService.reconcileAttendanceWindow(bookingId);
  }, [bookingId]);

  const clientConfirmation = confirmations.find((c) => c.confirmer_role === 'client') || null;
  const freelancerConfirmation = confirmations.find((c) => c.confirmer_role === 'freelancer') || null;
  const selfConfirmation = role === 'client' ? clientConfirmation : freelancerConfirmation;
  const otherConfirmation = role === 'client' ? freelancerConfirmation : clientConfirmation;
  const otherRoleLabel = role === 'client' ? 'Freelancer' : 'Client';

  const state = getAttendanceState({ scheduledAt, clientConfirmation, freelancerConfirmation, report });
  const window_ = getAttendanceWindow(scheduledAt);

  const handleConfirm = async () => {
    setIsConfirming(true);
    setConfirmError(null);
    const { error } = await DataService.confirmAttendance(bookingId);
    setIsConfirming(false);
    if (error) {
      setConfirmError((error as any)?.message || 'Unable to confirm attendance. Please try again.');
      return;
    }
    await onRefresh();
  };

  if (state === 'disputed' || state === 'under_review' || state === 'resolved') {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h2 className="font-bold text-gray-900">Attendance Check</h2>
        </div>
        <p className="text-sm text-gray-600">
          {state === 'resolved'
            ? 'An attendance report for this booking has been reviewed and resolved by CreativeHUB support.'
            : 'An attendance report has been submitted for this booking and is being handled by CreativeHUB support.'}
        </p>
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <div className="bg-white rounded-2xl shadow-lg border-2 border-green-500 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h2 className="font-bold text-gray-900">Attendance Verified</h2>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          <p>Client confirmed Freelancer ✓</p>
          <p>Freelancer confirmed Client ✓</p>
        </div>
        <p className="mt-3 text-xs text-gray-500">Both parties have confirmed their presence.</p>
      </div>
    );
  }

  if (state === 'upcoming') {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-gray-900" />
          <h2 className="font-bold text-gray-900">Attendance Check</h2>
        </div>
        {window_ && (
          <p className="text-xs text-gray-500 mb-2">
            Scheduled: {formatTime(scheduledAt!)} · Available: {formatTime(window_.opensAt)} – {formatTime(window_.closesAt)}
          </p>
        )}
        <p className="text-sm text-gray-600">Attendance verification will be available 30 minutes before the booking.</p>
      </div>
    );
  }

  // partially_verified (window closed, not fully confirmed) — show the
  // final recorded state without offering further actions.
  if (state === 'partially_verified' && (!window_ || Date.now() > window_.closesAt.getTime())) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-gray-900" />
          <h2 className="font-bold text-gray-900">Attendance Check</h2>
        </div>
        <p className="text-sm text-gray-600 mb-2">The attendance verification window has closed.</p>
        <div className="space-y-1 text-sm">
          <p className={clientConfirmation ? 'text-green-700' : 'text-gray-400'}>
            Client {clientConfirmation ? 'confirmed the freelancer ✓' : '— no confirmation recorded'}
          </p>
          <p className={freelancerConfirmation ? 'text-green-700' : 'text-gray-400'}>
            Freelancer {freelancerConfirmation ? 'confirmed the client ✓' : '— no confirmation recorded'}
          </p>
        </div>
      </div>
    );
  }

  // check_available / waiting_client / waiting_freelancer / partially_verified (window still open)
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border-2 border-sky-400 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-gray-900" />
        <h2 className="font-bold text-gray-900">Attendance Check</h2>
      </div>

      {selfConfirmation ? (
        <p className="text-sm text-gray-700 mb-3">
          ✓ You confirmed the {otherRoleLabel.toLowerCase()}'s presence at {formatTime(new Date(selfConfirmation.confirmed_at))}.
        </p>
      ) : (
        <>
          <p className="font-semibold text-gray-900 mb-3">Is your {otherRoleLabel} present?</p>
          {confirmError && <p className="mb-3 text-sm text-red-600">{confirmError}</p>}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => void handleConfirm()}
              disabled={isConfirming}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 px-4 text-sm font-bold text-white hover:shadow-lg transition-all disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isConfirming ? 'Confirming...' : `Confirm ${otherRoleLabel} Presence`}
            </button>
            <button
              onClick={onReportProblem}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-50 py-3 px-4 text-sm font-semibold text-gray-700 hover:bg-sky-100 transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              Report a Problem
            </button>
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl bg-sky-50/50 px-4 py-3">
        <span className="text-sm text-gray-600">{otherRoleLabel}</span>
        <span className={`text-sm font-semibold ${otherConfirmation ? 'text-green-700' : 'text-gray-400'}`}>
          {otherConfirmation ? `✓ Confirmed you` : 'Waiting to confirm you'}
        </span>
      </div>

      {selfConfirmation && (
        <button
          onClick={onReportProblem}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-50 py-2.5 px-4 text-xs font-semibold text-gray-600 hover:bg-sky-100 transition-all"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Report a Problem
        </button>
      )}
    </div>
  );
}
