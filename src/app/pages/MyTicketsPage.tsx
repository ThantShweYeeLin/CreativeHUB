import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, Plus, Ticket as TicketIcon, X } from 'lucide-react';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { isValidBookingId, looksLikeDisputeReport, TICKET_CATEGORY_LABEL, TICKET_STATUS_COLOR, TICKET_STATUS_LABEL, type TicketCategory } from '../../lib/supportTickets';

interface MyTicketsPageProps {
  onBack: () => void;
}

export function MyTicketsPage({ onBack }: MyTicketsPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRoutingToDispute, setIsRoutingToDispute] = useState(false);

  const needsBookingId = category === 'booking' || category === 'payment';
  // Content-based, not category-based (see looksLikeDisputeReport) - a
  // no-show/late-arrival/missing-deliverable report belongs in the
  // booking's own dispute flow (reviewed against platform records, with
  // the other party able to respond), not a support ticket that would just
  // sit disconnected from all of that. Everything else in the booking
  // category (payment failures, technical errors, general questions)
  // still submits as a normal ticket.
  const isDisputeLikeReport = category === 'booking' && looksLikeDisputeReport(description);

  const load = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const response = await DataService.getUserSupportTickets(user.id);
    if (response.error) {
      setError((response.error as any).message || 'Unable to load your tickets.');
    } else {
      setTickets(response.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Sends the user to the correct booking tracking page (client vs
  // freelancer route depends on which side of the booking they're on) with
  // the booking id they already typed preserved, instead of creating a
  // ticket — the actual dispute mechanism lives there (ReportProblemFlow /
  // DataService.openBookingDispute), not in the ticket system.
  const goToDisputeFlow = async () => {
    if (!isValidBookingId(bookingId) || !user?.id) return;
    setIsRoutingToDispute(true);
    setSubmitError(null);
    const response = await DataService.getBooking(bookingId.trim());
    setIsRoutingToDispute(false);
    if (response.error || !response.data) {
      setSubmitError("Couldn't find that booking — double check the ID, or submit this as a regular ticket instead.");
      return;
    }
    const isClient = String((response.data as any).client_id) === String(user.id);
    const basePath = isClient ? `/booking/${bookingId.trim()}` : `/freelancer-booking/${bookingId.trim()}`;
    setShowCreateModal(false);
    navigate(`${basePath}#${isClient ? 'report-a-problem-button' : 'attendance-check'}`);
  };

  const handleSubmit = async () => {
    if (!user?.id || !description.trim()) {
      setSubmitError('Describe the issue before submitting.');
      return;
    }
    if (isDisputeLikeReport) {
      setSubmitError('This sounds like a no-show or missing-deliverable report — use "Go to Report a Problem" below instead of submitting it as a ticket.');
      return;
    }
    if (needsBookingId && !bookingId.trim()) {
      setSubmitError('Booking ID is required for booking and payment issues.');
      return;
    }
    if (needsBookingId && !isValidBookingId(bookingId)) {
      setSubmitError('That doesn\'t look like a valid booking ID — copy it exactly from the booking\'s tracking page.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    let screenshotPath: string | null = null;
    if (file) {
      const uploadResponse = await DataService.uploadReportEvidencePhoto(user.id, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setSubmitError('Unable to upload the screenshot.');
        setIsSubmitting(false);
        return;
      }
      screenshotPath = uploadResponse.path;
    }

    const response = await DataService.submitSupportTicket({
      userId: user.id,
      category,
      description: description.trim(),
      screenshotPath,
      relatedBookingId: needsBookingId ? bookingId.trim() || null : null,
    });

    setIsSubmitting(false);

    if (response.error) {
      setSubmitError((response.error as any).message || 'Unable to submit ticket.');
      return;
    }

    setShowCreateModal(false);
    setDescription('');
    setFile(null);
    setBookingId('');
    setCategory('technical');
    await load();
    if (response.data?.id) {
      navigate(`/tickets/${response.data.id}`);
    }
  };

  return (
    <div className="relative min-h-screen pb-20 md:pb-12">
      <PageBackdrop />
      <div className="relative z-10">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-sky-100 mb-6 md:mb-8">
          <div className="max-w-[800px] mx-auto px-4 md:px-8 py-4 md:py-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
              Back
            </button>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <TicketIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Tickets</h1>
                  <p className="text-sm md:text-base text-gray-600">Report a problem and track how it's going</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/30 hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Create a Ticket
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[800px] mx-auto px-4 md:px-8">
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <TicketIcon className="w-10 h-10 text-sky-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-900">No tickets yet</p>
              <p className="mt-1 text-sm text-gray-500">Run into a problem? Create a ticket and our team will take a look.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="w-full rounded-2xl border border-sky-100 bg-white p-4 text-left shadow-[0_8px_30px_rgba(56,189,248,0.15)] hover:bg-sky-50 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-900">
                      #{t.id.slice(0, 8).toUpperCase()} — {TICKET_CATEGORY_LABEL[t.category as TicketCategory] || t.category}
                    </p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TICKET_STATUS_COLOR[t.status as keyof typeof TICKET_STATUS_COLOR] || ''}`}>
                      {TICKET_STATUS_LABEL[t.status as keyof typeof TICKET_STATUS_LABEL] || t.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{t.description}</p>
                  <p className="mt-1 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Create a Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="mb-3 w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {Object.entries(TICKET_CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {/* Guidance, not a block — a genuine no-show/deliverables report
                belongs in the booking's own dispute flow (reviewed against
                platform records, with the other party able to respond),
                not a support ticket that would just sit disconnected from
                all of that. Payment failures, technical errors, and general
                booking questions are still real tickets — this only steers,
                the category itself never auto-creates a dispute. */}
            {category === 'booking' && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <p className="font-semibold">Reporting a no-show, late arrival, or missing deliverables?</p>
                <p className="mt-0.5">
                  Use <span className="font-semibold">Report a Problem</span> on that booking's own tracking page instead —
                  it goes straight to our dispute review, and the other party can respond. This form is for other
                  booking issues, like a technical error or a general question.
                </p>
                {bookingId.trim() && isValidBookingId(bookingId) && (
                  <button
                    type="button"
                    onClick={() => navigate(`/booking/${bookingId.trim()}`)}
                    className="mt-2 font-semibold text-amber-900 underline"
                  >
                    Go to that booking's tracking page
                  </button>
                )}
              </div>
            )}
            {/* Enforced, not just advisory - the description itself reads
                like exactly the kind of report the banner above warns
                about, so this blocks Submit and pushes the user into the
                real dispute flow instead of letting it become a
                disconnected plain ticket. */}
            {isDisputeLikeReport && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                <p className="font-semibold">This reads like a no-show or missing-deliverable report.</p>
                <p className="mt-0.5">Reports like this have to go through the booking's dispute review, not a support ticket.</p>
                <button
                  type="button"
                  onClick={() => void goToDisputeFlow()}
                  disabled={!isValidBookingId(bookingId) || isRoutingToDispute}
                  className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                >
                  {isRoutingToDispute ? 'Opening...' : 'Go to Report a Problem'}
                </button>
                {!isValidBookingId(bookingId) && <p className="mt-1.5 text-red-700">Enter the booking ID below first.</p>}
              </div>
            )}
            <label className="mb-1 block text-xs font-semibold text-gray-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              className="mb-3 w-full min-h-[80px] rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            {needsBookingId && (
              <>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Booking ID (required)</label>
                <input
                  type="text"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="Paste the booking's ID here"
                  className={`mb-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    bookingId.trim() && !isValidBookingId(bookingId) ? 'border-red-300 focus:ring-red-300' : 'border-sky-100 focus:ring-sky-300'
                  }`}
                />
                {bookingId.trim() && !isValidBookingId(bookingId) && (
                  <p className="mb-2 text-xs text-red-600">That doesn't look like a valid booking ID.</p>
                )}
                <p className="mb-3 text-xs text-gray-400">
                  Find it on the booking's tracking page — required for booking and payment issues, whether you're the client or the freelancer on it.
                </p>
              </>
            )}
            <label className="mb-1 block text-xs font-semibold text-gray-600">Attach screenshot (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mb-4 text-xs"
            />
            {submitError && <p className="mb-3 text-sm text-red-600">{submitError}</p>}
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || isDisputeLikeReport || (needsBookingId && !isValidBookingId(bookingId))}
              className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
