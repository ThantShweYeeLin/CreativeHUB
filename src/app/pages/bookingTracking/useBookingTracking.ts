import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { DataService } from '../../../lib/dataService';
import { getBookingEscrowState, type EscrowState } from '../../../lib/bookingEscrow';
import { extractScheduleMeta, formatTimeLabel } from '../../../lib/requestSchedule';
import { extractLocationMeta } from '../../../lib/requestLocation';
import { DEFAULT_AVATAR_URL } from '../../../lib/defaults';

export const fallbackProfileImage = DEFAULT_AVATAR_URL;

export function useBookingTracking() {
  const { id } = useParams();
  const [booking, setBooking] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBooking() {
      if (!id) {
        if (isMounted) {
          setError('Missing booking id.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      let response = await DataService.getBooking(id);
      if (isMounted && response.data) {
        // Reconciliation/arbitration are safe no-ops when nothing is due —
        // running them on every load is what keeps deadlines enforced
        // without a server cron.
        await DataService.reconcileBookingEscrow(id);
        await DataService.arbitrateBookingDispute(id);
        response = await DataService.getBooking(id);
      }

      if (!isMounted) return;

      if (response.error || !response.data) {
        setError((response.error as any)?.message || 'Unable to load booking.');
        setBooking(null);
      } else {
        setBooking(response.data);
      }

      const eventsResponse = await DataService.getBookingEvents(id);
      if (isMounted) {
        setEvents(eventsResponse.data || []);
      }

      setIsLoading(false);
    }

    loadBooking();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    const paths = [
      ...((booking?.completion_evidence_photos as string[]) || []),
      ...events.flatMap((event) => (event.evidence_photos as string[]) || []),
    ];
    const missing = Array.from(new Set(paths.filter((p) => p && !signedUrls[p])));
    if (!missing.length) return;

    let isMounted = true;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (path) => {
          const res = await DataService.getBookingEvidenceSignedUrl(path);
          return [path, res.url] as const;
        })
      );
      if (!isMounted) return;
      setSignedUrls((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(([, url]) => Boolean(url)) as Array<[string, string]>),
      }));
    })();

    return () => {
      isMounted = false;
    };
  }, [booking, events]);

  const refresh = async () => {
    if (!id) return;
    const [bookingResponse, eventsResponse] = await Promise.all([DataService.getBooking(id), DataService.getBookingEvents(id)]);
    if (bookingResponse.data) setBooking(bookingResponse.data);
    setEvents(eventsResponse.data || []);
  };

  const escrowState: EscrowState = useMemo(() => getBookingEscrowState(booking), [booking]);

  const bookingData = useMemo(() => {
    if (!booking) {
      return null;
    }

    const servicePrice = Number(booking.budget || 0);
    const deposit = Math.round(servicePrice * 0.3);
    // Prefer the real start_date/start_time columns (populated going forward);
    // fall back to the SCHEDULE_META tag in description for older bookings.
    const scheduleMeta = booking.start_date
      ? { date: booking.start_date, time: booking.start_time || '00:00' }
      : extractScheduleMeta(booking.description);
    const locationMeta = extractLocationMeta(booking.description);
    const scheduleDateLabel = scheduleMeta
      ? new Date(`${scheduleMeta.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : 'Schedule pending';
    const scheduleTimeLabel = scheduleMeta && (booking.start_time || !booking.start_date)
      ? formatTimeLabel(scheduleMeta.time)
      : 'Time to be confirmed';
    // Only trust this for gating "the appointment time has passed" when we
    // have a real time, not just a date - a bare date defaults to midnight,
    // which would look "already passed" all day for a same-day booking.
    // Built from numeric parts (not an ISO string) since start_time comes
    // back as "HH:MM:SS" from Postgres's time type - formatTimeLabel()
    // tolerates that by only reading the first two segments; this mirrors it.
    const scheduledAt = scheduleMeta && (booking.start_time || !booking.start_date)
      ? (() => {
          const [year, month, day] = scheduleMeta.date.split('-').map(Number);
          const [hour, minute] = scheduleMeta.time.split(':').map(Number);
          return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
        })()
      : null;

    return {
      bookingId: `#${booking.id.slice(0, 8).toUpperCase()}`,
      scheduledAt,
      freelancer: {
        name: booking.freelancer?.full_name || 'CreativeHUB Freelancer',
        specialty: booking.project_name,
        image: booking.freelancer?.avatar_url || fallbackProfileImage,
        gender: booking.freelancer?.gender || null,
        rating: Number(booking.freelancer?.rating || 0),
        reviews: Number(booking.freelancer?.total_reviews || 0),
      },
      client: {
        name: booking.client?.full_name || 'CreativeHUB Client',
        image: booking.client?.avatar_url || fallbackProfileImage,
        gender: booking.client?.gender || null,
      },
      service: {
        title: booking.project_name,
        date: scheduleDateLabel,
        time: scheduleTimeLabel,
        location: locationMeta || booking.freelancer?.location || booking.client?.location || 'Location to be confirmed',
      },
      pricing: {
        servicePrice,
        deposit,
        total: servicePrice,
      },
      bookingDate: booking.created_at ? new Date(booking.created_at).toLocaleDateString() : 'Pending',
    };
  }, [booking]);

  return { id, booking, setBooking, events, signedUrls, isLoading, error, setError, refresh, escrowState, bookingData };
}
