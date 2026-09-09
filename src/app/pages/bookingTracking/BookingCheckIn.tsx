import { useState } from 'react';
import { MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { LeafletLocationPicker, type LocationPoint } from '../../../components/common/LeafletLocationPicker';
import {
  CHECK_IN_STATUS_COPY,
  formatCheckInOpensLabel,
  isCheckInWindowOpen,
  type BookingCheckIn as BookingCheckInRow,
} from '../../../lib/bookingCheckIn';

type Role = 'client' | 'freelancer';

const KNOWN_ERROR_PREFIXES = ['Check-in opens at', 'This booking is not eligible for check-in', 'Not authorized for this booking'];

function friendlyErrorMessage(message: string | undefined | null): string {
  if (message && KNOWN_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))) return message;
  return 'Something went wrong while checking in. Please try again.';
}

export function BookingCheckIn({
  booking,
  bookingId,
  scheduledAt,
  role,
  checkIns,
  onRefresh,
}: {
  booking: any;
  bookingId: string;
  scheduledAt: Date | null;
  role: Role;
  checkIns: BookingCheckInRow[];
  onRefresh: () => Promise<void>;
}) {
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isSettingLocation, setIsSettingLocation] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  const selfCheckIn = checkIns.find((c) => c.role === role) || null;
  const otherRole: Role = role === 'client' ? 'freelancer' : 'client';
  const otherCheckIn = checkIns.find((c) => c.role === otherRole) || null;
  const otherLabel = role === 'client' ? 'Freelancer' : 'Client';

  const hasLocation = booking.location_lat != null && booking.location_lng != null;
  const windowOpen = isCheckInWindowOpen(scheduledAt);
  const opensAtLabel = formatCheckInOpensLabel(scheduledAt);
  const scheduledTimeLabel = scheduledAt
    ? scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'the scheduled time';

  const handleLocationConfirm = async (point: LocationPoint) => {
    setIsSettingLocation(true);
    await DataService.setBookingLocation(bookingId, point);
    setIsSettingLocation(false);
    setShowLocationPicker(false);
    await onRefresh();
  };

  const runCheckIn = async (input: { lat?: number; lng?: number; permissionDenied?: boolean; locationUnavailable?: boolean }) => {
    setIsCheckingIn(true);
    setCheckInError(null);
    const { error } = await DataService.checkInToBooking(bookingId, input);
    setIsCheckingIn(false);
    if (error) {
      setCheckInError(friendlyErrorMessage((error as any)?.message));
      return;
    }
    setShowExplainer(false);
    await onRefresh();
  };

  const handleCheckInPress = () => {
    if (!navigator.geolocation) {
      void runCheckIn({ locationUnavailable: true });
      return;
    }

    setIsCheckingIn(true);
    setCheckInError(null);
    // A single one-shot read at the moment of check-in — never watchPosition.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void runCheckIn({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (geoError) => {
        setIsCheckingIn(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          void runCheckIn({ permissionDenied: true });
        } else {
          void runCheckIn({ locationUnavailable: true });
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-gray-900" />
        <h2 className="font-bold text-gray-900">Booking Check-In</h2>
      </div>

      {/* Booking venue location — visible to both parties, either can set/change it. */}
      <div className="mb-4 rounded-xl bg-gray-50 p-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">
              {hasLocation ? booking.location_address : 'No exact booking location set yet.'}
            </p>
            <button
              onClick={() => setShowLocationPicker(true)}
              disabled={isSettingLocation}
              className="mt-1 text-xs font-semibold text-gray-900 underline underline-offset-2 hover:text-black disabled:opacity-60"
            >
              {hasLocation ? 'Change location' : 'Set booking location'}
            </button>
          </div>
        </div>
      </div>

      {/* Self check-in state */}
      {selfCheckIn ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-green-700" />
            <p className="font-bold text-green-900">CHECKED IN</p>
          </div>
          <p className="text-sm text-green-800">
            You checked in at {new Date(selfCheckIn.checked_in_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            {selfCheckIn.is_late ? ' (late)' : ''}.
          </p>
          <p className="text-sm text-green-800 mt-1">{CHECK_IN_STATUS_COPY[selfCheckIn.check_in_status].body}</p>
          <p className="text-xs text-green-700 mt-2">Your exact location is private.</p>
        </div>
      ) : !windowOpen ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700">
            {opensAtLabel ? `Check-in opens at ${opensAtLabel}.` : 'Check-in will open closer to your booking time.'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            You can check in starting 30 minutes before your scheduled booking.
          </p>
          <button disabled className="mt-3 w-full rounded-xl bg-gray-200 py-3 px-4 text-sm font-bold text-gray-500 cursor-not-allowed">
            Check-in unavailable
          </button>
          <p className="text-xs text-gray-500 mt-2">Booking time: {scheduledTimeLabel}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700">Your booking starts at {scheduledTimeLabel}. Please check in when you arrive.</p>
          {!showExplainer && (
            <p className="text-xs text-gray-500 mt-1">
              Your check-in information is private and will not be shared as your exact location with the other participant.
            </p>
          )}

          {showExplainer && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-600">
                CreativeHUB uses your location once during check-in to verify that you are near the booking location. Your
                exact location is not shared with the other participant.
              </p>
            </div>
          )}

          {checkInError && <p className="mt-3 text-sm text-red-600">{checkInError}</p>}

          <button
            onClick={() => (showExplainer ? handleCheckInPress() : setShowExplainer(true))}
            disabled={isCheckingIn}
            className="mt-3 w-full rounded-xl bg-gray-900 py-3 px-4 text-sm font-bold text-white hover:bg-black transition-all disabled:opacity-60"
          >
            {isCheckingIn ? 'Checking in...' : showExplainer ? 'Continue to Check In' : 'CHECK IN'}
          </button>
        </div>
      )}

      {/* Other participant — status only, never a timestamp or location. */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm text-gray-600">{otherLabel}</span>
        <span className={`text-sm font-semibold ${otherCheckIn ? 'text-green-700' : 'text-gray-400'}`}>
          {otherCheckIn ? '✓ Attendance recorded' : 'Not yet recorded'}
        </span>
      </div>

      {showLocationPicker && (
        <LeafletLocationPicker
          initialPoint={
            hasLocation
              ? {
                  latitude: booking.location_lat,
                  longitude: booking.location_lng,
                  formattedAddress: booking.location_address,
                  placeId: booking.location_place_id,
                  city: booking.location_city,
                  district: booking.location_district,
                }
              : null
          }
          onCancel={() => setShowLocationPicker(false)}
          onConfirm={(point) => void handleLocationConfirm(point)}
        />
      )}
    </div>
  );
}
