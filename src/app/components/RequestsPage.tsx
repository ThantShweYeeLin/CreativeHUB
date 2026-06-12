import { ChevronLeft, MessageCircle, Edit, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface RequestsPageProps {
  onBack: () => void;
  onViewProfile?: (status: 'accepted' | 'pending' | 'rejected') => void;
  onOpenMessages?: () => void;
}

const requests = [
  {
    id: 1,
    freelancer: {
      name: 'Simran Sood',
      specialty: 'Creative Artistry',
      avatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200'
    },
    projectName: 'Wedding Makeup - Beach Theme',
    budget: 15000,
    status: 'accepted' as const,
    date: '2026-05-03',
    message: 'I\'d love to work on this project! Let\'s discuss the details.'
  },
  {
    id: 2,
    freelancer: {
      name: 'Deny Napitupulu',
      specialty: 'Landscape & Nature',
      avatar: 'https://images.unsplash.com/photo-1706661912295-bd1dc10ffe7f?w=200'
    },
    projectName: 'Product Photography - E-commerce',
    budget: 8000,
    status: 'pending' as const,
    date: '2026-05-04',
    message: null
  },
  {
    id: 3,
    freelancer: {
      name: 'Laura Chouette',
      specialty: 'Fashion & Editorial',
      avatar: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?w=200'
    },
    projectName: 'Fashion Editorial Shoot',
    budget: 25000,
    status: 'rejected' as const,
    date: '2026-05-02',
    message: 'Thank you for reaching out. Unfortunately, I\'m fully booked for this month.'
  },
  {
    id: 4,
    freelancer: {
      name: 'Daria Magazzu',
      specialty: 'High Fashion',
      avatar: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=200'
    },
    projectName: 'Runway Model - Fashion Week',
    budget: 30000,
    status: 'pending' as const,
    date: '2026-05-05',
    message: null
  },
  {
    id: 5,
    freelancer: {
      name: 'Marcus Chen',
      specialty: 'Action Sports',
      avatar: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?w=200'
    },
    projectName: 'Sports Event Coverage',
    budget: 12000,
    status: 'accepted' as const,
    date: '2026-05-01',
    message: 'Excited to capture this event! Available on the requested dates.'
  },
];

const getStatusColor = (status: 'pending' | 'accepted' | 'rejected') => {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'accepted':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200';
  }
};

const getStatusText = (status: 'pending' | 'accepted' | 'rejected') => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function RequestsPage({ onBack, onViewProfile, onOpenMessages }: RequestsPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 mb-6 md:mb-8">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            Back to Home
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">My Requests</h1>
            <p className="text-sm md:text-base text-gray-600">Track and manage your booking requests</p>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                  {/* Freelancer Avatar */}
                  <div className="flex-shrink-0 self-center md:self-auto">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden ring-2 ring-white shadow-md">
                      <ImageWithFallback
                        src={request.freelancer.avatar}
                        alt={request.freelancer.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 gap-2">
                      <div className="text-center md:text-left">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
                          {request.projectName}
                        </h3>
                        <p className="text-sm md:text-base text-gray-600">
                          <span className="font-semibold">{request.freelancer.name}</span>
                          {' · '}
                          {request.freelancer.specialty}
                        </p>
                      </div>
                      <div
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold border-2 ${getStatusColor(request.status)} self-center md:self-auto whitespace-nowrap`}
                      >
                        {getStatusText(request.status)}
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 mb-4 text-xs md:text-sm text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-900">Budget:</span> ฿{request.budget.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">Sent:</span> {new Date(request.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>

                    {/* Response Message */}
                    {request.message && (
                      <div className={`p-3 md:p-4 rounded-xl mb-4 ${
                        request.status === 'accepted'
                          ? 'bg-green-50 border-2 border-green-100'
                          : request.status === 'rejected'
                          ? 'bg-red-50 border-2 border-red-100'
                          : 'bg-gray-50 border-2 border-gray-100'
                      }`}>
                        <p className="text-xs md:text-sm text-gray-700 italic">"{request.message}"</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
                      {request.status === 'pending' && (
                        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all">
                          <Edit className="w-4 h-4" />
                          Edit Request
                        </button>
                      )}
                      {request.status === 'accepted' && (
                        <button
                          onClick={onOpenMessages}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </button>
                      )}
                      {request.status === 'rejected' && (
                        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors">
                          <AlertCircle className="w-4 h-4" />
                          View Reason
                        </button>
                      )}
                      <button
                        onClick={() => onViewProfile?.(request.status)}
                        className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm md:text-base font-semibold transition-colors text-center"
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {requests.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-12 h-12 text-gray-900" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Requests Yet</h3>
            <p className="text-gray-600">Start exploring and send booking requests to freelancers!</p>
          </div>
        )}
      </div>
    </div>
  );
}
