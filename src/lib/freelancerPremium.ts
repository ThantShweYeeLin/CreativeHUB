// Freelancer Premium: plan display + small helpers. The entitlement itself is
// enforced in Postgres/the server (supabase/freelancer_premium.sql,
// server/src/routes/subscriptions.ts) - nothing here grants access, it only
// reflects what the server says. Prices shown here are display copy; the
// server charges from its own plan table.

export type PremiumPlan = 'monthly' | 'annual';

export const PREMIUM_PLANS: Record<PremiumPlan, { label: string; priceThb: number; period: string; note?: string }> = {
  monthly: { label: 'Monthly', priceThb: 99, period: 'month' },
  annual: { label: 'Yearly', priceThb: 999, period: 'year', note: 'Save ฿189 compared with paying monthly' },
};

export interface FreelancerSubscription {
  user_id: string;
  plan: PremiumPlan;
  status: 'active' | 'cancelled';
  current_period_end: string;
  cancelled_at: string | null;
}

export function isSubscriptionActive(subscription: FreelancerSubscription | null | undefined, now = Date.now()) {
  return !!subscription && new Date(subscription.current_period_end).getTime() > now;
}

// Stable codes the Postgres functions raise so the UI can react to them.
export type OpportunityErrorCode = 'PREMIUM_REQUIRED' | 'ALREADY_APPLIED' | 'ROLE_FILLED' | 'NOT_ELIGIBLE';

export function opportunityErrorCode(message: string | undefined | null): OpportunityErrorCode | null {
  const match = (message || '').match(/PREMIUM_REQUIRED|ALREADY_APPLIED|ROLE_FILLED|NOT_ELIGIBLE/);
  return (match?.[0] as OpportunityErrorCode | undefined) ?? null;
}

export const OPPORTUNITY_ERROR_MESSAGE: Record<OpportunityErrorCode, string> = {
  PREMIUM_REQUIRED: 'An active Premium subscription is needed to apply to Group Requests.',
  ALREADY_APPLIED: "You've already applied to this request.",
  ROLE_FILLED: 'This role has already been filled.',
  NOT_ELIGIBLE: "This role doesn't match your profile, location or availability.",
};

export interface OpportunityRole {
  id: string;
  category: string;
  budget: number;
  currency: string;
  styles: string[];
  slots: number;
  slots_filled: number;
  note: string | null;
  eligible: boolean;
}

export interface GroupOpportunity {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location_city: string | null;
  status: 'open' | 'closed';
  created_at: string;
  has_applied: boolean;
  roles: OpportunityRole[];
}

export interface GroupApplication {
  id: string;
  opportunity_id: string;
  title: string;
  event_date: string;
  location_city: string | null;
  category: string;
  proposed_price: number;
  currency: string;
  message: string | null;
  request_status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'countered' | 'cancelled' | null;
  counter_by: 'client' | 'freelancer' | null;
  counter_price: number | null;
  applied_at: string;
  updated_at: string | null;
}

// What the applicant sees. The underlying request keeps its existing statuses
// so the client's normal review/accept flow is unchanged.
export function applicationStatusLabel(app: Pick<GroupApplication, 'request_status' | 'counter_by'>): { label: string; tone: 'amber' | 'blue' | 'green' | 'red' | 'gray' } {
  switch (app.request_status) {
    case 'accepted':
    case 'completed':
      return { label: 'Accepted', tone: 'green' };
    case 'rejected':
      return { label: 'Declined', tone: 'red' };
    case 'cancelled':
      return { label: 'Withdrawn by client', tone: 'gray' };
    case 'countered':
      return app.counter_by === 'client' ? { label: 'Counter-offer received', tone: 'blue' } : { label: 'Under review', tone: 'amber' };
    default:
      return { label: 'Under review', tone: 'amber' };
  }
}

// Errors accept_group_application() raises (supabase/premium_hardening.sql).
export const ACCEPT_APPLICATION_ERROR_MESSAGE: Record<string, string> = {
  ROLE_FILLED: 'All spots for this role are already filled.',
  ALREADY_ACCEPTED: 'This application has already been accepted.',
  OPPORTUNITY_CLOSED: 'This Group Request is closed or its date has passed.',
  REQUEST_NOT_OPEN: 'This application is no longer open.',
  BOOKING_SLOT_TAKEN: 'This time slot is no longer available — the freelancer was just booked for it.',
};

export function acceptApplicationErrorMessage(message: string | undefined | null): string | null {
  const code = Object.keys(ACCEPT_APPLICATION_ERROR_MESSAGE).find((key) => (message || '').includes(key));
  return code ? ACCEPT_APPLICATION_ERROR_MESSAGE[code] : null;
}
