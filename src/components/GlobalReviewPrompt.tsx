import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from '../lib/dataService';
import { Avatar } from './common/Avatar';
import { DEFAULT_AVATAR_URL } from '../lib/defaults';

// A site-wide "rate your experience" popup, mounted once alongside
// MobileBottomNav rather than inside any one page — a review used to be
// reachable only by remembering to revisit that specific booking's
// tracking page (BookingReviewPrompt), which most people never do once a
// booking is done. This surfaces the same prompt proactively, for at most
// one finished (deposit released/refunded), not-yet-reviewed, not-yet-
// dismissed booking at a time, wherever the user happens to be browsing.
export function GlobalReviewPrompt() {
  const { user } = useAuth();
  const role = user?.role === 'freelancer' ? 'freelancer' : 'client';
  const [booking, setBooking] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNext = async (userId: string) => {
    const response = await DataService.getNextBookingAwaitingReview(userId, role);
    setBooking(response.data);
    setRating(5);
    setComment('');
    setError(null);
  };

  useEffect(() => {
    if (!user?.id || (user.role !== 'client' && user.role !== 'freelancer')) {
      setBooking(null);
      return;
    }
    void loadNext(user.id);
    // Only re-checks when the signed-in user changes — this is a one-shot,
    // site-wide prompt rather than something polling every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user?.id || !booking) {
    return null;
  }

  const otherParty = role === 'client' ? booking.freelancer : booking.client;
  const otherPartyName = otherParty?.full_name || (role === 'client' ? 'this freelancer' : 'this client');

  const handleCancel = async () => {
    setIsDismissing(true);
    await DataService.dismissReviewPrompt(booking.id, role);
    setIsDismissing(false);
    void loadNext(user.id);
  };

  const handleSubmit = async () => {
    if (!otherParty?.id) return;

    setIsSubmitting(true);
    setError(null);

    const response = await DataService.createReview({
      booking_id: booking.id,
      reviewer_id: user.id,
      reviewee_id: otherParty.id,
      rating,
      comment: comment.trim() || null,
    });

    setIsSubmitting(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit review.');
      return;
    }

    void loadNext(user.id);
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900">Rate your experience</h3>
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={isDismissing}
            aria-label="Dismiss"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Avatar src={otherParty?.avatar_url || DEFAULT_AVATAR_URL} alt={otherPartyName} sizeClassName="h-12 w-12" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{otherPartyName}</p>
            <p className="truncate text-xs text-gray-500">{booking.project_name}</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              className="p-1"
            >
              <Star className={`h-8 w-8 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={`Write a short review of ${otherPartyName}... (optional)`}
          className="mt-4 min-h-[80px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={isDismissing}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
