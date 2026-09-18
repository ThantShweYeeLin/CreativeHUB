import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Circle, MessageCircle, Paperclip, Ticket as TicketIcon } from 'lucide-react';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { AttachmentPreview } from '../components/common/AttachmentPreview';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { useBookingTracking } from './bookingTracking/useBookingTracking';
import { DisputeTimeline } from './bookingTracking/DisputeTimeline';
import {
  CLIENT_DISPUTE_STATUS_COLOR,
  CLIENT_DISPUTE_STATUS_DETAIL,
  CLIENT_DISPUTE_STATUS_LABEL,
  DISPUTE_CATEGORY_LABEL,
  type DisputeStatus,
} from '../../lib/disputeCategories';

interface DisputeTicketDetailPageProps {
  onBack: () => void;
}

type StepState = 'done' | 'current' | 'pending';

// Client-friendly 3-stage view of the dispute lifecycle, matching the
// support-ticket detail page's "Ticket progress" tracker — disputes only
// ever move through these 3 stages since openBookingDispute now goes
// straight to admin review (see supabase/dispute_skip_to_admin_review.sql),
// no separate freelancer-response stage to show.
function getDisputeProgressSteps(status: DisputeStatus): { key: string; label: string; description: string; state: StepState }[] {
  const isResolved = status === 'resolved';
  return [
    { key: 'filed', label: 'Dispute filed', description: 'Your report was received and the deposit was frozen.', state: 'done' },
    {
      key: 'review',
      label: 'Under review',
      description: 'CreativeHUB support is reviewing the evidence and platform records.',
      state: isResolved ? 'done' : 'current',
    },
    { key: 'decision', label: 'Decision', description: "You'll be notified of the outcome, including the deposit decision.", state: isResolved ? 'done' : 'pending' },
  ];
}

