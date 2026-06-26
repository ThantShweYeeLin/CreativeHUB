import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { MainLayout } from '../components/MainLayout';
import { LoginPageWithRouting } from './pages/LoginPageWithRouting';
import { SignUpPageWithRouting } from './pages/SignUpPageWithRouting';

// Authenticated page imports
import { FreelancerProfile } from './components/FreelancerProfile';
import { MapView } from './components/MapView';
import { PortfoliosView } from './components/PortfoliosView';
import { SearchResults } from './components/SearchResults';
import { AIImageMatcher } from './components/AIImageMatcher';
import { UserMenu } from './components/UserMenu';
import { NotificationsPanel } from './components/NotificationsPanel';
import { RequestsPage } from './components/RequestsPage';
import { ClientProfilePage } from './components/ClientProfilePage';
import { BecomeFreelancerPage } from './components/BecomeFreelancerPage';
import { FreelancerDashboard } from './components/FreelancerDashboard';
import { PremiumSubscriptionPage } from './components/PremiumSubscriptionPage';
import { BookingTrackingPage } from './components/BookingTrackingPage';
import { MyBookingsPage } from './components/MyBookingsPage';
import { FavoritesPage } from './components/FavoritesPage';
import { MessagesPage } from './components/MessagesPage';
import { ForYouPage } from './components/ForYouPage';
import { ExplorePage } from './pages/ExplorePage';

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
        <p className="text-sm text-gray-600">Checking authentication...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      {!isAuthenticated && (
        <>
          <Route path="/login" element={<LoginPageWithRouting />} />
          <Route path="/signup" element={<SignUpPageWithRouting />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}

      {/* Protected Routes */}
      {isAuthenticated && (
        <>
          {/* Explore pages */}
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ExplorePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MapView onViewProfile={() => {}} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PortfoliosView onViewProfile={() => {}} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/for-you"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ForYouPage onViewProfile={() => {}} />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Profile pages */}
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute>
                <FreelancerProfile onBack={() => navigate(-1)} requestStatus={null} onOpenChat={() => navigate('/messages')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-profile"
            element={
              <ProtectedRoute>
                <ClientProfilePage onBack={() => navigate(-1)} />
              </ProtectedRoute>
            }
          />

          {/* Booking and requests */}
          <Route
            path="/requests"
            element={
              <ProtectedRoute>
                <RequestsPage onBack={() => navigate(-1)} onViewProfile={() => navigate('/freelancers')} onOpenMessages={() => navigate('/messages')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage onBack={() => navigate('/explore')} onSelectBooking={(id) => navigate(`/booking/${id}`)} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/:id"
            element={
              <ProtectedRoute>
                <BookingTrackingPage onBack={() => navigate('/my-bookings')} />
              </ProtectedRoute>
            }
          />

          {/* User pages */}
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage onBack={() => navigate(-1)} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <FavoritesPage onBack={() => navigate('/explore')} onViewProfile={(id) => navigate(`/profile/${id}`)} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard"
            element={
              <ProtectedRoute>
                <FreelancerDashboard onBack={() => navigate(-1)} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/become-freelancer"
            element={
              <ProtectedRoute>
                <BecomeFreelancerPage onBack={() => navigate(-1)} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/premium"
            element={
              <ProtectedRoute>
                <PremiumSubscriptionPage onBack={() => navigate(-1)} />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/explore" replace />} />
          <Route path="*" element={<Navigate to="/explore" replace />} />
        </>
      )}
    </Routes>
  );
}
