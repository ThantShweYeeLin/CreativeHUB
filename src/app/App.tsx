import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { MainLayout } from '../components/MainLayout';
import { LoginPageWithRouting } from './pages/LoginPageWithRouting';
import { SignUpPageWithRouting } from './pages/SignUpPageWithRouting';

// Authenticated page imports
import { FreelancerProfile } from './components/FreelancerProfile';
import { MapView } from './components/MapView';
import { PortfoliosView } from './components/PortfoliosView';
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
  const { loading, isAuthenticated } = useAuth();

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
                <FreelancerProfile onBack={() => {}} requestStatus={null} onOpenChat={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-profile"
            element={
              <ProtectedRoute>
                <ClientProfilePage onBack={() => {}} />
              </ProtectedRoute>
            }
          />

          {/* Booking and requests */}
          <Route
            path="/requests"
            element={
              <ProtectedRoute>
                <RequestsPage onBack={() => {}} onViewProfile={() => {}} onOpenMessages={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage onBack={() => {}} onSelectBooking={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/:id"
            element={
              <ProtectedRoute>
                <BookingTrackingPage onBack={() => {}} />
              </ProtectedRoute>
            }
          />

          {/* User pages */}
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage onBack={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <FavoritesPage onBack={() => {}} onViewProfile={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard"
            element={
              <ProtectedRoute>
                <FreelancerDashboard onBack={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/become-freelancer"
            element={
              <ProtectedRoute>
                <BecomeFreelancerPage onBack={() => {}} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/premium"
            element={
              <ProtectedRoute>
                <PremiumSubscriptionPage onBack={() => {}} />
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
