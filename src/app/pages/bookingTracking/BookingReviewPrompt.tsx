import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { DataService } from '../../../lib/dataService';

interface BookingReviewPromptProps {
  bookingId: string;
  viewerId: string;
  revieweeId: string;
  revieweeName: string;
}

// Surfaces the review form directly on the terminal (released/refunded)
// booking-tracking state, on both the client and freelancer pages. Reviews
// used to be reachable only from inside an existing Messages conversation
// via a separate, disconnected "End Session" action - most bookings never
// went through that path, so the review system was effectively dead for
// them. This reuses the same DataService.createReview/hasReviewForBooking
// calls that Messages page already used.
export function BookingReviewPrompt({ bookingId, viewerId, revieweeId, revieweeName }: BookingReviewPromptProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    DataService.hasReviewForBooking(bookingId, viewerId).then(({ exists }) => {
      if (isMounted) {
        setHasReviewed(exists);
        setIsChecking(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [bookingId, viewerId]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const response = await DataService.createReview({
      booking_id: bookingId,
      reviewer_id: viewerId,
      reviewee_id: revieweeId,
      rating,
      comment: comment.trim() || null,
    });

    setIsSubmitting(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit review.');
      return;
    }

    setHasReviewed(true);
  };

  if (isChecking) return null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
      <h2 className="mb-3 font-bold text-gray-900">
        {hasReviewed ? 'Your Review' : `Rate your experience with ${revieweeName}`}
      </h2>
      {hasReviewed ? (
        <p className="text-sm text-gray-600">Thanks — your review has been submitted.</p>
      ) : (
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                className="p-0.5"
              >
                <Star className={`h-6 w-6 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={`Write a short review of ${revieweeName}...`}
            className="min-h-[80px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3 font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}
    </div>
  );
}
