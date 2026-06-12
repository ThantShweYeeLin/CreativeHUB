import { ChevronLeft, Clock, ChevronRight, Calendar, MapPin, DollarSign } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface MyBookingsPageProps {
  onBack: () => void;
  onSelectBooking: (bookingId: number) => void;
}

const bookings = [
  {
    id: 1,
    bookingId: '#BK20260514001',
    freelancer: {
      name: 'Darling Arias',
      specialty: 'Fashion Editorial Photographer',
      image: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      rating: 5.0
    },
    service: {
      title: 'Fashion Editorial Photoshoot',
      date: '2026-05-20',
      time: '10:00 AM - 2:00 PM',
      location: 'Central World, Bangkok'
    },
    status: 'In Progress',
    statusColor: 'bg-blue-100 text-blue-700 border-blue-200',
    totalAmount: 13000,
    deposit: 3000
  },
  {
    id: 2,
    bookingId: '#BK20260510002',
    freelancer: {
      name: 'Laura Chouette',
      specialty: 'Fashion & Editorial Makeup',
      image: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      rating: 5.0
    },
    service: {
      title: 'Bridal Makeup Session',
      date: '2026-05-25',
      time: '9:00 AM - 12:00 PM',
      location: 'Sukhumvit, Bangkok'
    },
    status: 'Confirmed',
    statusColor: 'bg-green-100 text-green-700 border-green-200',
    totalAmount: 8500,
    deposit: 2500
  },
  {
    id: 3,
    bookingId: '#BK20260505003',
    freelancer: {
      name: 'Marcus Chen',
      specialty: 'Action Sports Photography',
      image: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      rating: 5.0
    },
    service: {
      title: 'Outdoor Sports Photoshoot',
      date: '2026-05-15',
      time: '2:00 PM - 5:00 PM',
      location: 'Lumpini Park, Bangkok'
    },
    status: 'Completed',
    statusColor: 'bg-gray-100 text-gray-700 border-gray-200',
    totalAmount: 12000,
    deposit: 3500
  }
];

export function MyBookingsPage({ onBack, onSelectBooking }: MyBookingsPageProps) {
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
          <p className="text-sm text-gray-600">{bookings.length} active bookings</p>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        {/* Bookings List */}
        <div className="space-y-4">
          {bookings.map((booking) => (
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
                      src={booking.freelancer.image}
                      alt={booking.freelancer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{booking.freelancer.name}</h2>
                    <p className="text-sm text-gray-600">{booking.freelancer.specialty}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>

              {/* Service Details */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{booking.service.title}</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Calendar className="w-3 h-3" />
                    <span>{booking.service.date} • {booking.service.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span>{booking.service.location}</span>
                  </div>
                </div>
              </div>

              {/* Status & Price */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${booking.statusColor}`}>
                    {booking.status}
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

        {/* Empty State - if no bookings */}
        {bookings.length === 0 && (
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
