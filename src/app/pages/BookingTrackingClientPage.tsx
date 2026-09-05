import { AlertCircle, Ban, ChevronLeft, ChevronRight, CheckCircle, Clock, FileText, Shield, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { formatCountdown } from '../../lib/bookingEscrow';
import { formatCardLabel } from '../../lib/paymentCard';
import { PaymentMethodPicker, type PaymentMethod } from '../components/payments/PaymentMethodPicker';
import { useBookingTracking } from './bookingTracking/useBookingTracking';
import { DisputeTimeline } from './bookingTracking/DisputeTimeline';
import { BookingReviewPrompt } from './bookingTracking/BookingReviewPrompt';

interface BookingTrackingClientPageProps {
  onBack: () => void;
}

export function BookingTrackingClientPage({ onBack }: BookingTrackingClientPageProps) {
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const { booking, setBooking, events, signedUrls, isLoading, error, setError, refresh, escrowState, bookingData } = useBookingTracking();

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isPayingDeposit, setIsPayingDeposit] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [isConfirming, setIsConfirming] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<'no_show' | 'not_performed' | 'differed_from_agreement' | 'other'>('no_show');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFiles, setDisputeFiles] = useState<File[]>([]);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const [showRespondForm, setShowRespondForm] = useState(false);
  const [respondReason, setRespondReason] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const handleTransferDeposit = async () => {
    if (!booking || !selectedPaymentMethodId) return;
    const method = paymentMethods.find((m) => m.id === selectedPaymentMethodId);
    if (!method) return;

    setIsPayingDeposit(true);
    setError(null);

    const response = await DataService.payBookingDeposit(booking.id, { cardLabel: formatCardLabel(method) });

    setIsPayingDeposit(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to transfer deposit.');
      return;
    }

    setBooking(response.data);
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
    if (!booking || !user?.id || !disputeReason.trim()) {
      setError('Describe the problem before submitting.');
      return;
    }
    setIsSubmittingDispute(true);
    setError(null);

    const photoPaths: string[] = [];
    for (const file of disputeFiles) {
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(user.id, booking.id, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setError('Unable to upload one of the evidence photos.');
        setIsSubmittingDispute(false);
        return;
      }
      photoPaths.push(uploadResponse.path);
    }

    const response = await DataService.openBookingDispute(booking.id, {
      category: disputeCategory,
      reason: disputeReason.trim(),
      evidencePhotoPaths: photoPaths,
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

  const handleStillNotSatisfied = async () => {
    if (!booking) return;
    setIsResponding(true);
    setError(null);

    const response = await DataService.respondToBookingDispute(booking.id, {
      actor: 'client',
      hasEvidence: true,
      reason: respondReason,
    });

    setIsResponding(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit response.');
      return;
    }

    setShowRespondForm(false);
    setRespondReason('');
    await refresh();
  };

  const viewerCurrency = normalizeCurrencyCode(preferredCurrency, 'THB');
  const formatMoney = (amount: number) => {
    const converted = convertAmount(Number(amount || 0), 'THB', viewerCurrency);
    return formatCurrencyAmount(converted, viewerCurrency);
  };

  const canRespondToDispute = booking?.dispute_status === 'open' && booking.dispute_awaiting === 'client';
  // No known schedule data at all shouldn't permanently block a client from
  // ever reporting a problem - default to allowing it in that case.
  const hasScheduledTimePassed = !bookingData?.scheduledAt || bookingData.scheduledAt.getTime() <= Date.now();

  const renderDisputeForm = () => (
    <div className="mt-2 rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-bold text-gray-900">Report a Problem</p>
        <button onClick={() => setShowDisputeForm(false)} className="text-gray-400 hover:text-gray-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">Reason</label>
      <select
        value={disputeCategory}
        onChange={(e) => setDisputeCategory(e.target.value as any)}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
      >
        <option value="no_show">Freelancer did not show up</option>
        <option value="not_performed">Freelancer did not perform the service</option>
        <option value="differed_from_agreement">Service significantly differed from agreement</option>
        <option value="other">Other</option>
      </select>
      <label className="mb-1 block text-xs font-semibold text-gray-600">What went wrong?</label>
      <textarea
        value={disputeReason}
        onChange={(e) => setDisputeReason(e.target.value)}
        placeholder="Describe the issue in detail..."
        className="mb-3 w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
      />
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Evidence (optional) — screenshots, photos, etc.</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setDisputeFiles(Array.from(e.target.files || []).slice(0, 6))}
          className="text-xs"
        />
        {disputeFiles.length > 0 && <p className="mt-1 text-xs text-gray-500">{disputeFiles.length} file(s) selected</p>}
      </div>
      <button
        onClick={() => void handleSubmitDispute()}
        disabled={isSubmittingDispute}
        className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
      >
        {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
      </button>
    </div>
  );

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

        {/* Awaiting deposit — 24-hour payment window */}
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
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                <Clock className="h-4 w-4 flex-shrink-0 text-amber-300" />
                <p className="text-sm font-bold text-amber-300">
                  {formatCountdown(booking.deposit_deadline)} left to pay — the request will be cancelled automatically after that.
                </p>
              </div>
            )}
            <div className="bg-white rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Deposit Amount</span>
                <span className="text-2xl font-bold text-gray-900">{formatMoney(bookingData.pricing.deposit)}</span>
              </div>
              <p className="text-xs text-gray-500">This amount will be held until service completion</p>
            </div>

            {user?.id && (
              <div className="mb-4 rounded-xl bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-gray-900">Pay with</p>
                <PaymentMethodPicker
                  userId={user.id}
                  selectable
                  selectedId={selectedPaymentMethodId}
                  onSelectedIdChange={(pmId) => setSelectedPaymentMethodId(pmId || null)}
                  onMethodsChange={setPaymentMethods}
                />
              </div>
            )}

            <button
              onClick={() => void handleTransferDeposit()}
              disabled={isPayingDeposit || !selectedPaymentMethodId}
              className="w-full bg-white text-gray-900 py-3 px-4 rounded-xl font-bold hover:bg-gray-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPayingDeposit ? 'Transferring...' : `Transfer ${formatMoney(bookingData.pricing.deposit)} Deposit Now`}
            </button>
          </div>
        )}

        {/* Deposit secured, freelancer hasn't marked complete yet */}
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
            <p className="mt-2 text-xs text-gray-500">Waiting for the freelancer to mark this booking complete.</p>

            {hasScheduledTimePassed && !showDisputeForm && (
              <button
                onClick={() => setShowDisputeForm(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-all"
              >
                <AlertCircle className="w-4 h-4" />
                Report a Problem
              </button>
            )}
            {hasScheduledTimePassed && showDisputeForm && renderDisputeForm()}
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
                ⏱ {formatCountdown(booking.client_response_deadline)} to respond, or the deposit auto-releases
              </p>
            )}
            {booking.completion_evidence_text && <p className="mb-3 text-sm text-gray-700">{booking.completion_evidence_text}</p>}
            {(booking.completion_evidence_photos || []).length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                {(booking.completion_evidence_photos as string[]).map((path) => (
                  <div key={path} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                    {signedUrls[path] && <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />}
                  </div>
                ))}
              </div>
            )}

            {!showDisputeForm && (
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

            {showDisputeForm && renderDisputeForm()}
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
                ⏱ {formatCountdown(booking.dispute_response_deadline)} for {booking.dispute_awaiting === 'freelancer' ? 'the freelancer' : 'you'} to respond
              </p>
            )}

            <DisputeTimeline events={events} signedUrls={signedUrls} />

            {canRespondToDispute && !showRespondForm && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleConfirmCompletion()}
                  disabled={isConfirming}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" /> Accept & Confirm
                </button>
                <button
                  onClick={() => setShowRespondForm(true)}
                  className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Still Not Satisfied
                </button>
              </div>
            )}

            {canRespondToDispute && showRespondForm && (
              <div className="rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-gray-900">Explain why you still want a refund</p>
                  <button onClick={() => setShowRespondForm(false)} className="text-gray-400 hover:text-gray-900">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  This will freeze the deposit and send your case to CreativeHUB support for a final decision.
                </p>
                <textarea
                  value={respondReason}
                  onChange={(e) => setRespondReason(e.target.value)}
                  placeholder="Explain your side..."
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => void handleStillNotSatisfied()}
                  disabled={isResponding}
                  className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
                >
                  {isResponding ? 'Submitting...' : 'Submit to Support'}
                </button>
              </div>
            )}

            {!canRespondToDispute && (
              <p className="text-xs text-gray-500">
                Waiting for {booking.dispute_awaiting === 'freelancer' ? 'the freelancer' : 'you'} to respond.
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
              Your dispute is under review by CreativeHUB support. You'll be notified as soon as a decision is made.
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
                <p className="text-xs text-gray-600">The deposit was refunded to you following a dispute.</p>
              </div>
            </div>
          </div>
        )}

        {(escrowState === 'released' || escrowState === 'refunded') && user?.id && (
          <BookingReviewPrompt
            bookingId={booking.id}
            viewerId={user.id}
            revieweeId={booking.freelancer_id}
            revieweeName={bookingData.freelancer.name}
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
                {escrowState === 'awaiting_deposit' && <p className="text-xs text-gray-500 mt-0.5">Not yet paid</p>}
                {booking.deposit_paid_via && <p className="text-xs text-gray-500 mt-0.5">Paid via {booking.deposit_paid_via}</p>}
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
