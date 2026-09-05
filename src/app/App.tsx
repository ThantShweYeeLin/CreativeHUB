import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { MainLayout } from '../components/MainLayout';
import { MobileBottomNav } from '../components/MobileBottomNav';
// Kept eager — the first thing a signed-out visitor sees, so there's
// nothing to gain (and a loading flicker to lose) by chunking these.
import { LoginPageWithRouting } from './pages/LoginPageWithRouting';
import { SignUpPageWithRouting } from './pages/SignUpPageWithRouting';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Authenticated page imports — lazy so each route's code downloads only
// when a signed-in user actually navigates there, instead of one ~8.7MB
// bundle shipping every page (Explore, both dashboards, Admin, etc.)
// upfront. Same components, same props, same behavior — just loaded later.
const FreelancerProfile = lazy(() => import('./pages/FreelancerProfile').then((m) => ({ default: m.FreelancerProfile })));
const TeamProfilePage = lazy(() => import('./pages/TeamProfilePage').then((m) => ({ default: m.TeamProfilePage })));
const MapView = lazy(() => import('./pages/MapExplorePage').then((m) => ({ default: m.MapView })));
const RequestsPage = lazy(() => import('./pages/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const GroupRequestPage = lazy(() => import('./pages/GroupRequestPage').then((m) => ({ default: m.GroupRequestPage })));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage').then((m) => ({ default: m.EditProfilePage })));
const BecomeFreelancerPage = lazy(() => import('./pages/BecomeFreelancerPage').then((m) => ({ default: m.BecomeFreelancerPage })));
const FreelancerDashboardRequestsPage = lazy(() => import('./pages/FreelancerDashboardRequestsPage').then((m) => ({ default: m.FreelancerDashboardRequestsPage })));
const FreelancerDashboardBookingsPage = lazy(() => import('./pages/FreelancerDashboardBookingsPage').then((m) => ({ default: m.FreelancerDashboardBookingsPage })));
const FreelancerDashboardCalendarPage = lazy(() => import('./pages/FreelancerDashboardCalendarPage').then((m) => ({ default: m.FreelancerDashboardCalendarPage })));
const FreelancerDashboardAnalyticsPage = lazy(() => import('./pages/FreelancerDashboardAnalyticsPage').then((m) => ({ default: m.FreelancerDashboardAnalyticsPage })));
const FreelancerDashboardReviewsPage = lazy(() => import('./pages/FreelancerDashboardReviewsPage').then((m) => ({ default: m.FreelancerDashboardReviewsPage })));
const FreelancerDashboardEarningsPage = lazy(() => import('./pages/FreelancerDashboardEarningsPage').then((m) => ({ default: m.FreelancerDashboardEarningsPage })));
const FreelancerDashboardSettingsPage = lazy(() => import('./pages/FreelancerDashboardSettingsPage').then((m) => ({ default: m.FreelancerDashboardSettingsPage })));
const PremiumSubscriptionPage = lazy(() => import('./pages/PremiumSubscriptionPage').then((m) => ({ default: m.PremiumSubscriptionPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BookingTrackingClientPage = lazy(() => import('./pages/BookingTrackingClientPage').then((m) => ({ default: m.BookingTrackingClientPage })));
const BookingTrackingFreelancerPage = lazy(() => import('./pages/BookingTrackingFreelancerPage').then((m) => ({ default: m.BookingTrackingFreelancerPage })));
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage').then((m) => ({ default: m.MyBookingsPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const SavedPostsPage = lazy(() => import('./pages/SavedPostsPage').then((m) => ({ default: m.SavedPostsPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const ForYouPage = lazy(() => import('./pages/ForYouPage').then((m) => ({ default: m.ForYouPage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const ClientOnboardingPage = lazy(() => import('./pages/ClientOnboardingPage').then((m) => ({ default: m.ClientOnboardingPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));

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
    <>
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      {/* Make reset-password always available so recovery links open the reset UI even when a session is present */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Public Routes */}
      {!isAuthenticated && (
        <>
          <Route path="/login" element={<LoginPageWithRouting />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/signup" element={<SignUpPageWithRouting />} />
          <Route path="*" element={<Navigate to="/signup" replace />} />
        </>
      )}

      {/* Both roles must finish their onboarding flow before reaching the
          rest of the app — any other path bounces back to it. */}
      {isAuthenticated && user && !user.onboardingCompleted && (
        <>
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
                <BecomeFreelancerPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to={`/onboarding/${user.role}`} replace />} />
        </>
      )}

      {/* Protected Routes */}
      {isAuthenticated && user?.onboardingCompleted && (
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
                  <MapView onViewProfile={(id: string) => navigate(`/profile/${id}`)} />
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
                  <ForYouPage
                    onViewProfile={(id) => navigate(`/profile/${id}`)}
                    onOpenMessages={(recipientId) => navigate('/messages', { state: recipientId ? { openConversationWithUserId: recipientId } : undefined })}
                  />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Profile pages */}
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute>
                <FreelancerProfile
                  onBack={() => navigate(-1)}
                  requestStatus={null}
                  onOpenChat={(targetUserId) => navigate('/messages', { state: { openConversationWithUserId: targetUserId } })}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/:id"
            element={
              <ProtectedRoute>
                <TeamProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-profile"
            element={
              <ProtectedRoute>
                {user?.id ? <Navigate to={`/profile/${user.id}`} replace /> : null}
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfilePage onBack={() => navigate(-1)} />
              </ProtectedRoute>
            }
          />

          {/* Booking and requests */}
          <Route
            path="/requests"
            element={
              <ProtectedRoute>
                <RequestsPage
                  onBack={() => navigate('/explore')}
                  onViewProfile={(freelancerId) => navigate(`/profile/${freelancerId}`)}
                  onOpenMessages={(recipientId) => navigate('/messages', { state: recipientId ? { openConversationWithUserId: recipientId } : undefined })}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/group-request"
            element={
              <ProtectedRoute>
                <GroupRequestPage onBack={() => navigate(-1)} />
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
                <BookingTrackingClientPage onBack={() => navigate('/my-bookings')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-booking/:id"
            element={
              <ProtectedRoute>
                <BookingTrackingFreelancerPage onBack={() => navigate('/freelancer-dashboard/bookings')} />
              </ProtectedRoute>
            }
          />

          {/* User pages */}
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage onBack={() => navigate(-1)} onViewProfile={(id) => navigate(`/profile/${id}`)} />
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
            path="/saved-posts"
            element={
              <ProtectedRoute>
                <SavedPostsPage onBack={() => navigate('/explore')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? (
                  <Navigate to="/freelancer-dashboard/requests" replace />
                ) : (
                  <Navigate to="/become-freelancer" replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/portfolio"
            element={<Navigate to="/freelancer-dashboard/settings" replace />}
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
            path="/freelancer-dashboard/bookings"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardBookingsPage /> : <Navigate to="/become-freelancer" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/calendar"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardCalendarPage /> : <Navigate to="/become-freelancer" replace />}
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
            path="/freelancer-dashboard/reviews"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardReviewsPage /> : <Navigate to="/become-freelancer" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer-dashboard/earnings"
            element={
              <ProtectedRoute>
                {user?.role === 'freelancer' ? <FreelancerDashboardEarningsPage /> : <Navigate to="/become-freelancer" replace />}
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
                <ClientOnboardingPage onBack={() => navigate('/explore')} />
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
            path="/settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SettingsPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
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
    </Suspense>
    {isAuthenticated && user?.onboardingCompleted && <MobileBottomNav />}
    </>
  );
}
