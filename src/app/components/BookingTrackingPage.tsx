import { ChevronLeft, Clock, CheckCircle, FileText, Upload, AlertCircle, RefreshCw, Shield, Camera, MessageSquare, ChevronRight } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { DataService } from '../../lib/dataService';

interface BookingTrackingPageProps {
  onBack: () => void;
}

type BookingStage = 'requested' | 'confirmed' | 'inProgress' | 'issue' | 'refundReview' | 'refundApproved' | 'replacement' | 'completed' | 'released';

const fallbackProfileImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

function getInitialStage(status: string | undefined): BookingStage {
  switch (status) {
    case 'confirmed':
      return 'confirmed';
    case 'in_progress':
      return 'inProgress';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'refundReview';
    default:
      return 'requested';
  }
}

export function BookingTrackingPage({ onBack }: BookingTrackingPageProps) {
  const { id } = useParams();
  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<BookingStage>('requested');
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

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

      const response = await DataService.getBooking(id);

      if (!isMounted) {
        return;
      }

      if (response.error || !response.data) {
        setError((response.error as any)?.message || 'Unable to load booking.');
        setBooking(null);
      } else {
        setBooking(response.data);
        setCurrentStage(getInitialStage(response.data.status));
      }

      setIsLoading(false);
    }

    loadBooking();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const bookingData = useMemo(() => {
    if (!booking) {
      return null;
    }

    const servicePrice = Number(booking.budget || 0);
    const deposit = Math.round(servicePrice * 0.3);

    return {
      bookingId: `#${booking.id.slice(0, 8).toUpperCase()}`,
      freelancer: {
        name: booking.freelancer?.full_name || 'CreativeHUB Freelancer',
        specialty: booking.project_name,
        image: booking.freelancer?.avatar_url || fallbackProfileImage,
        rating: Number(booking.freelancer?.rating || 0),
        reviews: Number(booking.freelancer?.total_reviews || 0),
      },
      service: {
        title: booking.project_name,
        date: booking.start_date || 'Schedule pending',
        time: booking.end_date ? `Ends ${booking.end_date}` : 'Time to be confirmed',
        location: booking.freelancer?.location || booking.client?.location || 'Location to be confirmed',
      },
      pricing: {
        servicePrice,
        deposit,
        total: servicePrice,
      },
      bookingDate: booking.created_at ? new Date(booking.created_at).toLocaleDateString() : 'Pending',
    };
  }, [booking]);

  const stages = [
    {
      id: 'requested',
      label: 'Booking Requested',
      icon: FileText,
      timestamp: '2026-05-14, 09:30 AM',
      description: 'Your booking request has been sent to the freelancer'
    },
    {
      id: 'confirmed',
      label: 'Freelancer Confirmed',
      icon: CheckCircle,
      timestamp: '2026-05-14, 10:15 AM',
      description: 'Freelancer accepted your booking. Please transfer deposit to secure booking.'
    },
    {
      id: 'inProgress',
      label: 'Project In Progress',
      icon: Clock,
      timestamp: '2026-05-20, 10:00 AM',
      description: 'Deposit secured. Service is currently being delivered.'
    },
    {
      id: 'completed',
      label: 'Service Completed',
      icon: CheckCircle,
      timestamp: currentStage === 'completed' || currentStage === 'released' ? '2026-05-20, 2:00 PM' : '',
      description: 'Service has been successfully delivered. Deposit will be released to freelancer.'
    },
    {
      id: 'released',
      label: 'Deposit Transferred',
      icon: Shield,
      timestamp: currentStage === 'released' ? '2026-05-21, 9:00 AM' : '',
      description: 'Deposit has been transferred to freelancer'
    }
  ];

  const issueStages = [
    {
      id: 'refundReview',
      label: 'Refund Under Review',
      icon: AlertCircle,
      timestamp: '2026-05-20, 3:30 PM',
      description: 'Our team is reviewing your refund request and evidence'
    },
    {
      id: 'refundApproved',
      label: 'Refund Approved',
      icon: CheckCircle,
      timestamp: '2026-05-21, 11:00 AM',
      description: 'Your refund has been approved and will be processed within 3-5 business days'
    },
    {
      id: 'replacement',
      label: 'Replacement Assigned',
      icon: RefreshCw,
      timestamp: '2026-05-20, 4:00 PM',
      description: 'A replacement freelancer has been assigned to your booking'
    }
  ];

  const getStageIndex = (stageId: string) => {
    return stages.findIndex(s => s.id === stageId);
  };

  const currentStageIndex = getStageIndex(currentStage);

  const handleFileUpload = () => {
    // Simulate file upload
    setUploadedFiles([...uploadedFiles, 'evidence-' + (uploadedFiles.length + 1) + '.jpg']);
  };

  const isStageCompleted = (stageId: string) => {
    const stageIndex = getStageIndex(stageId);
    return stageIndex <= currentStageIndex;
  };

  const isStageActive = (stageId: string) => {
    return stageId === currentStage;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
      </div>
    );
  }

  if (error || !bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 p-6">
        <div className="mx-auto max-w-[600px] rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <p className="text-sm text-red-700">{error || 'Booking could not be loaded.'}</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-xl font-bold text-gray-900">Booking Tracking</h1>
          <p className="text-sm text-gray-600">{bookingData.bookingId}</p>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        {/* Freelancer Profile Preview */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-gray-200 flex-shrink-0">
              <ImageWithFallback
                src={bookingData.freelancer.image}
                alt={bookingData.freelancer.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">{bookingData.freelancer.name}</h2>
              <p className="text-sm text-gray-600">{bookingData.freelancer.specialty}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-gray-900 font-semibold">★ {bookingData.freelancer.rating}</span>
                <span className="text-xs text-gray-500">({bookingData.freelancer.reviews} reviews)</span>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-900 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Service Details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-gray-900 mb-2">{bookingData.service.title}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{bookingData.service.date} • {bookingData.service.time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>{bookingData.service.location}</span>
            </div>
          </div>
        </div>

        {/* Deposit Status Card */}
        {(currentStage === 'confirmed' || currentStage === 'inProgress' || currentStage === 'completed' || currentStage === 'released') && (
          <div className={`rounded-2xl shadow-lg border-2 p-5 mb-6 ${
            currentStage === 'confirmed'
              ? 'bg-gradient-to-br from-gray-900 to-black text-white border-gray-900'
              : currentStage === 'released'
              ? 'bg-white border-green-500'
              : 'bg-white border-gray-900'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className={`w-6 h-6 ${currentStage === 'confirmed' ? 'text-white' : currentStage === 'released' ? 'text-green-600' : 'text-gray-900'}`} />
              <h2 className={`font-bold text-lg ${currentStage === 'confirmed' ? 'text-white' : currentStage === 'released' ? 'text-green-600' : 'text-gray-900'}`}>
                {currentStage === 'confirmed' ? 'Deposit Transfer Required' : currentStage === 'released' ? 'Deposit Transferred' : 'Deposit Secured'}
              </h2>
            </div>

            {currentStage === 'confirmed' && (
              <>
                <p className="text-gray-300 text-sm mb-4">
                  Transfer the booking deposit to secure your booking. The deposit will be held safely and released to the freelancer after service completion.
                </p>
                <div className="bg-white rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Deposit Amount</span>
                    <span className="text-2xl font-bold text-gray-900">฿{bookingData.pricing.deposit.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500">This amount will be held until service completion</p>
                </div>
                <button className="w-full bg-white text-gray-900 py-3 px-4 rounded-xl font-bold hover:bg-gray-100 transition-all">
                  Transfer Deposit Now
                </button>
              </>
            )}

            {(currentStage === 'inProgress' || currentStage === 'completed') && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Deposit Secured: ฿{bookingData.pricing.deposit.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">
                      {currentStage === 'inProgress'
                        ? 'Held safely until service completion'
                        : 'Will be transferred to freelancer within 24 hours'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStage === 'released' && (
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">฿{bookingData.pricing.deposit.toLocaleString()} Transferred</p>
                    <p className="text-xs text-gray-600">Deposit successfully transferred to {bookingData.freelancer.name}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Booking Timeline */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-6">Booking Timeline</h2>

          <div className="space-y-6">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const completed = isStageCompleted(stage.id);
              const active = isStageActive(stage.id);
              const isLast = index === stages.length - 1;

              return (
                <div key={stage.id} className="relative">
                  <div className="flex gap-4">
                    {/* Timeline Icon */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          completed
                            ? 'bg-gray-900 text-white'
                            : active
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {!isLast && (
                        <div
                          className={`w-0.5 h-full min-h-[40px] mt-2 transition-all ${
                            completed ? 'bg-gray-900' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>

                    {/* Timeline Content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between mb-1">
                        <h3
                          className={`font-bold ${
                            completed || active ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {stage.label}
                        </h3>
                        {stage.timestamp && (
                          <span className="text-xs text-gray-500">{stage.timestamp}</span>
                        )}
                      </div>
                      <p
                        className={`text-sm ${
                          completed || active ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        {stage.description}
                      </p>

                      {/* Deposit Transfer Notice - Show at confirmed stage */}
                      {stage.id === 'confirmed' && active && (
                        <div className="mt-3 bg-gray-50 rounded-xl p-3 border-2 border-gray-900">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-gray-900" />
                            <span className="text-sm font-bold text-gray-900">Deposit Transfer Required</span>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">
                            Transfer ฿{bookingData.pricing.deposit.toLocaleString()} to secure your booking
                          </p>
                          <button className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-2 px-4 rounded-lg text-sm font-semibold hover:shadow-lg transition-all">
                            Transfer Deposit
                          </button>
                        </div>
                      )}

                      {/* Report Issue Button - Only show during "In Progress" stage */}
                      {stage.id === 'inProgress' && active && !showReportIssue && (
                        <button
                          onClick={() => setShowReportIssue(true)}
                          className="mt-3 w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                        >
                          <AlertCircle className="w-5 h-5" />
                          Report Issue
                        </button>
                      )}

                      {/* Service Completed - Confirmation needed */}
                      {stage.id === 'completed' && active && currentStage === 'completed' && (
                        <div className="mt-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <p className="text-sm text-gray-700 mb-3">
                            Service has been completed. Please confirm to release the deposit to the freelancer.
                          </p>
                          <button
                            onClick={() => setCurrentStage('released')}
                            className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Confirm & Release Deposit
                          </button>
                        </div>
                      )}

                      {/* Deposit Released Info - Show at released stage */}
                      {stage.id === 'released' && (completed || active) && (
                        <div className="mt-3 bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-semibold text-green-900">
                              ฿{bookingData.pricing.deposit.toLocaleString()} transferred to freelancer
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Issue Stages - Show if issue reported */}
            {(currentStage === 'refundReview' || currentStage === 'refundApproved' || currentStage === 'replacement') && (
              <>
                {issueStages
                  .filter(stage => {
                    if (currentStage === 'refundReview') return stage.id === 'refundReview';
                    if (currentStage === 'refundApproved') return ['refundReview', 'refundApproved'].includes(stage.id);
                    if (currentStage === 'replacement') return stage.id === 'replacement';
                    return false;
                  })
                  .map((stage, index, array) => {
                    const Icon = stage.icon;
                    const isLast = index === array.length - 1;

                    return (
                      <div key={stage.id} className="relative">
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-900 text-white">
                              <Icon className="w-5 h-5" />
                            </div>
                            {!isLast && (
                              <div className="w-0.5 h-full min-h-[40px] mt-2 bg-gray-900" />
                            )}
                          </div>

                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between mb-1">
                              <h3 className="font-bold text-gray-900">{stage.label}</h3>
                              <span className="text-xs text-gray-500">{stage.timestamp}</span>
                            </div>
                            <p className="text-sm text-gray-600">{stage.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </div>

        {/* Report Issue Modal */}
        {showReportIssue && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-900 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Report Issue
              </h2>
              <button
                onClick={() => setShowReportIssue(false)}
                className="text-gray-400 hover:text-gray-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Describe the issue and upload evidence such as screenshots, photos, or chat records.
            </p>

            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all mb-4 min-h-[100px] resize-none"
            />

            {/* Upload Evidence */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Upload Evidence</label>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-400" />
                  </div>
                ))}
                {uploadedFiles.length < 6 && (
                  <button
                    onClick={handleFileUpload}
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-gray-900 hover:bg-gray-50 transition-all"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-500">Upload</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">You can upload up to 6 files (photos, screenshots, or chat records)</p>
            </div>

            {/* Quick Issue Types */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Issue Type</label>
              <div className="flex flex-wrap gap-2">
                {['Quality Issue', 'Late Arrival', 'Poor Communication', 'Other'].map((type) => (
                  <button
                    key={type}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-900 hover:text-white transition-all"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setShowReportIssue(false);
                setCurrentStage('refundReview');
              }}
              className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all"
            >
              Submit Issue Report
            </button>
          </div>
        )}

        {/* Booking Fee Summary */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Payment Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service Price</span>
              <span className="font-semibold text-gray-900">฿{bookingData.pricing.servicePrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm items-start">
              <div className="flex-1">
                <span className="text-gray-600">Booking Deposit</span>
                {currentStage !== 'released' && (
                  <p className="text-xs text-gray-500 mt-0.5">To be transferred after completion</p>
                )}
              </div>
              <span className="font-semibold text-gray-900">฿{bookingData.pricing.deposit.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total Booking Cost</span>
              <span className="font-bold text-gray-900 text-xl">฿{bookingData.pricing.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Deposit Info Box */}
          {currentStage !== 'released' && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">How Deposit Works</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Your ฿{bookingData.pricing.deposit.toLocaleString()} deposit is held securely by CreativeHUB AI.
                    After the service is completed and you confirm satisfaction, the deposit will be automatically
                    transferred to {bookingData.freelancer.name}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStage === 'released' && (
            <div className="mt-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                <span className="font-bold">Deposit Transferred:</span> ฿{bookingData.pricing.deposit.toLocaleString()} has been successfully transferred to {bookingData.freelancer.name}
              </p>
            </div>
          )}
        </div>

        {/* Deposit Protection Info */}
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-lg p-5 text-white">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Deposit Protection
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Deposit held securely until service completion</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Full refund available if service issues occur</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Automatic transfer to freelancer after confirmation</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">Report issues anytime during project progress</p>
            </div>
          </div>
        </div>

        {/* Debug Controls - Remove in production */}
        <div className="mt-6 bg-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-2">Demo Controls:</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCurrentStage('requested')} className="text-xs px-3 py-1 bg-white rounded-lg">Requested</button>
            <button onClick={() => setCurrentStage('confirmed')} className="text-xs px-3 py-1 bg-white rounded-lg">Confirmed</button>
            <button onClick={() => setCurrentStage('inProgress')} className="text-xs px-3 py-1 bg-white rounded-lg">In Progress</button>
            <button onClick={() => setCurrentStage('refundReview')} className="text-xs px-3 py-1 bg-white rounded-lg">Refund Review</button>
            <button onClick={() => setCurrentStage('refundApproved')} className="text-xs px-3 py-1 bg-white rounded-lg">Refund Approved</button>
            <button onClick={() => setCurrentStage('replacement')} className="text-xs px-3 py-1 bg-white rounded-lg">Replacement</button>
            <button onClick={() => setCurrentStage('completed')} className="text-xs px-3 py-1 bg-white rounded-lg">Completed</button>
            <button onClick={() => setCurrentStage('released')} className="text-xs px-3 py-1 bg-white rounded-lg">Released</button>
          </div>
        </div>
      </div>
    </div>
  );
}
