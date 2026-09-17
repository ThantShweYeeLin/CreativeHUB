import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ChevronLeft, MessageSquare, Paperclip, ShieldAlert, Ticket as TicketIcon } from 'lucide-react';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_COLOR, TICKET_STATUS_LABEL, type TicketCategory, type TicketStatus } from '../../lib/supportTickets';

interface TicketDetailPageProps {
  onBack: () => void;
}

const EVENT_LABEL: Record<string, string> = {
  created: 'Ticket created',
  evidence_requested: 'Admin requested more evidence',
  evidence_submitted: 'You submitted more evidence',
  status_changed: 'Status updated',
};

export function TicketDetailPage({ onBack }: TicketDetailPageProps) {
  const { id: ticketId } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = async () => {
    if (!ticketId) return;
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

  const handleSubmitEvidence = async () => {
    if (!user?.id || !ticketId) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const evidencePaths: string[] = [];
    for (const file of files) {
      const uploadResponse = await DataService.uploadReportEvidencePhoto(user.id, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setSubmitError('Unable to upload one of the files. Please try again.');
        setIsSubmitting(false);
        return;
      }
      evidencePaths.push(uploadResponse.path);
    }

    const response = await DataService.submitTicketEvidence(ticketId, note.trim(), evidencePaths);
    setIsSubmitting(false);

    if (response.error) {
      setSubmitError((response.error as any).message || 'Unable to submit. Please try again.');
      return;
    }

    setNote('');
    setFiles([]);
    await load();
  };

  return (
    <div className="relative min-h-screen pb-20 md:pb-12">
      <PageBackdrop />
      <div className="relative z-10">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-sky-100 mb-6 md:mb-8">
          <div className="max-w-[700px] mx-auto px-4 md:px-8 py-4 md:py-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold text-sm md:text-base"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
              Back to My Tickets
            </button>
          </div>
        </div>

        <div className="max-w-[700px] mx-auto px-4 md:px-8 space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : ticket ? (
            <>
              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TicketIcon className="w-5 h-5 text-sky-600" />
                    <p className="font-bold text-gray-900">
                      #{ticket.id.slice(0, 8).toUpperCase()} — {TICKET_CATEGORY_LABEL[ticket.category as TicketCategory] || ticket.category}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TICKET_STATUS_COLOR[ticket.status as TicketStatus] || ''}`}>
                    {TICKET_STATUS_LABEL[ticket.status as TicketStatus] || ticket.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{new Date(ticket.created_at).toLocaleString()}</p>
                <p className="mt-3 text-sm text-gray-700">{ticket.description}</p>
                {ticket.related_booking_id && (
                  <p className="mt-1 text-xs text-gray-500">Related booking: {ticket.related_booking_id}</p>
                )}
                {ticket.screenshot_path && signedUrls[ticket.screenshot_path] && (
                  <img
                    src={signedUrls[ticket.screenshot_path]}
                    alt="Attached screenshot"
                    className="mt-3 max-h-64 rounded-lg border border-sky-100 object-contain"
                  />
                )}
              </div>

              {ticket.status === 'awaiting_evidence' && (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50/50 p-5">
                  <div className="mb-2 flex items-center gap-2 text-red-700">
                    <ShieldAlert className="w-5 h-5" />
                    <p className="font-bold">More evidence needed</p>
                  </div>
                  <p className="mb-3 text-sm text-gray-700">
                    An admin needs more information before this ticket can move forward. Add a note and/or files below.
                  </p>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add more details..."
                    className="mb-3 w-full min-h-[80px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 6))}
                    className="mb-3 text-xs"
                  />
                  {submitError && <p className="mb-3 text-sm text-red-600">{submitError}</p>}
                  <button
                    onClick={() => void handleSubmitEvidence()}
                    disabled={isSubmitting || (!note.trim() && files.length === 0)}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                <div className="mb-3 flex items-center gap-2 text-gray-900">
                  <MessageSquare className="w-5 h-5" />
                  <h2 className="font-bold">Timeline</h2>
                </div>
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
                            <div key={path} className="flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-700">
                              <Paperclip className="w-3 h-3" />
                              {signedUrls[path] ? (
                                <a href={signedUrls[path]} target="_blank" rel="noopener noreferrer" className="underline">
                                  Attachment
                                </a>
                              ) : (
                                'Attachment'
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