export function DisputeTicketDetailPage({ onBack }: DisputeTicketDetailPageProps) {
  const { user } = useAuth();
  const { booking, events, disputeEvidence, signedUrls, isLoading, error, refresh } = useBookingTracking();

  const [reply, setReply] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isClient = Boolean(user?.id && booking && String(booking.client_id) === String(user.id));
  const myRole: 'client' | 'freelancer' = isClient ? 'client' : 'freelancer';
  const otherPartyLabel = isClient ? 'Freelancer' : 'Client';

  const disputeStatus = (booking?.dispute_status || 'under_admin_review') as DisputeStatus;
  const isOpenForReply = disputeStatus === 'under_admin_review' || disputeStatus === 'open';
  // The round-1 'complain' event that opened the dispute - events are
  // fetched in ascending order, so the first match is always the original
  // filing regardless of which side filed it.
  const initialComplaint = events.find((e) => e.action === 'complain');

  // Reply "messages" are their own dispute_evidence items (evidence_type
  // 'message', inserted below) kept out of DisputeTimeline - it groups
  // per-item evidence with the matching round+role complain/evidence event,
  // which would make a later reply look like it was submitted at filing
  // time. Rendered here instead with their own real timestamps.
  const timelineEvidence = disputeEvidence.filter((item) => item.evidence_type !== 'message');
  const conversationItems = disputeEvidence
    .filter((item) => item.evidence_type === 'message')
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const conversationScrollRef = useRef<HTMLDivElement>(null);

  // Sets scrollTop directly on the box itself rather than
  // scrollIntoView()-ing a bottom marker — scrollIntoView walks up through
  // every scrollable ancestor (this box, but also the page around it), so
  // its actual result depends on how much other content the surrounding
  // page has above/below it. Setting scrollTop here only ever touches this
  // one box. Re-runs on signedUrls too since an attachment's image resolves
  // slightly after the message list itself and would otherwise grow the
  // thread taller after the scroll already happened.
  useEffect(() => {
    const el = conversationScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversationItems.length, signedUrls]);

  // Lets a 'dispute_message' notification land directly on the conversation
  // instead of just the top of the page (see
  // supabase/ticket_and_dispute_message_notifications.sql) — waits for
  // `booking` so #conversation has actually rendered before scrolling.
  // Guarded to run only once: `booking` gets a new object reference on
  // every refresh (including the realtime-triggered ones from
  // useBookingTracking's subscription), so without hasScrolledToHash this
  // fired again on every later update — repeatedly yanking the page back up
  // to the top of the conversation CARD moments after the conversation's
  // own bottom-scroll had already settled on the latest message.
  const hasScrolledToHash = useRef(false);
  useEffect(() => {
    if (!booking || !window.location.hash || hasScrolledToHash.current) {
      return;
    }
    hasScrolledToHash.current = true;
    const target = document.getElementById(window.location.hash.slice(1));
    // 'end', not 'start' — the conversation card is tall (message box +
    // reply input), so aligning its TOP with the viewport pushed the
    // actual latest message (and the reply box) below the fold. 'end'
    // aligns the card's bottom instead, keeping the tail of the thread —
    // where the message this notification is even about lives — in view.
    target?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [booking]);

  const handleSendReply = async () => {
    // A photo on its own is a complete message — no caption required.
    if (!user?.id || !booking?.id || (!reply.trim() && !replyFile) || isSending) return;
    setIsSending(true);
    setSendError(null);

    let storagePath: string | null = null;
    if (replyFile) {
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(user.id, booking.id, replyFile);
      if (uploadResponse.error || !uploadResponse.path) {
        setSendError('Unable to upload the attachment.');
        setIsSending(false);
        return;
      }
      storagePath = uploadResponse.path;
    }

    const response = await DataService.submitDisputeEvidenceItem({
      bookingId: booking.id,
      round: Number(booking.dispute_round || 1),
      submittedBy: user.id,
      role: myRole,
      evidenceType: 'message',
      description: reply.trim(),
      storagePath,
    });

    setIsSending(false);
    if (response.error) {
      setSendError((response.error as any).message || 'Unable to send message.');
      return;
    }

    setReply('');
    setReplyFile(null);
    await refresh();
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
          ) : booking ? (
            <>
              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ticket #D-{booking.id.slice(0, 8).toUpperCase()}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      <AlertTriangle className="h-3 w-3" />
                      Booking dispute
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CLIENT_DISPUTE_STATUS_COLOR[disputeStatus] || ''}`}>
                      {CLIENT_DISPUTE_STATUS_LABEL[disputeStatus] || disputeStatus}
                    </span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <TicketIcon className="w-5 h-5 text-sky-600" />
                  <p className="text-lg font-bold text-gray-900">
                    Booking #{booking.id.slice(0, 8).toUpperCase()}
                    {initialComplaint?.category ? ` — ${DISPUTE_CATEGORY_LABEL[initialComplaint.category] || initialComplaint.category}` : ''}
                  </p>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {booking.project_name} · Created{' '}
                  {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                <h2 className="mb-2 font-bold text-gray-900">Current status</h2>
                <p className="text-sm text-gray-700">
                  {CLIENT_DISPUTE_STATUS_DETAIL[disputeStatus] || CLIENT_DISPUTE_STATUS_DETAIL.under_admin_review}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                <h2 className="mb-3 font-bold text-gray-900">Ticket progress</h2>
                <div className="space-y-4">
                  {getDisputeProgressSteps(disputeStatus).map((step) => (
                    <div key={step.key} className="flex gap-3">
                      {step.state === 'done' ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                      ) : step.state === 'current' ? (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 fill-amber-100 text-amber-500" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
                      )}
                      <div>
                        <p className={`text-sm font-semibold ${step.state === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>{step.label}</p>
                        <p className={`text-sm ${step.state === 'pending' ? 'text-gray-400' : 'text-gray-600'}`}>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                <h2 className="mb-3 font-bold text-gray-900">Reported issue &amp; evidence</h2>
                <DisputeTimeline events={events} signedUrls={signedUrls} disputeEvidence={timelineEvidence} />
              </div>

              {user?.id && (
                <div id="conversation" className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
                  <div className="mb-3 flex items-center gap-2 text-gray-900">
                    <MessageCircle className="w-5 h-5" />
                    <h2 className="font-bold">Conversation</h2>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div ref={conversationScrollRef} className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-sky-50/50 p-3">
                      {conversationItems.length === 0 ? (
                        <p className="py-2 text-center text-xs text-gray-500">No messages yet.</p>
                      ) : (
                        conversationItems.map((item) => {
                          const isSelf = item.role !== 'admin' && item.submitted_by === user.id;
                          const senderLabel = isSelf ? 'You' : item.role === 'admin' ? 'CreativeHUB Support' : otherPartyLabel;
                          return (
                            <div key={item.id} className={`flex gap-2 ${isSelf ? 'flex-row-reverse text-right' : ''}`}>
                              <div className={`max-w-[80%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                <span className="text-[11px] font-semibold text-gray-500">{senderLabel}</span>
                                <div
                                  className={`rounded-2xl px-3 py-2 text-sm ${
                                    isSelf ? 'rounded-br-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
                                  }`}
                                >
                                  {item.description && <p className="whitespace-pre-wrap">{item.description}</p>}
                                  {item.storage_path && signedUrls[item.storage_path] && (
                                    <a href={signedUrls[item.storage_path]} target="_blank" rel="noreferrer" className={item.description ? 'mt-2 block' : 'block'}>
                                      <img src={signedUrls[item.storage_path]} alt="Attachment" className="max-h-40 rounded-lg object-cover" />
                                    </a>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {sendError && <p className="text-xs font-semibold text-red-600">{sendError}</p>}

                    {isOpenForReply ? (
                      <>
                        <div className="flex items-end gap-2">
                          <textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            onKeyDown={(e) => {
                              // Shift+Enter still inserts a newline — only a plain Enter sends.
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void handleSendReply();
                              }
                            }}
                            placeholder="Add more information for CreativeHUB support…"
                            rows={1}
                            className="min-h-[38px] flex-1 resize-none rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                          />
                          <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-sky-100 text-gray-500 hover:bg-sky-50">
                            <Paperclip className="h-4 w-4" />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => setReplyFile(e.target.files?.[0] || null)} />
                          </label>
                          <button
                            onClick={() => void handleSendReply()}
                            disabled={(!reply.trim() && !replyFile) || isSending}
                            className="shrink-0 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/30 disabled:opacity-40"
                          >
                            {isSending ? 'Sending...' : 'Send reply'}
                          </button>
                        </div>
                        {replyFile && <AttachmentPreview file={replyFile} onRemove={() => setReplyFile(null)} />}
                      </>
                    ) : (
                      <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                        This dispute has been resolved, so it's read-only. If you need further help, open a new support ticket.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
