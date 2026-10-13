// System-calculated trust signal for freelancer profiles. Freelancers never
// set this themselves — it's derived from verification status, profile
// completeness, portfolio depth, and reputation.
export interface TrustLevelInput {
  rating: number;
  totalReviews: number;
  portfolioCount: number;
  phoneVerified: boolean;
  identityStatus: 'not_submitted' | 'pending' | 'verified' | string;
  profileCompletenessFields: {
    hasBio: boolean;
    hasAvatar: boolean;
    hasServices: boolean;
    hasSkills: boolean;
    hasPricing: boolean;
    hasAvailability: boolean;
  };
  // Bookings this freelancer themselves cancelled (bookings.cancelled_by =
  // their own id - never a client-initiated cancellation, which isn't
  // their fault to be penalized for). Always recomputed from real booking
  // history, same as every other input here - there's no separately
  // stored, decaying "penalty" counter to drift out of sync with it.
  freelancerCancellationCount: number;
}

export interface TrustLevel {
  score: number;
  stars: number;
  label: 'New' | 'Building Trust' | 'Trusted' | 'Highly Trusted' | 'Top Rated';
}

export function computeTrustLevel(input: TrustLevelInput): TrustLevel {
  let score = 0;

  // Verification — a confirmed email is already required to have a profile
  // at all in this app, so it contributes a flat baseline rather than a
  // meaningfully variable signal. Phone/identity are the variable ones.
  score += 15;
  if (input.phoneVerified) score += 10;
  if (input.identityStatus === 'verified') score += 10;

  // Profile completeness — 5 points per completed field, 6 fields tracked.
  const completedFields = Object.values(input.profileCompletenessFields).filter(Boolean).length;
  score += completedFields * 5;

  // Portfolio depth, capped at 3 items.
  score += Math.min(input.portfolioCount, 3) * 5;

  // Reputation, weighted by review volume so one 5-star review doesn't
  // outrank a freelancer with many solid reviews.
  if (input.totalReviews > 0) {
    score += (input.rating / 5) * 15;
    score += Math.min(input.totalReviews, 10);
  }

  // Cancelling a booking you already committed to is the one thing here
  // that's a direct action, not a passive signal - weighted accordingly
  // (8 points is roughly half a completeness field's worth of a single
  // review), capped at 5 so a freelancer with a rough patch years ago
  // isn't permanently floored once they've since built up everything else.
  score -= Math.min(input.freelancerCancellationCount, 5) * 8;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));
  const label: TrustLevel['label'] =
    score >= 85 ? 'Top Rated' : score >= 65 ? 'Highly Trusted' : score >= 40 ? 'Trusted' : score >= 15 ? 'Building Trust' : 'New';

  return { score, stars, label };
}
