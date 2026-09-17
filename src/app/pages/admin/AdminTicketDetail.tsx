import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DataService } from '../../../lib/dataService';
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_COLOR, TICKET_STATUS_LABEL, type TicketCategory, type TicketStatus } from '../../../lib/supportTickets';

const EVENT_LABEL: Record<string, string> = {
  created: 'Ticket created',
  evidence_requested: 'Admin requested more evidence',
  evidence_submitted: 'User submitted more evidence',
  status_changed: 'Status updated',
};

export function AdminTicketDetail({ ticketId }: { ticketId: string }) {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const [ticketResponse, eventsResponse] = await Promise.all([
      DataService.getSupportTicket(ticketId),
      DataService.getSupportTicketEvents(ticketId),
    ]);

    if (ticketResponse.error || !ticketResponse.data) {
      setError((ticketResponse.error as any)?.message || 'Ticket not found.');
      setIsLoading(false);
      return;
    }

    setTicket(ticketResponse.data);
    setEvents(eventsResponse.data);

    const allPaths = [
      ...(ticketResponse.data.screenshot_path ? [ticketResponse.data.screenshot_path] : []),
      ...eventsResponse.data.flatMap((e: any) => e.evidence_paths || []),
    ];
    const entries = await Promise.all(
      allPaths.map(async (path: string) => {
        const res = await DataService.getReportEvidenceSignedUrl(path);
        return [path, res.url] as const;
      })
    );
    setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)) as Record<string, string>);
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleStatusChange = async (status: TicketStatus) => {
    setPendingAction(true);
    setError(null);
    const response = await DataService.adminUpdateTicketStatus(ticketId, status);
    setPendingAction(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update ticket.');
      return;
    }
    await load();
  };

  const handleRequestEvidence = async () => {
    if (!evidenceNote.trim()) return;
    setPendingAction(true);
    setError(null);
    const response = await DataService.adminRequestTicketEvidence(ticketId, evidenceNote.trim());
    setPendingAction(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to request evidence.');
      return;
    }
    setEvidenceNote('');
    setShowEvidenceForm(false);
    await load();
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error || !ticket) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Ticket not found.'}</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-gray-900">
            #{ticket.id.slice(0, 8).toUpperCase()} — {TICKET_CATEGORY_LABEL[ticket.category as TicketCategory] || ticket.category}
          </p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TICKET_STATUS_COLOR[ticket.status as TicketStatus] || ''}`}>
            {TICKET_STATUS_LABEL[ticket.status as TicketStatus] || ticket.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{ticket.user?.full_name || 'A user'} · {ticket.user?.email} · {new Date(ticket.created_at).toLocaleString()}</p>
        <p className="text-sm text-gray-700">{ticket.description}</p>
        {ticket.screenshot_path && signedUrls[ticket.screenshot_path] && (
          <img
            src={signedUrls[ticket.screenshot_path]}
            alt="Attached screenshot"
            className="mt-3 max-h-64 rounded-lg border border-sky-100 object-contain"
          />
        )}
        {ticket.related_booking_id && (
          <button
            onClick={() => navigate(`/admin/bookings/${ticket.related_booking_id}`)}
            className="mt-3 inline-block text-xs font-semibold text-gray-700 underline"
          >
            View related booking
          </button>
        )}
        {ticket.admin_notes && (
          <div className="mt-3 rounded-lg bg-sky-50/50 px-3 py-2 text-sm text-gray-600 border-t border-sky-100 pt-3">
            Admin notes: {ticket.admin_notes}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-sky-100 pt-3">
          {(['open', 'in_progress', 'resolved', 'closed'] as const)
            .filter((s) => s !== ticket.status)
            .map((s) => (
              <button
                key={s}
                disabled={pendingAction}
                onClick={() => void handleStatusChange(s)}
                className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
              >
                Mark {s.replace('_', ' ')}
              </button>
            ))}
          {ticket.status !== 'awaiting_evidence' && (
            <button
              disabled={pendingAction}
              onClick={() => setShowEvidenceForm((v) => !v)}
              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Request more evidence
            </button>
          )}
        </div>

        {showEvidenceForm && (
          <div className="mt-3 border-t border-sky-100 pt-3">
            <textarea
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              placeholder="What do you need from the user?"
              className="mb-2 w-full min-h-[70px] rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button
              disabled={pendingAction || !evidenceNote.trim()}
              onClick={() => void handleRequestEvidence()}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
            >
              Send request
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
        <h2 className="mb-3 font-bold text-gray-900">Timeline</h2>
        <div className="space-y-4">
          {events.map((e) => (
            <div key={e.id} className="border-l-2 border-sky-100 pl-4">
              <p className="text-sm font-semibold text-gray-900">
                {EVENT_LABEL[e.action] || e.action}
                <span className="ml-2 font-normal text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
              </p>
              {e.note && <p className="mt-0.5 text-sm text-gray-600">{e.note}</p>}
              {(e.evidence_paths || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.evidence_paths.map((path: string) => (
                    signedUrls[path] ? (
                      <a key={path} href={signedUrls[path]} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-700 underline">
                        Attachment
                      </a>
                    ) : null
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
