// Reads the same localStorage blob SettingsPage.tsx writes
// (creativehub.settings.v1) for the handful of preferences that are
// legitimately per-device rather than needing to be visible to other users
// (contrast with phone/hide_email_from_public/hide_phone_from_public, which
// had to become real users columns since they describe what OTHER people
// see about you, not just your own browsing experience). Mirrors
// MapExplorePage.tsx's getMapLanguagePreference() - same storage key, same
// defensive JSON.parse, same safe fallback on anything malformed.

const SETTINGS_STORAGE_KEY = 'creativehub.settings.v1';

function readSettingsBlob(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getDistanceUnitPreference(): 'km' | 'miles' {
  const unit = readSettingsBlob()?.preferences?.distanceUnit;
  return unit === 'miles' ? 'miles' : 'km';
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/** Formats a km value as "X km away" or "X mi away" per the viewer's own saved preference. */
export function formatDistanceAway(km: number): string {
  if (getDistanceUnitPreference() === 'miles') {
    return `${kmToMiles(km).toFixed(1)} mi away`;
  }
  return `${km.toFixed(1)} km away`;
}

// The 4 in-app notification categories from SettingsPage.tsx's Notifications
// section, and which raw notification `type` values (see
// NotificationsPanel.tsx's getNotificationIcon switch for the full list of
// types that exist) each one covers. Anything not covered by one of these
// four is left alone and always shown - these checkboxes were never meant
// to be a kill-switch for every notification type, only the four they
// literally name.
const NOTIFICATION_TYPE_CATEGORY: Record<string, 'appMessages' | 'appBookingStatus' | 'appAIMatches' | 'appReviews'> = {
  message: 'appMessages',
  request: 'appBookingStatus',
  request_accepted: 'appBookingStatus',
  request_rejected: 'appBookingStatus',
  booking_cancelled: 'appBookingStatus',
  booking_disputed: 'appBookingStatus',
  booking_completed: 'appBookingStatus',
  booking_deposit_paid: 'appBookingStatus',
  payment_update: 'appBookingStatus',
  deposit_secured: 'appBookingStatus',
  payment_released: 'appBookingStatus',
  ai_match_results: 'appAIMatches',
  portfolio_matched_ai: 'appAIMatches',
  review: 'appReviews',
};

export function shouldShowInAppNotificationType(type: string): boolean {
  const category = NOTIFICATION_TYPE_CATEGORY[type];
  if (!category) return true;

  const prefs = readSettingsBlob()?.notifications;
  // No saved prefs yet (never opened Settings) - defaultNotifications in
  // SettingsPage.tsx has every one of these on, so an unset value means on.
  if (!prefs || typeof prefs[category] !== 'boolean') return true;
  return prefs[category];
}
