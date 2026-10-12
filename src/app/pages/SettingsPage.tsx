import { useEffect, useState } from 'react';
import {
  Bell,
  ClipboardList,
  CreditCard,
  Globe,
  Heart,
  Lock,
  LogOut,
  Shield,
  User,
  UserX,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { authService } from '../../lib/authService';
import { normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { FREELANCER_CATEGORIES, MAX_MINOR_CATEGORIES } from '../../lib/categories';
import { PaymentMethodPicker } from '../components/payments/PaymentMethodPicker';
import { LegalContentModal } from '../../components/LegalContentModal';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { CLIENT_PREFERENCE_OPTIONS } from './ClientOnboardingPage';

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

interface SavedSettingsPayload {
  phoneNumber: string;
  preferences: PreferenceState;
  notifications: NotificationState;
  privacy: PrivacyState;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { setCurrency } = useCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [accountStatus, setAccountStatus] = useState<'active' | 'paused'>('active');
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPasswordForReset, setCurrentPasswordForReset] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState(defaultPreferences);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'limited'>('public');
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy' | null>(null);

  // What ExplorePage's "Recommended for you" scores against (see
  // ExplorePage.tsx's recommendedProfiles) - previously only ever set once,
  // during client onboarding, with no way to change it afterward.
  const [bookingInterests, setBookingInterests] = useState<string[]>([]);
  const [bookingPreferences, setBookingPreferences] = useState<string[]>([]);
  const [isSavingBookingPrefs, setIsSavingBookingPrefs] = useState(false);

  // The freelancer-viewer equivalent: ExplorePage sources clientInterests
  // from freelancer_profiles.title + minor_categories instead of
  // client_interests (freelancers have no client_interests of their own),
  // so this is what actually drives their "Recommended for you" peers.
  // title (the primary category) isn't editable here - changing it
  // invalidates previously-picked Skills/Styles the same way it does in
  // BecomeFreelancerPage, which needs that flow's confirm-and-reset step,
  // not a quick toggle.
  const [freelancerTitle, setFreelancerTitle] = useState<string | null>(null);
  const [freelancerMinorCategories, setFreelancerMinorCategories] = useState<string[]>([]);
  const [isSavingSpecialties, setIsSavingSpecialties] = useState(false);

  const role = (user?.role || 'client') as Role;

  // Stored server-side (unlike the localStorage toggles above) because the
  // server creates these notifications and has to be able to honour them.
  const [opportunityPrefs, setOpportunityPrefs] = useState({ opportunityAlerts: true, applicationUpdates: true });

  useEffect(() => {
    if (!user?.id || role !== 'freelancer') return;
    void DataService.getNotificationPreferences(user.id).then(setOpportunityPrefs);
  }, [user?.id, role]);

  const handleOpportunityPrefChange = async (patch: Partial<typeof opportunityPrefs>) => {
    if (!user?.id) return;
    const next = { ...opportunityPrefs, ...patch };
    setOpportunityPrefs(next);
    const { error } = await DataService.saveNotificationPreferences(user.id, next);
    if (error) {
      setOpportunityPrefs(opportunityPrefs);
      setErrorMessage('Unable to save that notification preference.');
    }
  };

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

      // Local-only fields first (language/theme/timezone/distanceUnit,
      // notifications) - these have no server copy at all. Read before the
      // DB response is applied below, not after: parsed.preferences/privacy
      // replace the whole object wholesale, so applying this second would
      // silently blow away the DB-authoritative currency/phone/privacy
      // values with whatever (possibly stale, possibly never-set) copy
      // happens to be sitting in this browser's localStorage - a real
      // pre-existing bug for currency alone before phone/privacy joined it.
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<SavedSettingsPayload>;
          setPhoneNumber(parsed.phoneNumber || '');
          setPreferences({ ...defaultPreferences, ...(parsed.preferences || {}) });
          setNotifications({ ...defaultNotifications, ...(parsed.notifications || {}) });
          setPrivacy({ ...defaultPrivacy, ...(parsed.privacy || {}) });
        } catch {
          // Ignore malformed local settings.
        }
      }

      if (userResponse.error) {
        setErrorMessage((userResponse.error as any).message || 'Unable to load settings.');
      } else {
        setEmail(userResponse.data?.email || user.email || '');
        setAccountStatus((userResponse.data as any)?.account_status === 'paused' ? 'paused' : 'active');
        setPreferences((current) => ({
          ...current,
          currency: normalizeCurrencyCode((userResponse.data as any)?.preferred_currency || current.currency, 'THB'),
        }));
        // Real columns, not the localStorage-only settings blob above - these
        // describe what OTHER people see about you (your phone number, and
        // whether it/your email show on your public profile), so they have
        // to be readable from any device/session, not just this browser.
        // Applied after the localStorage read on purpose, so the DB always
        // wins for these three fields specifically.
        if ((userResponse.data as any)?.phone) {
          setPhoneNumber((userResponse.data as any).phone);
        }
        setPrivacy((current) => ({
          ...current,
          hideEmailFromPublic: !!(userResponse.data as any)?.hide_email_from_public,
          hidePhoneFromPublic: !!(userResponse.data as any)?.hide_phone_from_public,
        }));
        if (Array.isArray((userResponse.data as any)?.client_interests)) {
          setBookingInterests((userResponse.data as any).client_interests);
        }
        if (Array.isArray((userResponse.data as any)?.client_preferences)) {
          setBookingPreferences((userResponse.data as any).client_preferences);
        }
      }

      if (freelancerResponse.data) {
        setProfileVisibility(freelancerResponse.data.visibility === 'limited' ? 'limited' : 'public');
        setFreelancerTitle((freelancerResponse.data as any).title || null);
        setFreelancerMinorCategories(
          Array.isArray((freelancerResponse.data as any).minor_categories) ? (freelancerResponse.data as any).minor_categories : []
        );
      }

      setIsLoading(false);
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [role, user?.email, user?.fullName, user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadBlockedUsers() {
      if (!user?.id) {
        if (isMounted) {
          setBlockedUsers([]);
        }
        return;
      }

      setIsLoadingBlocked(true);
      const response = await DataService.getBlockedUsers(user.id);
      if (isMounted) {
        setBlockedUsers(response.error ? [] : response.data);
        setIsLoadingBlocked(false);
      }
    }

    loadBlockedUsers();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const toggleBookingInterest = (value: string) => {
    setBookingInterests((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };
  const toggleBookingPreference = (value: string) => {
    setBookingPreferences((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const handleSaveBookingPreferences = async () => {
    if (!user?.id) return;
    setIsSavingBookingPrefs(true);
    setErrorMessage(null);
    const { error } = await DataService.updateUser(user.id, {
      client_interests: bookingInterests,
      client_preferences: bookingPreferences,
    } as any);
    setIsSavingBookingPrefs(false);
    if (error) {
      setErrorMessage('Unable to save your booking preferences.');
      return;
    }
    setStatusMessage('Booking preferences saved.');
  };

  const toggleFreelancerMinorCategory = (value: string) => {
    if (value === freelancerTitle) return;
    setFreelancerMinorCategories((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= MAX_MINOR_CATEGORIES) return current;
      return [...current, value];
    });
  };

  const handleSaveSpecialties = async () => {
    if (!user?.id) return;
    setIsSavingSpecialties(true);
    setErrorMessage(null);
    const { error } = await DataService.updateFreelancerProfile(user.id, {
      minor_categories: freelancerMinorCategories,
    } as any);
    setIsSavingSpecialties(false);
    if (error) {
      setErrorMessage('Unable to save your specialties.');
      return;
    }
    setStatusMessage('Specialties saved.');
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user?.id) return;

    setUnblockingId(blockedId);
    const response = await DataService.unblockUser(user.id, blockedId);
    setUnblockingId(null);

    if (response.error) {
      setErrorMessage((response.error as any).message || 'Unable to unblock this user.');
      return;
    }

    setBlockedUsers((current) => current.filter((row) => row.blocked_id !== blockedId));
  };

  const persistLocalSettings = () => {
    const payload: SavedSettingsPayload = {
      phoneNumber,
      preferences,
      notifications,
      privacy,
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('creativehub-settings-changed'));
    }
  };

  const handleSaveAccountSettings = async () => {
    if (!user?.id) return;

    setErrorMessage(null);
    setStatusMessage(null);

    if (email.trim() && email !== user.email) {
      const emailResult = await authService.updateEmail(email.trim());
      if (emailResult.error) {
        setErrorMessage((emailResult.error as any).message || 'Email update failed.');
        return;
      }
    }

    const contactResponse = await DataService.updateUser(user.id, {
      phone: phoneNumber.trim() || null,
      hide_email_from_public: privacy.hideEmailFromPublic,
      hide_phone_from_public: privacy.hidePhoneFromPublic,
      updated_at: new Date().toISOString(),
    } as any);

    if (contactResponse.error) {
      setErrorMessage((contactResponse.error as any).message || 'Unable to save contact/privacy settings.');
      return;
    }

    persistLocalSettings();
    setStatusMessage('Account settings saved.');
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;

    setPasswordFormError(null);

    if (!currentPasswordForReset) {
      setPasswordFormError('Enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFormError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFormError('Password confirmation does not match.');
      return;
    }

    setIsChangingPassword(true);

    // Supabase has no separate "verify this password" call - signing back in
    // with the entered current password IS that check: signInWithPassword
    // only succeeds if it actually matches, and since it's the same email,
    // a successful call just re-issues a session for this same account
    // rather than switching to a different one.
    const verifyResult = await authService.signIn({ email: user.email, password: currentPasswordForReset });
    if (verifyResult.error) {
      setIsChangingPassword(false);
      setPasswordFormError('Current password is incorrect.');
      return;
    }

    const passwordResult = await authService.updatePassword(newPassword);
    setIsChangingPassword(false);

    if (passwordResult.error) {
      setPasswordFormError((passwordResult.error as any).message || 'Password update failed.');
      return;
    }

    setCurrentPasswordForReset('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);
    setStatusMessage('Password changed.');
  };

  const handleSavePreferences = async () => {
    const normalizedCurrency = normalizeCurrencyCode(preferences.currency, 'THB');
    setPreferences((current) => ({ ...current, currency: normalizedCurrency }));

    if (user?.id) {
      const response = await DataService.updateUser(user.id, {
        preferred_currency: normalizedCurrency,
        updated_at: new Date().toISOString(),
      } as any);

      if (response.error) {
        setErrorMessage((response.error as any).message || 'Unable to save preferred currency.');
        return;
      }
    }

    await setCurrency(normalizedCurrency, false);
    persistLocalSettings();
    setStatusMessage('Preferences saved.');
    setErrorMessage(null);
  };

  const handleSaveVisibility = async () => {
    if (!user?.id || role !== 'freelancer') {
      return;
    }

    setStatusMessage(null);
    setErrorMessage(null);
    setIsSavingVisibility(true);

    const response = await DataService.updateFreelancerProfile(user.id, {
      visibility: profileVisibility,
      updated_at: new Date().toISOString(),
    } as any);

    setIsSavingVisibility(false);

    if (response.error) {
      setErrorMessage((response.error as any).message || 'Unable to save profile visibility.');
      return;
    }

    setStatusMessage('Profile visibility saved.');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== (email || '').trim().toLowerCase()) {
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    const { error } = await authService.deleteAccount();

    if (error) {
      setDeleteError(error.message || 'Unable to delete account.');
      setIsDeletingAccount(false);
      return;
    }

    navigate('/signup');
  };

  const handleTogglePause = async () => {
    if (!user?.id) return;

    const nextStatus = accountStatus === 'active' ? 'paused' : 'active';
    setIsTogglingPause(true);
    setErrorMessage(null);

    const response = await DataService.updateUser(user.id, { account_status: nextStatus } as any);

    setIsTogglingPause(false);

    if (response.error) {
      setErrorMessage((response.error as any).message || 'Unable to update account status.');
      return;
    }

    setAccountStatus(nextStatus);
    setStatusMessage(nextStatus === 'paused' ? 'Your account is paused — you\'re hidden from Explore and new requests are blocked.' : 'Your account is active again.');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-sky-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20 md:pb-10">
      <PageBackdrop />
      <div className="relative z-10">
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
          <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <User className="h-5 w-5" />
              <h2 className="text-lg font-bold">Account Settings</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. jane@example.com" className="rounded-lg border border-sky-100 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. +66 81 234 5678" className="rounded-lg border border-sky-100 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300" />
            </div>

            {!showPasswordForm ? (
              <button
                onClick={() => { setShowPasswordForm(true); setPasswordFormError(null); }}
                className="mt-4 rounded-lg border border-sky-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50"
              >
                Reset Password
              </button>
            ) : (
              <div className="mt-4 rounded-xl border-2 border-sky-200 bg-sky-50/50 p-4">
                <p className="mb-3 text-sm font-bold text-gray-900">Change your password</p>
                {passwordFormError && <p className="mb-3 text-sm text-red-600">{passwordFormError}</p>}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input
                    value={currentPasswordForReset}
                    onChange={(e) => setCurrentPasswordForReset(e.target.value)}
                    type="password"
                    placeholder="Current password"
                    className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="New password (at least 6 characters)"
                    className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    placeholder="Confirm new password"
                    className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPasswordForReset('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordFormError(null);
                    }}
                    disabled={isChangingPassword}
                    className="rounded-lg border border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleChangePassword()}
                    disabled={isChangingPassword}
                    className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                  >
                    {isChangingPassword ? 'Verifying…' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {role === 'freelancer' && (
                <button
                  onClick={() => void handleTogglePause()}
                  disabled={isTogglingPause}
                  className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                >
                  {isTogglingPause ? 'Updating…' : accountStatus === 'paused' ? 'Reactivate Account' : 'Pause Account'}
                </button>
              )}
              <button
                onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(''); setDeleteError(null); }}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Account
              </button>
            </div>
            {role === 'freelancer' && accountStatus === 'paused' && (
              <p className="mt-3 text-xs font-semibold text-amber-700">
                Your account is paused: you're hidden from Explore and search, and clients can't send you new booking requests.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={handleSaveAccountSettings} className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg">Save Account</button>
              <button onClick={handleLogout} className="rounded-lg border border-sky-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">Log out</button>
            </div>
          </section>


          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
                <h3 className="mb-2 text-lg font-bold text-gray-900">Delete your account?</h3>
                <p className="mb-4 text-sm text-gray-600">
                  This permanently deletes your account, profile, portfolio, and bookings. This can't be undone.
                </p>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Type your email ({email}) to confirm
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={email}
                  className="mb-3 w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                {deleteError && <p className="mb-3 text-sm text-red-600">{deleteError}</p>}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeletingAccount}
                    className="rounded-lg border border-sky-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleDeleteAccount()}
                    disabled={isDeletingAccount || deleteConfirmText.trim().toLowerCase() !== email.trim().toLowerCase()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeletingAccount ? 'Deleting…' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Shield className="h-5 w-5" />
              <h2 className="text-lg font-bold">Privacy & Security</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={privacy.hideEmailFromPublic} onChange={(e) => setPrivacy((c) => ({ ...c, hideEmailFromPublic: e.target.checked }))} /> Hide email from public</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={privacy.hidePhoneFromPublic} onChange={(e) => setPrivacy((c) => ({ ...c, hidePhoneFromPublic: e.target.checked }))} /> Hide phone from public</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={privacy.twoFactorFuture} onChange={(e) => setPrivacy((c) => ({ ...c, twoFactorFuture: e.target.checked }))} /> Enable 2FA (future)</label>
            </div>

            {role === 'freelancer' && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">Profile visibility</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value as 'public' | 'limited')}
                    className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  >
                    <option value="public">Public — visible in search & Explore</option>
                    <option value="limited">Limited — hidden from search & Explore</option>
                  </select>
                  <button
                    onClick={() => void handleSaveVisibility()}
                    disabled={isSavingVisibility}
                    className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                  >
                    {isSavingVisibility ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <UserX className="h-5 w-5" />
              <h2 className="text-lg font-bold">Blocked Accounts</h2>
            </div>
            {isLoadingBlocked ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm text-gray-500">You haven't blocked anyone.</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={row.blocked?.avatar_url || DEFAULT_AVATAR_URL}
                        alt={row.blocked?.full_name || 'Blocked user'}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <span className="text-sm font-semibold text-gray-900">{row.blocked?.full_name || 'Unknown user'}</span>
                    </div>
                    <button
                      onClick={() => void handleUnblock(row.blocked_id)}
                      disabled={unblockingId === row.blocked_id}
                      className="rounded-lg border border-sky-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 disabled:opacity-60"
                    >
                      {unblockingId === row.blocked_id ? 'Unblocking…' : 'Unblock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Bell className="h-5 w-5" />
              <h2 className="text-lg font-bold">Notifications</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailBookingRequests} onChange={(e) => setNotifications((c) => ({ ...c, emailBookingRequests: e.target.checked }))} /> Email: Booking requests</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailMessages} onChange={(e) => setNotifications((c) => ({ ...c, emailMessages: e.target.checked }))} /> Email: Messages</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailPromotions} onChange={(e) => setNotifications((c) => ({ ...c, emailPromotions: e.target.checked }))} /> Email: Promotions</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailPaymentUpdates} onChange={(e) => setNotifications((c) => ({ ...c, emailPaymentUpdates: e.target.checked }))} /> Email: Payment updates</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appMessages} onChange={(e) => setNotifications((c) => ({ ...c, appMessages: e.target.checked }))} /> In-app: New messages</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appBookingStatus} onChange={(e) => setNotifications((c) => ({ ...c, appBookingStatus: e.target.checked }))} /> In-app: Booking status</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appAIMatches} onChange={(e) => setNotifications((c) => ({ ...c, appAIMatches: e.target.checked }))} /> In-app: AI match recommendations</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.appReviews} onChange={(e) => setNotifications((c) => ({ ...c, appReviews: e.target.checked }))} /> In-app: Reviews received</label>
              {role === 'freelancer' && (
                <>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={opportunityPrefs.opportunityAlerts} onChange={(e) => void handleOpportunityPrefChange({ opportunityAlerts: e.target.checked })} /> In-app: New Group Request opportunities (Premium)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={opportunityPrefs.applicationUpdates} onChange={(e) => void handleOpportunityPrefChange({ applicationUpdates: e.target.checked })} /> In-app: Updates on my applications</label>
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Globe className="h-5 w-5" />
              <h2 className="text-lg font-bold">Preferences</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select value={preferences.language} onChange={(e) => setPreferences((c) => ({ ...c, language: e.target.value }))} className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300">
                <option value="English">English</option>
                <option value="Thai">ไทย</option>
              </select>
              <select value={preferences.theme} onChange={(e) => setPreferences((c) => ({ ...c, theme: e.target.value as 'light' | 'dark' }))} className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"><option value="light">Light</option><option value="dark">Dark</option></select>
              <input value={preferences.timezone} onChange={(e) => setPreferences((c) => ({ ...c, timezone: e.target.value }))} placeholder="e.g. Asia/Bangkok" className="rounded-lg border border-sky-100 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              <input value={preferences.currency} onChange={(e) => setPreferences((c) => ({ ...c, currency: e.target.value.toUpperCase() }))} placeholder="e.g. USD" className="rounded-lg border border-sky-100 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              <select value={preferences.distanceUnit} onChange={(e) => setPreferences((c) => ({ ...c, distanceUnit: e.target.value as 'km' | 'miles' }))} className="rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"><option value="km">Kilometers</option><option value="miles">Miles</option></select>
            </div>
          </section>

          {user?.id && (
            <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <CreditCard className="h-5 w-5" />
                <h2 className="text-lg font-bold">Payment Methods</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                {role === 'client'
                  ? 'Cards saved here can be used to pay booking deposits.'
                  : 'Cards saved here can be reused across CreativeHUB, including Freelancer Premium checkout.'}
              </p>
              <PaymentMethodPicker userId={user.id} />
            </section>
          )}

          {role === 'client' && (
            <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <ClipboardList className="h-5 w-5" />
                <h2 className="text-lg font-bold">Profile Setup</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                Finish or update your client profile — client type, services you're interested in, budget, and what
                matters most to you.
              </p>
              <button
                onClick={() => navigate('/onboarding/client')}
                className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg"
              >
                Complete your profile
              </button>
            </section>
          )}

          {role === 'client' && (
            <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <Heart className="h-5 w-5" />
                <h2 className="text-lg font-bold">Booking Preferences</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                What Explore's "Recommended for you" uses to pick freelancers for you — set once at signup, editable
                any time here.
              </p>

              <p className="mb-2 text-sm font-semibold text-gray-700">Services you're interested in</p>
              <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3">
                {FREELANCER_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleBookingInterest(category.label)}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all ${
                      bookingInterests.includes(category.label)
                        ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                        : 'border-sky-100 text-gray-600 hover:border-sky-300'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <p className="mb-2 text-sm font-semibold text-gray-700">What matters most to you</p>
              <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                {CLIENT_PREFERENCE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-sky-100 px-3 py-2 hover:border-sky-300"
                  >
                    <input
                      type="checkbox"
                      checked={bookingPreferences.includes(option.value)}
                      onChange={() => toggleBookingPreference(option.value)}
                      className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-400"
                    />
                    <span className="text-sm font-semibold text-gray-800">{option.label}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={() => void handleSaveBookingPreferences()}
                disabled={isSavingBookingPrefs}
                className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
              >
                {isSavingBookingPrefs ? 'Saving...' : 'Save preferences'}
              </button>
            </section>
          )}

          {role === 'freelancer' && (
            <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <Heart className="h-5 w-5" />
                <h2 className="text-lg font-bold">Specialties</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                What Explore's "Recommended for you" uses to show you other freelancers worth following. Your main
                specialty is always included; add other categories you're interested in below.
              </p>

              <p className="mb-2 text-sm font-semibold text-gray-700">
                Main specialty{freelancerTitle ? `: ${freelancerTitle}` : ''}
              </p>
              <p className="mb-4 text-xs text-gray-500">
                Changing your main specialty also resets your Skills and Styles, so it isn't available here yet —
                contact support if you need it changed.
              </p>

              <p className="mb-2 text-sm font-semibold text-gray-700">
                Other categories you're interested in ({freelancerMinorCategories.length}/{MAX_MINOR_CATEGORIES})
              </p>
              <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3">
                {FREELANCER_CATEGORIES.filter((category) => category.label !== freelancerTitle).map((category) => {
                  const selected = freelancerMinorCategories.includes(category.label);
                  const disabled = !selected && freelancerMinorCategories.length >= MAX_MINOR_CATEGORIES;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleFreelancerMinorCategory(category.label)}
                      disabled={disabled}
                      className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all ${
                        selected
                          ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                          : 'border-sky-100 text-gray-600 hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-sky-100'
                      }`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => void handleSaveSpecialties()}
                disabled={isSavingSpecialties}
                className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
              >
                {isSavingSpecialties ? 'Saving...' : 'Save specialties'}
              </button>
            </section>
          )}

          <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Lock className="h-5 w-5" />
              <h2 className="text-lg font-bold">Terms & Support</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => setLegalModalTab('privacy')} className="rounded-lg border border-sky-100 px-3 py-2 text-gray-700 hover:bg-sky-50">Privacy Policy</button>
              <button type="button" onClick={() => setLegalModalTab('terms')} className="rounded-lg border border-sky-100 px-3 py-2 text-gray-700 hover:bg-sky-50">Terms of Service</button>
              <button
                onClick={() => navigate('/tickets')}
                className="rounded-lg border border-sky-100 px-3 py-2 text-gray-700 hover:bg-sky-50"
              >
                Create a Ticket
              </button>
            </div>
          </section>

          <div className="flex items-center justify-between">
            <button onClick={() => void handleSavePreferences()} className="rounded-lg border border-sky-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50">Save Global Preferences</button>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg"><LogOut className="h-4 w-4" /> Log out</button>
          </div>
        </div>
      </div>

      {legalModalTab && <LegalContentModal initialTab={legalModalTab} onClose={() => setLegalModalTab(null)} />}
      </div>
    </div>
  );
}
