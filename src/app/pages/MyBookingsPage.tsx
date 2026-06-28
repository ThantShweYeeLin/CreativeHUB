import { ChevronLeft, Clock, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

interface MyBookingsPageProps {
  onBack: () => void;
  onSelectBooking: (bookingId: string) => void;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;

function formatStatus(status: string) {
  switch (status) {
    case 'in_progress':
      return { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'confirmed':
      return { label: 'Confirmed', color: 'bg-green-100 text-green-700 border-green-200' };
    case 'completed':
      return { label: 'Completed', color: 'bg-gray-100 text-gray-700 border-gray-200' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200' };
    default:
      return { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
}

export function MyBookingsPage({ onBack, onSelectBooking }: MyBookingsPageProps) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      if (!user) {
        if (isMounted) {
          setBookings([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      const response = user.role === 'freelancer'
        ? await DataService.getFreelancerBookings(user.id)
        : await DataService.getClientBookings(user.id);

      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load bookings.');
        setBookings([]);
      } else {
        setBookings(response.data || []);
      }

      setIsLoading(false);
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const normalizedBookings = useMemo(() => {
    return bookings.map((booking) => {
      const counterparty = user?.role === 'freelancer' ? booking.client : booking.freelancer;
      const status = formatStatus(booking.status);

      return {
        id: booking.id,
        bookingId: `#${booking.id.slice(0, 8).toUpperCase()}`,
        name: counterparty?.full_name || 'CreativeHUB User',
        specialty: booking.project_name,
        image: counterparty?.avatar_url || fallbackProfileImage,
        date: booking.start_date || 'Schedule pending',
        endDate: booking.end_date || null,
        location: counterparty?.location || 'Location to be confirmed',
        statusLabel: status.label,
        statusColor: status.color,
        totalAmount: Number(booking.budget || 0),
        deposit: Math.round(Number(booking.budget || 0) * 0.3),
      };
    });
  }, [bookings, user?.role]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[600px] mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors mb-3"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-sm text-gray-600">{normalizedBookings.length} bookings</p>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
          </div>
        )}

        {/* Bookings List */}
        {!isLoading && normalizedBookings.length > 0 && (
        <div className="space-y-4">
          {normalizedBookings.map((booking) => (
            <button
              key={booking.id}
              onClick={() => onSelectBooking(booking.id)}
              className="w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-5 hover:shadow-2xl hover:border-gray-900 transition-all text-left"
            >
              {/* Booking Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-200 flex-shrink-0">
                    <ImageWithFallback
                      src={booking.image}
                      alt={booking.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{booking.name}</h2>
                    <p className="text-sm text-gray-600">{booking.specialty}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>

              {/* Service Details */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{booking.specialty}</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Calendar className="w-3 h-3" />
                    <span>{booking.date}{booking.endDate ? ` to ${booking.endDate}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span>{booking.location}</span>
                  </div>
                </div>
              </div>

              {/* Status & Price */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${booking.statusColor}`}>
                    {booking.statusLabel}
                  </div>
                  <span className="text-xs text-gray-500">{booking.bookingId}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="font-bold text-gray-900">฿{booking.totalAmount.toLocaleString()}</div>
                </div>
              </div>

              {/* Deposit Info */}
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-600">Deposit</span>
                <span className="text-xs font-semibold text-gray-900">฿{booking.deposit.toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>
        )}

        {/* Empty State - if no bookings */}
        {!isLoading && normalizedBookings.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Bookings Yet</h3>
            <p className="text-gray-600 mb-6">
              Start booking talented freelancers for your creative projects
            </p>
            <button
              onClick={onBack}
              className="px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Explore Freelancers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
