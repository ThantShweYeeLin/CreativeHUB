import { AlertCircle, Ban, ChevronLeft, ChevronRight, CheckCircle, Camera, Clock, FileText, Shield, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { formatCountdown } from '../../lib/bookingEscrow';
import { useBookingTracking } from './bookingTracking/useBookingTracking';
import { DisputeTimeline } from './bookingTracking/DisputeTimeline';
import { BookingReviewPrompt } from './bookingTracking/BookingReviewPrompt';

interface BookingTrackingFreelancerPageProps {
  onBack: () => void;
}

export function BookingTrackingFreelancerPage({ onBack }: BookingTrackingFreelancerPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency: preferredCurrency } = useCurrency();
  const { booking, events, signedUrls, isLoading, error, setError, refresh, escrowState, bookingData } = useBookingTracking();

  // Symmetric to BookingTrackingClientPage's redirect — a client landing on
  // this freelancer-facing route directly would otherwise see a confusing
  // freelancer-oriented view of their own booking. RLS already scopes data
  // access; this is purely a UX redirect to the right page.
  useEffect(() => {
    if (!booking || !user?.id || booking.freelancer_id === user.id) {
      return;
    }
    if (booking.client_id === user.id) {
      navigate(`/booking/${booking.id}`, { replace: true });
    }
  }, [booking, user?.id, navigate]);

  const [completionText, setCompletionText] = useState('');
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  const [showRespondForm, setShowRespondForm] = useState(false);
  const [respondReason, setRespondReason] = useState('');
  const [respondFiles, setRespondFiles] = useState<File[]>([]);
  const [isResponding, setIsResponding] = useState(false);

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

    const response = await DataService.respondToBookingDispute(booking.id, {
      actor: 'freelancer',
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

  const viewerCurrency = normalizeCurrencyCode(preferredCurrency, 'THB');
  const formatMoney = (amount: number) => {
    const converted = convertAmount(Number(amount || 0), 'THB', viewerCurrency);
    return formatCurrencyAmount(converted, viewerCurrency);
  };

  const canRespondToDispute = booking?.dispute_status === 'open' && booking.dispute_awaiting === 'freelancer';

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
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors">
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
          <button onClick={onBack} className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors mb-3">
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">Booking Tracking</h1>
          <p className="text-sm text-gray-600">{bookingData.bookingId}</p>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Client Profile Preview */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar
              src={bookingData.client.image}
              alt={bookingData.client.name}
              gender={bookingData.client.gender}
              sizeClassName="w-16 h-16 ring-2 ring-gray-200 rounded-full flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">{bookingData.client.name}</h2>
              <p className="text-sm text-gray-600">Client</p>
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
              The client didn't pay the deposit within 24 hours of acceptance, so this booking was automatically cancelled.
            </p>
          </div>
        )}

        {/* Awaiting deposit */}
        {escrowState === 'awaiting_deposit' && (
          <div className="rounded-2xl shadow-lg border-2 border-gray-900 bg-gradient-to-br from-gray-900 to-black text-white p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-6 h-6 text-white" />
              <h2 className="font-bold text-lg text-white">Waiting for Deposit</h2>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              The client has 24 hours to transfer the deposit. If they don't, this booking is cancelled automatically.
            </p>
            {formatCountdown(booking.deposit_deadline) && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                <Clock className="h-4 w-4 flex-shrink-0 text-amber-300" />
                <p className="text-sm font-bold text-amber-300">{formatCountdown(booking.deposit_deadline)} left for the client to pay</p>
              </div>
            )}
            <div className="bg-white rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Deposit Amount</span>
                <span className="text-2xl font-bold text-gray-900">{formatMoney(bookingData.pricing.deposit)}</span>
              </div>
              <p className="text-xs text-gray-500">You'll be notified as soon as it's paid</p>
            </div>
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
              <p className="mb-3 text-xs font-semibold text-amber-600">
                ⏱ {formatCountdown(booking.client_response_deadline)} for the client to respond, or the deposit auto-releases to you
              </p>
            )}
            {booking.completion_evidence_text && <p className="mb-3 text-sm text-gray-700">{booking.completion_evidence_text}</p>}
            {(booking.completion_evidence_photos || []).length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                {(booking.completion_evidence_photos as string[]).map((path) => (
                  <div key={path} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                    {signedUrls[path] ? (
                      <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Camera className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">Waiting for the client to confirm or report a problem.</p>
          </div>
        )}

        {/* Disputed */}
        {escrowState === 'disputed' && (
          <div className="rounded-2xl shadow-lg border-2 border-amber-400 bg-white p-5 mb-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              <h2 className="font-bold text-lg text-gray-900">Dispute</h2>
            </div>
            {formatCountdown(booking.dispute_response_deadline) && (
              <p className="mb-3 text-xs font-semibold text-amber-600">
                ⏱ {formatCountdown(booking.dispute_response_deadline)} for {booking.dispute_awaiting === 'freelancer' ? 'you' : 'the client'} to respond
              </p>
            )}

            <DisputeTimeline events={events} signedUrls={signedUrls} />

            {canRespondToDispute && !showRespondForm && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleConcede()}
                  disabled={isResponding}
                  className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                >
                  I don't have evidence
                </button>
                <button
                  onClick={() => setShowRespondForm(true)}
                  className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Respond with Evidence
                </button>
              </div>
            )}

            {canRespondToDispute && showRespondForm && (
              <div className="rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-gray-900">Respond with Evidence</p>
                  <button onClick={() => setShowRespondForm(false)} className="text-gray-400 hover:text-gray-900">
                    <X className="h-4 w-4" />
                  </button>
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
                Waiting for {booking.dispute_awaiting === 'freelancer' ? 'you' : 'the client'} to respond.
              </p>
            )}
          </div>
        )}

        {/* Under admin review */}
        {escrowState === 'under_admin_review' && (
          <div className="rounded-2xl shadow-lg border-2 border-gray-900 bg-white p-5 mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="w-6 h-6 text-gray-900" />
              <h2 className="font-bold text-lg text-gray-900">Under Review</h2>
            </div>
            <p className="text-sm text-gray-600">
              This dispute is under review by CreativeHUB support. You'll be notified as soon as a decision is made.
            </p>
            <DisputeTimeline events={events} signedUrls={signedUrls} />
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
                <p className="text-xs text-gray-600">The deposit has been transferred to you</p>
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

        {(escrowState === 'released' || escrowState === 'refunded') && user?.id && (
          <BookingReviewPrompt
            bookingId={booking.id}
            viewerId={user.id}
            revieweeId={booking.client_id}
            revieweeName={bookingData.client.name}
          />
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
                {escrowState === 'awaiting_deposit' && <p className="text-xs text-gray-500 mt-0.5">Not yet paid by the client</p>}
                {booking.deposit_paid_via && <p className="text-xs text-gray-500 mt-0.5">Paid via {booking.deposit_paid_via}</p>}
              </div>
              <span className="font-semibold text-gray-900">{formatMoney(bookingData.pricing.deposit)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total Booking Cost</span>
              <span className="font-bold text-gray-900 text-xl">{formatMoney(bookingData.pricing.total)}</span>
            </div>
          </div>
        </div>

        {/* Payout Protection Info */}
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-lg p-5 text-white">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Payout Protection
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Deposit is secured by the client before work needs to start</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Automatically released to you after the client confirms, or after 7 days of silence</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">If disputed, you can submit evidence before any refund is decided</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
