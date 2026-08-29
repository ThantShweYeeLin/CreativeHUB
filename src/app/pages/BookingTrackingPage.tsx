import { ChevronLeft, Clock, CheckCircle, FileText, AlertCircle, Shield, Camera, ChevronRight, Ban, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { getBookingEscrowState, formatCountdown, MAX_DISPUTE_ROUNDS, type EscrowState } from '../../lib/bookingEscrow';
import { extractScheduleMeta, formatTimeLabel } from '../../lib/requestSchedule';
import { extractLocationMeta } from '../../lib/requestLocation';

interface BookingTrackingPageProps {
  onBack: () => void;
}

const fallbackProfileImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

const DISPUTE_CATEGORY_LABEL: Record<string, string> = {
  no_show: 'Freelancer did not show up',
  not_as_agreed: 'Service was not as agreed',
  other: 'Other',
};

export function BookingTrackingPage({ onBack }: BookingTrackingPageProps) {
  const { id } = useParams();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const [booking, setBooking] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPayingDeposit, setIsPayingDeposit] = useState(false);

  const [completionText, setCompletionText] = useState('');
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  const [isConfirming, setIsConfirming] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<'no_show' | 'not_as_agreed' | 'other'>('not_as_agreed');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFiles, setDisputeFiles] = useState<File[]>([]);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const [showRespondForm, setShowRespondForm] = useState(false);
  const [respondReason, setRespondReason] = useState('');
  const [respondFiles, setRespondFiles] = useState<File[]>([]);
  const [isResponding, setIsResponding] = useState(false);

  const escrowState: EscrowState = useMemo(() => getBookingEscrowState(booking), [booking]);

  useEffect(() => {
    let isMounted = true;

    async function loadBooking() {
      if (!id) {
        if (isMounted) {
          setError('Missing booking id.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      let response = await DataService.getBooking(id);
      if (isMounted && response.data) {
        // Reconciliation/arbitration are safe no-ops when nothing is due —
        // running them on every load is what keeps deadlines enforced
        // without a server cron.
        await DataService.reconcileBookingEscrow(id);
        await DataService.arbitrateBookingDispute(id);
        response = await DataService.getBooking(id);
      }

      if (!isMounted) return;

      if (response.error || !response.data) {
        setError((response.error as any)?.message || 'Unable to load booking.');
        setBooking(null);
      } else {
        setBooking(response.data);
      }

      const eventsResponse = await DataService.getBookingEvents(id);
      if (isMounted) {
        setEvents(eventsResponse.data || []);
      }

      setIsLoading(false);
    }

    loadBooking();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    const paths = [
      ...((booking?.completion_evidence_photos as string[]) || []),
      ...events.flatMap((event) => (event.evidence_photos as string[]) || []),
    ];
    const missing = Array.from(new Set(paths.filter((p) => p && !signedUrls[p])));
    if (!missing.length) return;

    let isMounted = true;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (path) => {
          const res = await DataService.getBookingEvidenceSignedUrl(path);
          return [path, res.url] as const;
        })
      );
      if (!isMounted) return;
      setSignedUrls((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(([, url]) => Boolean(url)) as Array<[string, string]>),
      }));
    })();

    return () => {
      isMounted = false;
    };
  }, [booking, events]);

  const refresh = async () => {
    if (!id) return;
    const [bookingResponse, eventsResponse] = await Promise.all([DataService.getBooking(id), DataService.getBookingEvents(id)]);
    if (bookingResponse.data) setBooking(bookingResponse.data);
    setEvents(eventsResponse.data || []);
  };

  const handleTransferDeposit = async () => {
    if (!booking) return;
    setIsPayingDeposit(true);
    setError(null);

    const response = await DataService.updateBooking(booking.id, { status: 'confirmed', payment_status: 'deposit_paid' } as any);

    setIsPayingDeposit(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to transfer deposit.');
      return;
    }

    setBooking(response.data);
  };

  const handleSubmitCompletion = async () => {
    if (!booking || !user?.id) return;
    setIsSubmittingCompletion(true);
    setError(null);

    const photoPaths: string[] = [];
    for (const file of completionFiles) {
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(user.id, booking.id, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setError('Unable to upload one of the evidence photos.');
        setIsSubmittingCompletion(false);
        return;
      }
      photoPaths.push(uploadResponse.path);
    }

    const response = await DataService.submitBookingCompletion(booking.id, { text: completionText, photoPaths });
    setIsSubmittingCompletion(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit completion.');
      return;
    }

    setCompletionText('');
    setCompletionFiles([]);
    await refresh();
  };

  const handleConfirmCompletion = async () => {
    if (!booking) return;
    setIsConfirming(true);
    setError(null);

    const response = await DataService.confirmBookingCompletion(booking.id);
    setIsConfirming(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to confirm completion.');
      return;
    }

    await refresh();
  };

  const handleSubmitDispute = async () => {
    if (!booking || !disputeReason.trim()) {
      setError('Describe the problem before submitting.');
      return;
    }
    setIsSubmittingDispute(true);
    setError(null);

    const response = await DataService.openBookingDispute(booking.id, {
      category: disputeCategory,
      reason: disputeReason.trim(),
      evidencePhotoPaths: [],
    });

    setIsSubmittingDispute(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit dispute.');
      return;
    }

    setShowDisputeForm(false);
    setDisputeReason('');
    setDisputeFiles([]);
    await refresh();
  };

  const handleRespondWithEvidence = async () => {
    if (!booking || !user?.id) return;
    setIsResponding(true);
    setError(null);

    const photoPaths: string[] = [];
    for (const file of respondFiles) {
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(user.id, booking.id, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setError('Unable to upload one of the evidence photos.');
        setIsResponding(false);
        return;
      }
      photoPaths.push(uploadResponse.path);
    }

    const actor = user.role === 'freelancer' ? 'freelancer' : 'client';
    const response = await DataService.respondToBookingDispute(booking.id, {
      actor,
      hasEvidence: true,
      evidenceText: respondReason,
      evidencePhotoPaths: photoPaths,
      reason: respondReason,
    });

    setIsResponding(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit response.');
      return;
    }

    setShowRespondForm(false);
    setRespondReason('');
    setRespondFiles([]);
    await refresh();
  };

  const handleConcede = async () => {
    if (!booking) return;
    setIsResponding(true);
    setError(null);

    const response = await DataService.respondToBookingDispute(booking.id, { actor: 'freelancer', hasEvidence: false });

    setIsResponding(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit response.');
      return;
    }

    await refresh();
  };

  const bookingData = useMemo(() => {
    if (!booking) {
      return null;
    }

    const servicePrice = Number(booking.budget || 0);
    const deposit = Math.round(servicePrice * 0.3);
    // Prefer the real start_date/start_time columns (populated going forward);
    // fall back to the SCHEDULE_META tag in description for older bookings.
    const scheduleMeta = booking.start_date
      ? { date: booking.start_date, time: booking.start_time || '00:00' }
      : extractScheduleMeta(booking.description);
    const locationMeta = extractLocationMeta(booking.description);
    const scheduleDateLabel = scheduleMeta
      ? new Date(`${scheduleMeta.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : 'Schedule pending';
    const scheduleTimeLabel = scheduleMeta && (booking.start_time || !booking.start_date)
      ? formatTimeLabel(scheduleMeta.time)
      : 'Time to be confirmed';

    return {
      bookingId: `#${booking.id.slice(0, 8).toUpperCase()}`,
      freelancer: {
        name: booking.freelancer?.full_name || 'CreativeHUB Freelancer',
        specialty: booking.project_name,
        image: booking.freelancer?.avatar_url || fallbackProfileImage,
        gender: booking.freelancer?.gender || null,
        rating: Number(booking.freelancer?.rating || 0),
        reviews: Number(booking.freelancer?.total_reviews || 0),
      },
      service: {
        title: booking.project_name,
        date: scheduleDateLabel,
        time: scheduleTimeLabel,
        location: locationMeta || booking.freelancer?.location || booking.client?.location || 'Location to be confirmed',
      },
      pricing: {
        servicePrice,
        deposit,
        total: servicePrice,
      },
      bookingDate: booking.created_at ? new Date(booking.created_at).toLocaleDateString() : 'Pending',
    };
  }, [booking]);

  const viewerCurrency = normalizeCurrencyCode(preferredCurrency, 'THB');
  const formatMoney = (amount: number) => {
    const converted = convertAmount(Number(amount || 0), 'THB', viewerCurrency);
    return formatCurrencyAmount(converted, viewerCurrency);
  };

  const disputeEvents = events.filter((event) => event.round != null);
  const canRespondToDispute =
    booking?.dispute_status === 'open' &&
    ((user?.role === 'freelancer' && booking.dispute_awaiting === 'freelancer') ||
      (user?.role === 'client' && booking.dispute_awaiting === 'client'));
  const roundsExhausted = Number(booking?.dispute_round || 0) >= MAX_DISPUTE_ROUNDS;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
      </div>
    );
  }

  if (error && !bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 p-6">
        <div className="mx-auto max-w-[600px] rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <p className="text-sm text-red-700">{error || 'Booking could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (!bookingData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[600px] mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors mb-3"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">Booking Tracking</h1>
          <p className="text-sm text-gray-600">{bookingData.bookingId}</p>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Freelancer Profile Preview */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar
              src={bookingData.freelancer.image}
              alt={bookingData.freelancer.name}
              gender={bookingData.freelancer.gender}
              sizeClassName="w-16 h-16 ring-2 ring-gray-200 rounded-full flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">{bookingData.freelancer.name}</h2>
              <p className="text-sm text-gray-600">{bookingData.freelancer.specialty}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-gray-900 font-semibold">★ {bookingData.freelancer.rating}</span>
                <span className="text-xs text-gray-500">({bookingData.freelancer.reviews} reviews)</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-gray-900 mb-2">{bookingData.service.title}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{bookingData.service.date} • {bookingData.service.time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>{bookingData.service.location}</span>
            </div>
          </div>
        </div>

        {/* Annulled */}
        {escrowState === 'annulled' && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-red-900">Booking Cancelled</h2>
            </div>
            <p className="text-sm text-red-700">
              The deposit wasn't paid within 24 hours of acceptance, so this booking was automatically cancelled.
            </p>
          </div>
        )}

        {/* Awaiting deposit */}
        {escrowState === 'awaiting_deposit' && (
          <div className="rounded-2xl shadow-lg border-2 border-gray-900 bg-gradient-to-br from-gray-900 to-black text-white p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-6 h-6 text-white" />
              <h2 className="font-bold text-lg text-white">Deposit Transfer Required</h2>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Transfer the booking deposit to secure your booking. The deposit will be held safely and released to the
              freelancer after service completion.
            </p>
            {formatCountdown(booking.deposit_deadline) && (
              <p className="mb-3 text-xs font-semibold text-amber-300">⏱ {formatCountdown(booking.deposit_deadline)} to pay</p>
            )}
            <div className="bg-white rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Deposit Amount</span>
                <span className="text-2xl font-bold text-gray-900">{formatMoney(bookingData.pricing.deposit)}</span>
              </div>
              <p className="text-xs text-gray-500">This amount will be held until service completion</p>
            </div>
            {user?.role === 'client' ? (
              <button
                onClick={() => void handleTransferDeposit()}
                disabled={isPayingDeposit}
                className="w-full bg-white text-gray-900 py-3 px-4 rounded-xl font-bold hover:bg-gray-100 transition-all disabled:opacity-60"
              >
                {isPayingDeposit ? 'Transferring...' : 'Transfer Deposit Now'}
              </button>
            ) : (
              <p className="text-center text-sm text-gray-300">Waiting for the client to transfer the deposit.</p>
            )}
          </div>
        )}

        {/* Deposit secured, work not yet marked complete */}
        {escrowState === 'deposit_secured' && (
          <div className="rounded-2xl shadow-lg border-2 border-gray-900 bg-white p-5 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Deposit Secured: {formatMoney(bookingData.pricing.deposit)}</p>
                <p className="text-xs text-gray-600">Held safely until service completion</p>
              </div>
            </div>

            {user?.role === 'freelancer' && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">Mark this booking complete</p>
                <textarea
                  value={completionText}
                  onChange={(e) => setCompletionText(e.target.value)}
                  placeholder="Describe the completed work..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 mb-3 min-h-[80px]"
                />
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Evidence photos (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setCompletionFiles(Array.from(e.target.files || []).slice(0, 6))}
                    className="text-xs"
                  />
                  {completionFiles.length > 0 && <p className="mt-1 text-xs text-gray-500">{completionFiles.length} file(s) selected</p>}
                </div>
                <button
                  onClick={() => void handleSubmitCompletion()}
                  disabled={isSubmittingCompletion}
                  className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-60"
                >
                  {isSubmittingCompletion ? 'Submitting...' : 'Mark Complete with Evidence'}
                </button>
              </div>
            )}
            {user?.role === 'client' && (
              <p className="mt-2 text-xs text-gray-500">Waiting for the freelancer to mark this booking complete.</p>
            )}
          </div>
        )}

        {/* Awaiting client confirmation */}
        {escrowState === 'awaiting_client_confirmation' && (
          <div className="rounded-2xl shadow-lg border-2 border-gray-900 bg-white p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-6 h-6 text-gray-900" />
              <h2 className="font-bold text-lg text-gray-900">Work Marked Complete</h2>
            </div>
            {formatCountdown(booking.client_response_deadline) && (
              <p className="mb-3 text-xs font-semibold text-amber-600">⏱ {formatCountdown(booking.client_response_deadline)} to respond, or the deposit auto-releases</p>
            )}
            {booking.completion_evidence_text && <p className="mb-3 text-sm text-gray-700">{booking.completion_evidence_text}</p>}
            {(booking.completion_evidence_photos || []).length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                {(booking.completion_evidence_photos as string[]).map((path) => (
                  <div key={path} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                    {signedUrls[path] ? (
                      <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Camera className="h-5 w-5 text-gray-400" /></div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {user?.role === 'client' && !showDisputeForm && (
              <div className="flex gap-2">
                <button
                  onClick={() => void handleConfirmCompletion()}
                  disabled={isConfirming}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-60"
                >
                  <CheckCircle className="w-5 h-5" />
                  {isConfirming ? 'Confirming...' : 'Confirm Completion'}
                </button>
                <button
                  onClick={() => setShowDisputeForm(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                  <AlertCircle className="w-5 h-5" />
                  Report a Problem
                </button>
              </div>
            )}

            {user?.role === 'client' && showDisputeForm && (
              <div className="mt-2 rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-gray-900">Report a Problem</p>
                  <button onClick={() => setShowDisputeForm(false)} className="text-gray-400 hover:text-gray-900"><X className="h-4 w-4" /></button>
                </div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Category</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value as any)}
                  className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="no_show">Freelancer did not show up</option>
                  <option value="not_as_agreed">Service was not as agreed</option>
                  <option value="other">Other</option>
                </select>
                <label className="mb-1 block text-xs font-semibold text-gray-600">What went wrong?</label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => void handleSubmitDispute()}
                  disabled={isSubmittingDispute}
                  className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
                >
                  {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            )}

            {user?.role === 'freelancer' && (
              <p className="text-xs text-gray-500">Waiting for the client to confirm or report a problem.</p>
            )}
          </div>
        )}

        {/* Disputed */}
        {escrowState === 'disputed' && (
          <div className="rounded-2xl shadow-lg border-2 border-amber-400 bg-white p-5 mb-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              <h2 className="font-bold text-lg text-gray-900">Dispute — Round {booking.dispute_round} of {MAX_DISPUTE_ROUNDS}</h2>
            </div>
            {formatCountdown(booking.dispute_response_deadline) && (
              <p className="mb-3 text-xs font-semibold text-amber-600">
                ⏱ {formatCountdown(booking.dispute_response_deadline)} for {booking.dispute_awaiting === 'freelancer' ? 'the freelancer' : 'the client'} to respond
              </p>
            )}

            <div className="mb-4 space-y-3 border-l-2 border-gray-200 pl-4">
              {disputeEvents.map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
                  <p className="text-xs text-gray-500">
                    Round {event.round} — {event.actor === 'client' ? 'Client' : event.actor === 'freelancer' ? 'Freelancer' : 'System'} · {new Date(event.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {event.action === 'complain' && `Reported a problem${event.category ? ` (${DISPUTE_CATEGORY_LABEL[event.category] || event.category})` : ''}`}
                    {event.action === 'evidence' && 'Responded with evidence'}
                    {event.action === 'conceded' && 'Conceded — no evidence provided'}
                  </p>
                  {event.reason && <p className="mt-1 text-sm text-gray-600">"{event.reason}"</p>}
                  {event.evidence_text && <p className="mt-1 text-sm text-gray-600">{event.evidence_text}</p>}
                  {(event.evidence_photos || []).length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {(event.evidence_photos as string[]).map((path) => (
                        <div key={path} className="aspect-square overflow-hidden rounded bg-gray-100">
                          {signedUrls[path] && <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canRespondToDispute && !showRespondForm && (
              <div className="flex flex-wrap gap-2">
                {user?.role === 'client' && (
                  <button
                    onClick={() => void handleConfirmCompletion()}
                    disabled={isConfirming}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    <CheckCircle className="h-4 w-4" /> Accept & Confirm
                  </button>
                )}
                {user?.role === 'freelancer' && (
                  <button
                    onClick={() => void handleConcede()}
                    disabled={isResponding}
                    className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                  >
                    I don't have evidence
                  </button>
                )}
                {!(user?.role === 'client' && roundsExhausted) && (
                  <button
                    onClick={() => setShowRespondForm(true)}
                    className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                  >
                    {user?.role === 'freelancer' ? 'Respond with Evidence' : 'Still Not Satisfied'}
                  </button>
                )}
              </div>
            )}

            {canRespondToDispute && user?.role === 'client' && roundsExhausted && (
              <p className="text-xs text-gray-500">Maximum dispute rounds reached — the system will make a final decision.</p>
            )}

            {canRespondToDispute && showRespondForm && (
              <div className="rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-gray-900">{user?.role === 'freelancer' ? 'Respond with Evidence' : 'Explain why you still want a refund'}</p>
                  <button onClick={() => setShowRespondForm(false)} className="text-gray-400 hover:text-gray-900"><X className="h-4 w-4" /></button>
                </div>
                <textarea
                  value={respondReason}
                  onChange={(e) => setRespondReason(e.target.value)}
                  placeholder="Explain your side..."
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Evidence photos (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setRespondFiles(Array.from(e.target.files || []).slice(0, 6))}
                    className="text-xs"
                  />
                </div>
                <button
                  onClick={() => void handleRespondWithEvidence()}
                  disabled={isResponding}
                  className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
                >
                  {isResponding ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            )}

            {!canRespondToDispute && (
              <p className="text-xs text-gray-500">
                Waiting for {booking.dispute_awaiting === 'freelancer' ? 'the freelancer' : 'the client'} to respond.
              </p>
            )}
          </div>
        )}

        {/* Released */}
        {escrowState === 'released' && (
          <div className="rounded-2xl shadow-lg border-2 border-green-500 bg-white p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{formatMoney(bookingData.pricing.deposit)} Released</p>
                <p className="text-xs text-gray-600">Deposit successfully transferred to {bookingData.freelancer.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Refunded */}
        {escrowState === 'refunded' && (
          <div className="rounded-2xl shadow-lg border-2 border-red-300 bg-white p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <Ban className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{formatMoney(bookingData.pricing.deposit)} Refunded</p>
                <p className="text-xs text-gray-600">The deposit was refunded to the client following a dispute.</p>
              </div>
            </div>
          </div>
        )}

        {/* Booking Fee Summary */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Payment Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service Price</span>
              <span className="font-semibold text-gray-900">{formatMoney(bookingData.pricing.servicePrice)}</span>
            </div>
            <div className="flex justify-between text-sm items-start">
              <div className="flex-1">
                <span className="text-gray-600">Booking Deposit</span>
                {escrowState !== 'released' && (
                  <p className="text-xs text-gray-500 mt-0.5">To be transferred after completion</p>
                )}
              </div>
              <span className="font-semibold text-gray-900">{formatMoney(bookingData.pricing.deposit)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total Booking Cost</span>
              <span className="font-bold text-gray-900 text-xl">{formatMoney(bookingData.pricing.total)}</span>
            </div>
          </div>

          {escrowState !== 'released' && escrowState !== 'refunded' && escrowState !== 'annulled' && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">How Deposit Works</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Your {formatMoney(bookingData.pricing.deposit)} deposit is held securely by CreativeHUB.
                    After the service is completed and you confirm satisfaction (or after 7 days with no response), the
                    deposit is automatically transferred to {bookingData.freelancer.name}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Deposit Protection Info */}
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-lg p-5 text-white">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Deposit Protection
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Deposit held securely until service completion</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Refund available if a dispute is upheld</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Automatic transfer to freelancer after confirmation</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Report issues anytime during project progress</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
