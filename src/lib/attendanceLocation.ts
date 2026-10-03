// One-shot location for arrival check-in. Deliberately not watchPosition:
// CreativeHUB records where someone was at the moment they checked in, never
// tracks them afterwards. Must be called synchronously from a tap handler so
// the browser's permission prompt is treated as a user gesture.

export type ArrivalNotProvidedReason = 'permission_denied' | 'position_unavailable' | 'timeout' | 'not_supported';

export type ArrivalLocation =
  | { status: 'provided'; latitude: number; longitude: number; accuracyM: number | null }
  | { status: 'not_provided'; reason: ArrivalNotProvidedReason };

export function requestArrivalLocation(): Promise<ArrivalLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ status: 'not_provided', reason: 'not_supported' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: 'provided',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      (error) => {
        resolve({
          status: 'not_provided',
          reason:
            error.code === error.PERMISSION_DENIED
              ? 'permission_denied'
              : error.code === error.TIMEOUT
                ? 'timeout'
                : 'position_unavailable',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export const ARRIVAL_NOT_PROVIDED_LABEL: Record<ArrivalNotProvidedReason, string> = {
  permission_denied: 'Location permission was declined',
  position_unavailable: 'Device could not determine a location',
  timeout: 'Location lookup timed out',
  not_supported: 'This device or browser does not support location',
};
