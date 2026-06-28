import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Globe,
  Lock,
  LogOut,
  Shield,
  Star,
  User,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../lib/authService';
import { DataService } from '../../lib/dataService';

type Role = 'freelancer' | 'client';

interface PreferenceState {
  language: string;
  theme: 'light' | 'dark';
  timezone: string;
  currency: string;
  distanceUnit: 'km' | 'miles';
}

interface NotificationState {
  emailBookingRequests: boolean;
  emailMessages: boolean;
  emailTeamInvites: boolean;
  emailPromotions: boolean;
  emailPaymentUpdates: boolean;
  appMessages: boolean;
  appBookingStatus: boolean;
  appAIMatches: boolean;
  appReviews: boolean;
}

interface PrivacyState {
  hideEmailFromPublic: boolean;
  hidePhoneFromPublic: boolean;
  twoFactorFuture: boolean;
}

interface FreelancerSettingsState {
  portfolioLayout: 'grid' | 'masonry';
  showProjectPrices: boolean;
  showClientNames: boolean;
  availability: 'available' | 'busy' | 'unavailable';
  workingDays: string[];
  vacationUntil: string;
  startingPrice: string;
  pricingCurrency: string;
  mapVisibility: 'exact' | 'city' | 'hidden';
  includeInAIMatching: boolean;
  showAnalyticsProjects: boolean;
  showAnalyticsResponseRate: boolean;
  showAnalyticsTrustScore: boolean;
  showAnalyticsCompletedBookings: boolean;
}

interface ClientSettingsState {
  preferredStyles: string;
  preferredFreelancerTypes: string;
  defaultBudgetRange: string;
  preferredSearchArea: string;
  preferredSearchRadius: string;
  useAIRecommendations: boolean;
}

const SETTINGS_STORAGE_KEY = 'creativehub.settings.v1';

const defaultPreferences: PreferenceState = {
  language: 'English',
  theme: 'light',
  timezone: 'Asia/Bangkok',
  currency: 'USD',
  distanceUnit: 'km',
};

const defaultNotifications: NotificationState = {
  emailBookingRequests: true,
  emailMessages: true,
  emailTeamInvites: true,
  emailPromotions: false,
  emailPaymentUpdates: true,
  appMessages: true,
  appBookingStatus: true,
  appAIMatches: true,
  appReviews: true,
};

const defaultPrivacy: PrivacyState = {
  hideEmailFromPublic: false,
  hidePhoneFromPublic: false,
  twoFactorFuture: false,
};

const defaultFreelancerSettings: FreelancerSettingsState = {
  portfolioLayout: 'grid',
  showProjectPrices: true,
  showClientNames: true,
  availability: 'available',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  vacationUntil: '',
  startingPrice: '200',
  pricingCurrency: 'USD',
  mapVisibility: 'city',
  includeInAIMatching: true,
  showAnalyticsProjects: true,
  showAnalyticsResponseRate: true,
  showAnalyticsTrustScore: true,
  showAnalyticsCompletedBookings: true,
};

const defaultClientSettings: ClientSettingsState = {
  preferredStyles: 'Minimalist, Luxury, Vintage',
  preferredFreelancerTypes: 'Photographers, Designers, Videographers',
  defaultBudgetRange: '$200-$500',
  preferredSearchArea: 'Bangkok',
  preferredSearchRadius: '50',
  useAIRecommendations: true,
};

interface SavedSettingsPayload {
  phoneNumber: string;
  preferences: PreferenceState;
  notifications: NotificationState;
  privacy: PrivacyState;
  freelancer: FreelancerSettingsState;
  client: ClientSettingsState;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [preferences, setPreferences] = useState(defaultPreferences);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [freelancerSettings, setFreelancerSettings] = useState(defaultFreelancerSettings);
  const [clientSettings, setClientSettings] = useState(defaultClientSettings);

  const role = (user?.role || 'client') as Role;

