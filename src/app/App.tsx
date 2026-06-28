import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { MainLayout } from '../components/MainLayout';
import { LoginPageWithRouting } from './pages/LoginPageWithRouting';
import { SignUpPageWithRouting } from './pages/SignUpPageWithRouting';

// Authenticated page imports
import { FreelancerProfile } from './pages/FreelancerProfile';
import { MapView } from './pages/MapView';
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
import { ClientOnboardingPage } from './pages/ClientOnboardingPage';

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

function SupabaseSetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-lg font-bold text-white">
          CH
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Supabase setup needed</h1>
        <p className="mb-6 text-sm leading-6 text-gray-600">
          CreativeHUB needs your Supabase project URL and anon key before it can show the app.
        </p>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-900">Create a file named .env in the project root:</p>
          <pre className="overflow-x-auto rounded-xl bg-black p-4 text-xs text-white">
{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
          </pre>
        </div>
        <p className="mt-5 text-sm text-gray-600">
          After saving the file, restart the dev server and reload the page.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
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
                <Navigate to="/explore" replace />
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
                <RequestsPage onBack={() => navigate(-1)} onViewProfile={() => navigate('/explore')} onOpenMessages={() => navigate('/messages')} />
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
                {user?.role === 'freelancer' ? (
                  <Navigate to="/freelancer-dashboard/portfolio" replace />
                ) : (
                  <Navigate to="/become-freelancer" replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/portfolio"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardPortfolioPage /> : <Navigate to="/become-freelancer" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/requests"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardRequestsPage /> : <Navigate to="/become-freelancer" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/analytics"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardAnalyticsPage /> : <Navigate to="/become-freelancer" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/settings"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardSettingsPage /> : <Navigate to="/become-freelancer" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/client"
            element={
              <ProtectedRoute>
                <ClientOnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/freelancer"
            element={
              <ProtectedRoute>
                <BecomeFreelancerPage onBack={() => navigate('/explore')} />
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
