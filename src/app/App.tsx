import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useNavigationType } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PremiumGate } from '../components/PremiumGate';
import { AdminRoute } from '../components/AdminRoute';
import { MainLayout } from '../components/MainLayout';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { GlobalReviewPrompt } from '../components/GlobalReviewPrompt';
import { ChatbotWidget } from '../components/ChatbotWidget';
import { NotificationToastHost } from './components/common/NotificationToastHost';
import { BootSplash } from './components/BootSplash';
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
const EventMatcherPage = lazy(() => import('./pages/EventMatcherPage').then((m) => ({ default: m.EventMatcherPage })));
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
const MyTicketsPage = lazy(() => import('./pages/MyTicketsPage').then((m) => ({ default: m.MyTicketsPage })));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })));
const DisputeTicketDetailPage = lazy(() => import('./pages/DisputeTicketDetailPage').then((m) => ({ default: m.DisputeTicketDetailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BookingTrackingClientPage = lazy(() => import('./pages/BookingTrackingClientPage').then((m) => ({ default: m.BookingTrackingClientPage })));
const BookingTrackingFreelancerPage = lazy(() => import('./pages/BookingTrackingFreelancerPage').then((m) => ({ default: m.BookingTrackingFreelancerPage })));
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage').then((m) => ({ default: m.MyBookingsPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const SavedPostsPage = lazy(() => import('./pages/SavedPostsPage').then((m) => ({ default: m.SavedPostsPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const ForYouPage = lazy(() => import('./pages/ForYouPage').then((m) => ({ default: m.ForYouPage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const PublicPostPage = lazy(() => import('./pages/PublicPostPage').then((m) => ({ default: m.PublicPostPage })));
const TermsOfServicePage = lazy(() => import('./pages/legal/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const ClientOnboardingPage = lazy(() => import('./pages/ClientOnboardingPage').then((m) => ({ default: m.ClientOnboardingPage })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage })));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage').then((m) => ({ default: m.AdminBookingsPage })));
const AdminBookingDetailPage = lazy(() => import('./pages/admin/AdminBookingDetailPage').then((m) => ({ default: m.AdminBookingDetailPage })));
const AdminEarningsPage = lazy(() => import('./pages/admin/AdminEarningsPage').then((m) => ({ default: m.AdminEarningsPage })));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage').then((m) => ({ default: m.AdminDisputesPage })));
const AdminDisputeDetailPage = lazy(() => import('./pages/admin/AdminDisputeDetailPage').then((m) => ({ default: m.AdminDisputeDetailPage })));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage').then((m) => ({ default: m.AdminAttendancePage })));
const AdminAttendanceDetailPage = lazy(() => import('./pages/admin/AdminAttendanceDetailPage').then((m) => ({ default: m.AdminAttendanceDetailPage })));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminReportDetailPage = lazy(() => import('./pages/admin/AdminReportDetailPage').then((m) => ({ default: m.AdminReportDetailPage })));
const AdminTicketDetailPage = lazy(() => import('./pages/admin/AdminTicketDetailPage').then((m) => ({ default: m.AdminTicketDetailPage })));
const AdminAuditLogPage = lazy(() => import('./pages/admin/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })));

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
        <p className="text-sm text-gray-600">Checking authentication...</p>
      </div>
    </div>
  );
}

function SupabaseSetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-sky-100 bg-white p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)] md:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-lg font-bold text-white">
          CH
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Supabase setup needed</h1>
        <p className="mb-6 text-sm leading-6 text-gray-600">
          CreativeHUB needs your Supabase project URL and anon key before it can show the app.
        </p>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
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
  const location = useLocation();
  const navigationType = useNavigationType();

  // React Router doesn't reset scroll on navigation the way a full page
  // load would — clicking to a new route (e.g. Explore -> Event Assistant)
  // otherwise keeps whatever scrollY the previous page was left at, landing
  // partway down the new page instead of at its top. Skipped for 'POP'
  // (browser back/forward) so pages with their own scroll-restoration logic
  // — see ExplorePage's explorePageScrollY — can still put the scroll back
  // where the user left it instead of this forcing it to 0 first.
  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navigationType]);

  if (loading) {
    return <BootSplash />;
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
      {/* A shared post must open for a logged-out visitor too, so this is
          unconditional like reset-password above — never nested inside the
          isAuthenticated/!isAuthenticated blocks below, otherwise the
          logged-out block's own catch-all (`*` -> /signup) would swallow it. */}
      <Route path="/post/:postId" element={<PublicPostPage />} />
      {/* Same reasoning — a prospective signer-upper must be able to read
          these before creating an account, so they can't sit behind the
          logged-out block's own catch-all either. */}
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      {/* Public Routes */}
      {!isAuthenticated && (
        <>
          <Route path="/login" element={<LoginPageWithRouting />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/signup" element={<SignUpPageWithRouting />} />
          {/* Guests can browse these three the same as a signed-in user -
              MainLayout and each page already null-guard every use of
              `user`, so no ProtectedRoute wrapper here. Everything else
              still funnels through the catch-all below. */}
          <Route path="/explore" element={<MainLayout><ExplorePage /></MainLayout>} />
          <Route
            path="/map"
            element={
              <MainLayout>
                <MapView onViewProfile={(id: string) => navigate(`/profile/${id}`)} />
              </MainLayout>
            }
          />
          <Route
            path="/for-you"
            element={
              <MainLayout>
                <ForYouPage
                  onViewProfile={(id) => navigate(`/profile/${id}`)}
                  onOpenMessages={() => navigate('/login')}
                />
              </MainLayout>
            }
          />
          {/* Public profile pages - browsable, but every write action inside
              them (favorite, follow, message, book, report) is soft-gated
              via AuthPromptModal rather than hidden or crashing. */}
          <Route
            path="/profile/:id"
            element={
              <FreelancerProfile
                onBack={() => navigate(-1)}
                requestStatus={null}
                onOpenChat={() => navigate('/login')}
              />
            }
          />
          <Route path="/team/:id" element={<TeamProfilePage />} />
          <Route path="/" element={<Navigate to="/explore" replace />} />
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
                <PremiumGate
                  featureName="Group Request"
                  featureDescription="Book multiple freelancers together for one event with a single coordinated request."
                >
                  <GroupRequestPage onBack={() => navigate(-1)} />
                </PremiumGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event-matcher"
            element={
              <ProtectedRoute>
                <PremiumGate
                  featureName="Event Assistant"
                  featureDescription="Describe your event and let CreativeHUB match you with the right freelancers automatically."
                >
                  <EventMatcherPage onBack={() => navigate(-1)} />
                </PremiumGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <MyTicketsPage onBack={() => navigate('/explore')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <ProtectedRoute>
                <TicketDetailPage onBack={() => navigate('/tickets')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/dispute/:id"
            element={
              <ProtectedRoute>
                <DisputeTicketDetailPage onBack={() => navigate('/tickets')} />
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
          <Route path="/admin" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/users/:id" element={<AdminRoute><AdminUserDetailPage /></AdminRoute>} />
          <Route path="/admin/bookings" element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />
          <Route path="/admin/bookings/:id" element={<AdminRoute><AdminBookingDetailPage /></AdminRoute>} />
          <Route path="/admin/earnings" element={<AdminRoute><AdminEarningsPage /></AdminRoute>} />
          <Route path="/admin/disputes" element={<AdminRoute><AdminDisputesPage /></AdminRoute>} />
          <Route path="/admin/disputes/:id" element={<AdminRoute><AdminDisputeDetailPage /></AdminRoute>} />
          <Route path="/admin/attendance" element={<AdminRoute><AdminAttendancePage /></AdminRoute>} />
          <Route path="/admin/attendance/:id" element={<AdminRoute><AdminAttendanceDetailPage /></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
          <Route path="/admin/reports/:id" element={<AdminRoute><AdminReportDetailPage /></AdminRoute>} />
          <Route path="/admin/tickets/:id" element={<AdminRoute><AdminTicketDetailPage /></AdminRoute>} />
          <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogPage /></AdminRoute>} />
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
    {(
      (isAuthenticated && user?.onboardingCompleted) ||
      (!isAuthenticated && ['/explore', '/map', '/for-you'].includes(location.pathname))
    ) && <MobileBottomNav />}
    {isAuthenticated && user?.onboardingCompleted && <GlobalReviewPrompt />}
    {isAuthenticated && user?.onboardingCompleted && <ChatbotWidget />}
    {isAuthenticated && <NotificationToastHost />}
    </>
  );
}
