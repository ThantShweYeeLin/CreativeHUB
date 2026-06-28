import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { MainLayout } from '../components/MainLayout';
import { LoginPageWithRouting } from './pages/LoginPageWithRouting';
import { SignUpPageWithRouting } from './pages/SignUpPageWithRouting';

// Authenticated page imports
import { FreelancerProfile } from './pages/FreelancerProfile';
import { MapView } from './pages/MapView';
import { PortfoliosView } from './pages/PortfoliosView';
import { SearchResults } from './components/SearchResults';
import { AIImageMatcher } from './components/AIImageMatcher';
import { UserMenu } from './components/UserMenu';
import { NotificationsPanel } from './components/NotificationsPanel';
import { RequestsPage } from './pages/RequestsPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
import { BecomeFreelancerPage } from './pages/BecomeFreelancerPage';
import { FreelancerDashboardPortfolioPage } from './pages/FreelancerDashboardPortfolioPage';
import { FreelancerDashboardRequestsPage } from './pages/FreelancerDashboardRequestsPage';
import { FreelancerDashboardAnalyticsPage } from './pages/FreelancerDashboardAnalyticsPage';
import { FreelancerDashboardSettingsPage } from './pages/FreelancerDashboardSettingsPage';
import { PremiumSubscriptionPage } from './pages/PremiumSubscriptionPage';
import { BookingTrackingPage } from './pages/BookingTrackingPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { MessagesPage } from './pages/MessagesPage';
import { ForYouPage } from './pages/ForYouPage';
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
                  <MapView onViewProfile={(id) => navigate(`/profile/${id}`)} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PortfoliosView onViewProfile={(id) => navigate(`/profile/${id}`)} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/for-you"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ForYouPage onViewProfile={(id) => navigate(`/profile/${id}`)} />
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
                <Navigate to="/freelancer-dashboard/portfolio" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/portfolio"
            element={
              <ProtectedRoute>
                <FreelancerDashboardPortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/requests"
            element={
              <ProtectedRoute>
                <FreelancerDashboardRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/analytics"
            element={
              <ProtectedRoute>
                <FreelancerDashboardAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/settings"
            element={
              <ProtectedRoute>
                <FreelancerDashboardSettingsPage />
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
