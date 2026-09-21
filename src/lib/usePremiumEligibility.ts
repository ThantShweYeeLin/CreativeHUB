import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from './dataService';
import { isSubscriptionActive } from './freelancerPremium';

/**
 * True only for a signed-in freelancer with no active Premium - the audience
 * for Premium promotions. Purely a UI hint (who to advertise to); it grants
 * nothing. Stays false while loading, so nothing flashes for Premium users.
 */
export function usePremiumPromoAudience(): boolean {
  const { user } = useAuth();
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEligible(false);
    if (!user?.id || user.role !== 'freelancer') return;
    void DataService.getMySubscription(user.id).then(({ data }) => {
      if (!cancelled) setEligible(!isSubscriptionActive(data));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  return eligible;
}