  const planLabel = useMemo(() => {
    return role === 'freelancer' ? 'Free (Freelancer)' : 'Free (Client)';
  }, [role]);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!user?.id) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [userResponse, freelancerResponse] = await Promise.all([
        DataService.getUser(user.id),
        role === 'freelancer' ? DataService.getFreelancerProfile(user.id) : Promise.resolve({ data: null, error: null }),
      ]);

      if (!isMounted) {
        return;
      }

      if (userResponse.error) {
        setErrorMessage((userResponse.error as any).message || 'Unable to load settings.');
      } else {
        setFullName(userResponse.data?.full_name || user.fullName || '');
        setEmail(userResponse.data?.email || user.email || '');
      }

      if (freelancerResponse.data) {
        setFreelancerSettings((current) => ({
          ...current,
          availability: freelancerResponse.data.is_available ? 'available' : 'unavailable',
          startingPrice: freelancerResponse.data.hourly_rate ? String(freelancerResponse.data.hourly_rate) : current.startingPrice,
        }));
      }

      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<SavedSettingsPayload>;
          setPhoneNumber(parsed.phoneNumber || '');
          setPreferences({ ...defaultPreferences, ...(parsed.preferences || {}) });
          setNotifications({ ...defaultNotifications, ...(parsed.notifications || {}) });
          setPrivacy({ ...defaultPrivacy, ...(parsed.privacy || {}) });
          setFreelancerSettings({ ...defaultFreelancerSettings, ...(parsed.freelancer || {}) });
          setClientSettings({ ...defaultClientSettings, ...(parsed.client || {}) });
        } catch {
          // Ignore malformed local settings.
        }
      }

      setIsLoading(false);
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [role, user?.email, user?.fullName, user?.id]);

  const persistLocalSettings = () => {
    const payload: SavedSettingsPayload = {
      phoneNumber,
      preferences,
      notifications,
      privacy,
      freelancer: freelancerSettings,
      client: clientSettings,
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  };

  const handleSaveAccountSettings = async () => {
    if (!user?.id) return;

    setErrorMessage(null);
    setStatusMessage(null);

    const userUpdate = await DataService.updateUser(user.id, {
      full_name: fullName,
      updated_at: new Date().toISOString(),
    } as any);

    if (userUpdate.error) {
      setErrorMessage((userUpdate.error as any).message || 'Unable to update profile info.');
      return;
    }

    if (email.trim() && email !== user.email) {
      const emailResult = await authService.updateEmail(email.trim());
      if (emailResult.error) {
        setErrorMessage((emailResult.error as any).message || 'Email update failed.');
        return;
      }
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMessage('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('Password confirmation does not match.');
        return;
      }

      const passwordResult = await authService.updatePassword(newPassword);
      if (passwordResult.error) {
        setErrorMessage((passwordResult.error as any).message || 'Password update failed.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }

    persistLocalSettings();
    setStatusMessage('Account settings saved.');
  };

  const handleSavePreferences = () => {
    persistLocalSettings();
    setStatusMessage('Preferences saved.');
    setErrorMessage(null);
  };

  const handleSaveFreelancerSettings = async () => {
    if (!user?.id || role !== 'freelancer') {
      return;
    }

    setStatusMessage(null);
    setErrorMessage(null);

    const hourlyRate = Number(freelancerSettings.startingPrice);

    const response = await DataService.updateFreelancerProfile(user.id, {
      hourly_rate: Number.isFinite(hourlyRate) ? hourlyRate : null,
      is_available: freelancerSettings.availability === 'available',
      updated_at: new Date().toISOString(),
    } as any);

    if (response.error) {
      setErrorMessage((response.error as any).message || 'Unable to save freelancer settings.');
      return;
    }

    persistLocalSettings();
    setStatusMessage('Freelancer settings saved.');
  };

  const handleSaveClientSettings = () => {
    persistLocalSettings();
    setStatusMessage('Client preferences saved.');
    setErrorMessage(null);
  };

  const toggleWorkingDay = (day: string) => {
    setFreelancerSettings((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day],
    }));
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-10">
      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
        <h1 className="mb-1 text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mb-6 text-sm text-gray-600">Customize account, privacy, notifications, and role-specific preferences.</p>

        {statusMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statusMessage}</div>
        )}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        )}

        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <User className="h-5 w-5" />
              <h2 className="text-lg font-bold">Account Settings</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone number" className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" placeholder="Current password (optional)" className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="New password" className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" className="rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={handleSaveAccountSettings} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Save Account</button>
              <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Log out</button>
              <button
                onClick={() => setErrorMessage('Self-service account deletion is not enabled yet. Use Contact Support to request deletion.')}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Account
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Shield className="h-5 w-5" />
              <h2 className="text-lg font-bold">Privacy & Security</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={privacy.hideEmailFromPublic} onChange={(e) => setPrivacy((c) => ({ ...c, hideEmailFromPublic: e.target.checked }))} /> Hide email from public</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={privacy.hidePhoneFromPublic} onChange={(e) => setPrivacy((c) => ({ ...c, hidePhoneFromPublic: e.target.checked }))} /> Hide phone from public</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={privacy.twoFactorFuture} onChange={(e) => setPrivacy((c) => ({ ...c, twoFactorFuture: e.target.checked }))} /> Enable 2FA (future)</label>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Bell className="h-5 w-5" />
              <h2 className="text-lg font-bold">Notifications</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailBookingRequests} onChange={(e) => setNotifications((c) => ({ ...c, emailBookingRequests: e.target.checked }))} /> Email: Booking requests</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailMessages} onChange={(e) => setNotifications((c) => ({ ...c, emailMessages: e.target.checked }))} /> Email: Messages</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailTeamInvites} onChange={(e) => setNotifications((c) => ({ ...c, emailTeamInvites: e.target.checked }))} /> Email: Team invitations</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailPromotions} onChange={(e) => setNotifications((c) => ({ ...c, emailPromotions: e.target.checked }))} /> Email: Promotions</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailPaymentUpdates} onChange={(e) => setNotifications((c) => ({ ...c, emailPaymentUpdates: e.target.checked }))} /> Email: Payment updates</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appMessages} onChange={(e) => setNotifications((c) => ({ ...c, appMessages: e.target.checked }))} /> In-app: New messages</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appBookingStatus} onChange={(e) => setNotifications((c) => ({ ...c, appBookingStatus: e.target.checked }))} /> In-app: Booking status</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appAIMatches} onChange={(e) => setNotifications((c) => ({ ...c, appAIMatches: e.target.checked }))} /> In-app: AI match recommendations</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appReviews} onChange={(e) => setNotifications((c) => ({ ...c, appReviews: e.target.checked }))} /> In-app: Reviews received</label>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Globe className="h-5 w-5" />
              <h2 className="text-lg font-bold">Preferences</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input value={preferences.language} onChange={(e) => setPreferences((c) => ({ ...c, language: e.target.value }))} placeholder="Language" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={preferences.theme} onChange={(e) => setPreferences((c) => ({ ...c, theme: e.target.value as 'light' | 'dark' }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="light">Light</option><option value="dark">Dark</option></select>
              <input value={preferences.timezone} onChange={(e) => setPreferences((c) => ({ ...c, timezone: e.target.value }))} placeholder="Time zone" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={preferences.currency} onChange={(e) => setPreferences((c) => ({ ...c, currency: e.target.value }))} placeholder="Currency" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={preferences.distanceUnit} onChange={(e) => setPreferences((c) => ({ ...c, distanceUnit: e.target.value as 'km' | 'miles' }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="km">Kilometers</option><option value="miles">Miles</option></select>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-gray-900">
              <Star className="h-5 w-5" />
              <h2 className="text-lg font-bold">Membership</h2>
            </div>
            <p className="text-sm text-gray-700">Current Plan: <span className="font-semibold">{planLabel}</span></p>
            <button onClick={() => navigate('/premium')} className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Upgrade / Manage Plan</button>
          </section>

          {role === 'freelancer' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <Wrench className="h-5 w-5" />
                <h2 className="text-lg font-bold">Freelancer Settings</h2>
              </div>
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <p className="mb-2 font-semibold">Portfolio Settings</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select value={freelancerSettings.portfolioLayout} onChange={(e) => setFreelancerSettings((c) => ({ ...c, portfolioLayout: e.target.value as 'grid' | 'masonry' }))} className="rounded-lg border border-gray-300 px-3 py-2"><option value="grid">Grid layout</option><option value="masonry">Masonry layout</option></select>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.showProjectPrices} onChange={(e) => setFreelancerSettings((c) => ({ ...c, showProjectPrices: e.target.checked }))} /> Show project prices</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.showClientNames} onChange={(e) => setFreelancerSettings((c) => ({ ...c, showClientNames: e.target.checked }))} /> Show client names</label>
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-semibold">Availability & Pricing</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <select value={freelancerSettings.availability} onChange={(e) => setFreelancerSettings((c) => ({ ...c, availability: e.target.value as 'available' | 'busy' | 'unavailable' }))} className="rounded-lg border border-gray-300 px-3 py-2"><option value="available">Available</option><option value="busy">Busy</option><option value="unavailable">Unavailable</option></select>
                    <input value={freelancerSettings.startingPrice} onChange={(e) => setFreelancerSettings((c) => ({ ...c, startingPrice: e.target.value }))} placeholder="Starting price" className="rounded-lg border border-gray-300 px-3 py-2" />
                    <input value={freelancerSettings.pricingCurrency} onChange={(e) => setFreelancerSettings((c) => ({ ...c, pricingCurrency: e.target.value }))} placeholder="Currency" className="rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <button key={day} type="button" onClick={() => toggleWorkingDay(day)} className={`rounded-full border px-3 py-1 text-xs ${freelancerSettings.workingDays.includes(day) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700'}`}>{day}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-semibold">Location & AI Preferences</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select value={freelancerSettings.mapVisibility} onChange={(e) => setFreelancerSettings((c) => ({ ...c, mapVisibility: e.target.value as 'exact' | 'city' | 'hidden' }))} className="rounded-lg border border-gray-300 px-3 py-2"><option value="exact">Show exact location</option><option value="city">Show city only</option><option value="hidden">Hide my location</option></select>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.includeInAIMatching} onChange={(e) => setFreelancerSettings((c) => ({ ...c, includeInAIMatching: e.target.checked }))} /> Include my portfolio in AI matching</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.showAnalyticsProjects} onChange={(e) => setFreelancerSettings((c) => ({ ...c, showAnalyticsProjects: e.target.checked }))} /> Show total projects</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.showAnalyticsResponseRate} onChange={(e) => setFreelancerSettings((c) => ({ ...c, showAnalyticsResponseRate: e.target.checked }))} /> Show response rate</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.showAnalyticsTrustScore} onChange={(e) => setFreelancerSettings((c) => ({ ...c, showAnalyticsTrustScore: e.target.checked }))} /> Show trust score</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={freelancerSettings.showAnalyticsCompletedBookings} onChange={(e) => setFreelancerSettings((c) => ({ ...c, showAnalyticsCompletedBookings: e.target.checked }))} /> Show completed bookings</label>
                  </div>
                </div>

                <button onClick={handleSaveFreelancerSettings} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black">Save Freelancer Settings</button>
              </div>
            </section>
          )}

          {role === 'client' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <Bot className="h-5 w-5" />
                <h2 className="text-lg font-bold">Client Preferences</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
                <input value={clientSettings.preferredStyles} onChange={(e) => setClientSettings((c) => ({ ...c, preferredStyles: e.target.value }))} placeholder="Preferred styles" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={clientSettings.preferredFreelancerTypes} onChange={(e) => setClientSettings((c) => ({ ...c, preferredFreelancerTypes: e.target.value }))} placeholder="Preferred freelancer types" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={clientSettings.defaultBudgetRange} onChange={(e) => setClientSettings((c) => ({ ...c, defaultBudgetRange: e.target.value }))} placeholder="Default budget range" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={clientSettings.preferredSearchArea} onChange={(e) => setClientSettings((c) => ({ ...c, preferredSearchArea: e.target.value }))} placeholder="Preferred search area" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={clientSettings.preferredSearchRadius} onChange={(e) => setClientSettings((c) => ({ ...c, preferredSearchRadius: e.target.value }))} placeholder="Radius" className="rounded-lg border border-gray-300 px-3 py-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={clientSettings.useAIRecommendations} onChange={(e) => setClientSettings((c) => ({ ...c, useAIRecommendations: e.target.checked }))} /> Use AI recommendations</label>
              </div>
              <button onClick={handleSaveClientSettings} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Save Client Settings</button>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Lock className="h-5 w-5" />
              <h2 className="text-lg font-bold">Terms & Support</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a href="#" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Privacy Policy</a>
              <a href="#" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Terms of Service</a>
              <a href="#" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">FAQ</a>
              <a href="#" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Contact Support</a>
              <a href="#" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Report a Bug</a>
            </div>
          </section>

          <div className="flex items-center justify-between">
            <button onClick={handleSavePreferences} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Save Global Preferences</button>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"><LogOut className="h-4 w-4" /> Log out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
