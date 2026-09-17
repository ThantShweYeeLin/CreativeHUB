import { AlertCircle, Ban, ChevronLeft, ChevronRight, CheckCircle, Clock, FileText, Shield, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { formatCountdown } from '../../lib/bookingEscrow';
import { formatCardLabel } from '../../lib/paymentCard';
import { PaymentMethodPicker, type PaymentMethod } from '../components/payments/PaymentMethodPicker';
import { useBookingTracking } from './bookingTracking/useBookingTracking';
import { AttendanceCheck } from './bookingTracking/AttendanceCheck';
import { AttendanceTimeline } from './bookingTracking/AttendanceTimeline';
import { DisputeTimeline } from './bookingTracking/DisputeTimeline';
import { ReportProblemFlow } from './bookingTracking/ReportProblemFlow';
import { BookingReviewPrompt } from './bookingTracking/BookingReviewPrompt';
import type { DisputeFlowCategory } from '../../lib/disputeCategories';
import { RescheduleCard, isBookingRescheduleEligible } from './bookingTracking/RescheduleCard';
import { DeliveryCard, isDeliveryCardEligible } from './bookingTracking/DeliveryCard';
import { checkGroupDepositsAndCreateChat } from '../../lib/groupDepositChat';

interface BookingTrackingClientPageProps {
  onBack: () => void;
}

export function BookingTrackingClientPage({ onBack }: BookingTrackingClientPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency: preferredCurrency } = useCurrency();
  const { booking, events, disputeEvidence, confirmations, attendanceReport, signedUrls, isLoading, error, setError, refresh, escrowState, bookingData } = useBookingTracking();

  // This is the CLIENT-facing tracking page — a freelancer landing here
  // directly (e.g. an old link, a manually edited URL) would otherwise see
  // a confusing client-oriented view of their own booking, including
  // themselves rendered as if they were someone else's freelancer. RLS
  // already prevents anyone unrelated from reading the booking at all, so
  // this is purely a UX redirect to the right page, not an access check.
  useEffect(() => {
    if (!booking || !user?.id || booking.client_id === user.id) {
      return;
    }
    if (booking.freelancer_id === user.id) {
      navigate(`/freelancer-booking/${booking.id}`, { replace: true });
    }
  }, [booking, user?.id, navigate]);

  // Lets a notification link straight to a specific section (e.g.
  // "#attendance-check" from an attendance_window_open notification,
  // "#deposit-section" from a deposit_payment_required one) instead of just
  // landing on top of the page — waits for `booking` so the target section
  // has actually rendered (it's conditional on escrowState) before scrolling.
  useEffect(() => {
    if (!booking || !window.location.hash) {
      return;
    }
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [booking]);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isPayingDeposit, setIsPayingDeposit] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [isConfirming, setIsConfirming] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeInitialCategory, setDisputeInitialCategory] = useState<DisputeFlowCategory | undefined>(undefined);

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

    // refresh() re-fetches via getBooking(), which includes the
    // freelancer/client joins — payBookingDeposit's own response is a plain
    // row update with no joined relations, so setting state from it
    // directly briefly showed the freelancer's name as the generic
    // "CreativeHUB Freelancer" fallback until something else happened to
    // reload the page.
    await refresh();

    if (user?.id) {
      await checkGroupDepositsAndCreateChat(response.data, user.id);
    }
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

  const renderDisputeForm = () =>
    booking && user?.id ? (
      <ReportProblemFlow
        bookingId={booking.id}
        userId={user.id}
        booking={booking}
        events={events}
        confirmations={confirmations}
        role="client"
        otherPartyId={booking.freelancer_id}
        otherPartyName={bookingData?.freelancer.name || 'the freelancer'}
        initialCategory={disputeInitialCategory}
        onClose={() => {
          setShowDisputeForm(false);
          setDisputeInitialCategory(undefined);
        }}
        onSubmitted={async () => {
          setShowDisputeForm(false);
          setDisputeInitialCategory(undefined);
          await refresh();
        }}
      />
    ) : null;

  if (isLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <PageBackdrop />
        <div className="relative z-10 h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
      </div>
    );
  }

  if (error && !bookingData) {
    return (
      <div className="relative min-h-screen p-6">
        <PageBackdrop />
        <div className="relative z-10 mx-auto max-w-[600px] rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
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
    <div className="relative min-h-screen pb-20">
      <PageBackdrop />
      <div className="relative z-10">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-sky-100">
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
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar
              src={bookingData.freelancer.image}
              alt={bookingData.freelancer.name}
              gender={bookingData.freelancer.gender}
              sizeClassName="w-16 h-16 ring-2 ring-sky-100 rounded-full flex-shrink-0"
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

          <div className="bg-sky-50/60 rounded-xl p-4 space-y-2">
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

        {(escrowState === 'deposit_secured' || escrowState === 'awaiting_client_confirmation') && (
          <div id="attendance-check">
            <AttendanceCheck
              bookingId={booking.id}
              scheduledAt={bookingData.scheduledAt}
              role="client"
              confirmations={confirmations}
              report={attendanceReport}
              onRefresh={refresh}
              onReportProblem={() => {
                setDisputeInitialCategory(undefined);
                setShowDisputeForm(true);
              }}
            />
            <AttendanceTimeline
              events={events}
              confirmations={confirmations}
              report={attendanceReport}
              scheduledAt={bookingData.scheduledAt}
            />
          </div>
        )}

        {user?.id && isBookingRescheduleEligible(escrowState) && (
          <RescheduleCard booking={booking} role="client" userId={user.id} onRefresh={refresh} />
        )}

        {isDeliveryCardEligible(escrowState) && (
          <DeliveryCard
            booking={booking}
            role="client"
            onRefresh={refresh}
            canReportDeliveryIssue={
              (escrowState === 'deposit_secured' || escrowState === 'awaiting_client_confirmation') && booking.dispute_status === 'none'
            }
            onReportDeliveryIssue={() => {
              setDisputeInitialCategory('deliverables_not_received');
              setShowDisputeForm(true);
            }}
          />
        )}

        {/* Annulled */}
        {escrowState === 'annulled' && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-red-900">Booking Annulled</h2>
            </div>
            <p className="text-sm text-red-700">
              The deposit wasn't paid within 24 hours of acceptance, so this booking was automatically annulled and the
              freelancer's availability for that time was released.
            </p>
          </div>
        )}

        {/* Awaiting deposit — 24-hour payment window */}
        {escrowState === 'awaiting_deposit' && (
          <div id="deposit-section" className="rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border-2 border-sky-400 bg-gradient-to-br from-sky-500 to-blue-600 text-white p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-6 h-6 text-white" />
              <h2 className="font-bold text-lg text-white">Deposit Transfer Required</h2>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              This time slot is reserved for your booking until the deadline below. Transfer the deposit to confirm it —
              the deposit will be held safely and released to the freelancer after service completion.
            </p>
            {formatCountdown(booking.deposit_deadline) && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                <Clock className="h-4 w-4 flex-shrink-0 text-amber-300" />
                <p className="text-sm font-bold text-amber-300">
                  {formatCountdown(booking.deposit_deadline)} left to pay — if it isn't paid in time, the booking will be
                  automatically annulled and this time slot released.
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
              className="w-full bg-white text-gray-900 py-3 px-4 rounded-xl font-bold hover:bg-sky-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPayingDeposit ? 'Transferring...' : `Transfer ${formatMoney(bookingData.pricing.deposit)} Deposit Now`}
            </button>
          </div>
        )}

        {/* Deposit secured, freelancer hasn't marked complete yet */}
        {escrowState === 'deposit_secured' && (
          <div className="rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border-2 border-sky-400 bg-white p-5 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center">
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
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-50 py-3 px-4 text-sm font-semibold text-gray-700 hover:bg-sky-100 transition-all"
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
          <div className="rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border-2 border-sky-400 bg-white p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-6 h-6 text-sky-600" />
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
                  <div key={path} className="aspect-square overflow-hidden rounded-lg bg-sky-50">
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
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-60"
                >
                  <CheckCircle className="w-5 h-5" />
                  {isConfirming ? 'Confirming...' : 'Confirm Completion'}
                </button>
                <button
                  id="report-a-problem-button"
                  onClick={() => setShowDisputeForm(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-50 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-sky-100 transition-all"
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

            <DisputeTimeline events={events} signedUrls={signedUrls} disputeEvidence={disputeEvidence} />

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
                  className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
                >
                  Still Not Satisfied
                </button>
              </div>
            )}

            {canRespondToDispute && showRespondForm && (
              <div className="rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
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
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  onClick={() => void handleStillNotSatisfied()}
                  disabled={isResponding}
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
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
          <div className="rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border-2 border-sky-400 bg-white p-5 mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="w-6 h-6 text-gray-900" />
              <h2 className="font-bold text-lg text-gray-900">Report Submitted</h2>
            </div>
            <p className="text-sm text-gray-600">Your report has been submitted. Our team will review it and follow up within 5 business days.</p>
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
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 p-5 mb-6">
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
            <div className="border-t border-sky-100 pt-3 mt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total Booking Cost</span>
              <span className="font-bold text-gray-900 text-xl">{formatMoney(bookingData.pricing.total)}</span>
            </div>
          </div>

          {escrowState !== 'released' && escrowState !== 'refunded' && escrowState !== 'annulled' && (
            <div className="mt-4 bg-sky-50/60 rounded-xl p-4">
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
        <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl shadow-lg p-5 text-white">
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
    </div>
  );
}
