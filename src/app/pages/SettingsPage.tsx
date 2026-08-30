import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  ClipboardList,
  CreditCard,
  Globe,
  Lock,
  LogOut,
  Shield,
  Star,
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
import { PaymentMethodPicker } from '../components/payments/PaymentMethodPicker';

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [preferences, setPreferences] = useState(defaultPreferences);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'limited'>('public');
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<'technical' | 'payment' | 'account' | 'booking' | 'suggestion' | 'other'>('technical');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

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
        setEmail(userResponse.data?.email || user.email || '');
        setAccountStatus((userResponse.data as any)?.account_status === 'paused' ? 'paused' : 'active');
        setPreferences((current) => ({
          ...current,
          currency: normalizeCurrencyCode((userResponse.data as any)?.preferred_currency || current.currency, 'THB'),
        }));
      }

      if (freelancerResponse.data) {
        setProfileVisibility(freelancerResponse.data.visibility === 'limited' ? 'limited' : 'public');
      }

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

  const handleSubmitTicket = async () => {
    if (!user?.id || !ticketDescription.trim()) {
      setErrorMessage('Describe the issue before submitting.');
      return;
    }

    setIsSubmittingTicket(true);
    setErrorMessage(null);

    let screenshotPath: string | null = null;
    if (ticketFile) {
      const uploadResponse = await DataService.uploadReportEvidencePhoto(user.id, ticketFile);
      if (uploadResponse.error || !uploadResponse.path) {
        setErrorMessage('Unable to upload the screenshot.');
        setIsSubmittingTicket(false);
        return;
      }
      screenshotPath = uploadResponse.path;
    }

    const response = await DataService.submitSupportTicket({
      userId: user.id,
      category: ticketCategory,
      description: ticketDescription.trim(),
      screenshotPath,
    });

    setIsSubmittingTicket(false);

    if (response.error) {
      setErrorMessage((response.error as any).message || 'Unable to submit ticket.');
      return;
    }

    setTicketSubmitted(true);
    setTicketDescription('');
    setTicketFile(null);
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
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. jane@example.com" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. +66 81 234 5678" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
              <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" placeholder="Current password (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="At least 6 characters" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Re-enter new password" className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={handleSaveAccountSettings} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">Save Account</button>
              <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Log out</button>
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
          </section>

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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
                  className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {deleteError && <p className="mb-3 text-sm text-red-600">{deleteError}</p>}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeletingAccount}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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

            {role === 'freelancer' && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">Profile visibility</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value as 'public' | 'limited')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="public">Public — visible in search & Explore</option>
                    <option value="limited">Limited — hidden from search & Explore</option>
                  </select>
                  <button
                    onClick={() => void handleSaveVisibility()}
                    disabled={isSavingVisibility}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {isSavingVisibility ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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
                  <div key={row.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
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
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {unblockingId === row.blocked_id ? 'Unblocking…' : 'Unblock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              <select value={preferences.language} onChange={(e) => setPreferences((c) => ({ ...c, language: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="English">English</option>
                <option value="Thai">ไทย</option>
              </select>
              <select value={preferences.theme} onChange={(e) => setPreferences((c) => ({ ...c, theme: e.target.value as 'light' | 'dark' }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="light">Light</option><option value="dark">Dark</option></select>
              <input value={preferences.timezone} onChange={(e) => setPreferences((c) => ({ ...c, timezone: e.target.value }))} placeholder="e.g. Asia/Bangkok" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              <input value={preferences.currency} onChange={(e) => setPreferences((c) => ({ ...c, currency: e.target.value.toUpperCase() }))} placeholder="e.g. USD" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
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

          {role === 'client' && user?.id && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <CreditCard className="h-5 w-5" />
                <h2 className="text-lg font-bold">Payment Methods</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600">Cards saved here can be used to pay booking deposits.</p>
              <PaymentMethodPicker userId={user.id} />
            </section>
          )}

          {role === 'client' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Complete your profile
              </button>
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
              <button
                onClick={() => {
                  setTicketSubmitted(false);
                  setShowTicketModal(true);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                Report an Issue
              </button>
            </div>
          </section>

          <div className="flex items-center justify-between">
            <button onClick={() => void handleSavePreferences()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Save Global Preferences</button>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"><LogOut className="h-4 w-4" /> Log out</button>
          </div>
        </div>
      </div>

      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {ticketSubmitted ? (
              <>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Thanks for letting us know</h3>
                <p className="mb-4 text-sm text-gray-600">Our team will look into it.</p>
                <button
                  onClick={() => setShowTicketModal(false)}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Report an Issue</h3>
                  <button onClick={() => setShowTicketModal(false)} className="text-gray-400 hover:text-gray-900">✕</button>
                </div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value as any)}
                  className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="technical">Technical problem</option>
                  <option value="payment">Payment problem</option>
                  <option value="account">Account problem</option>
                  <option value="booking">Booking problem</option>
                  <option value="suggestion">Suggestion / Feedback</option>
                  <option value="other">Other</option>
                </select>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Description</label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  className="mb-3 w-full min-h-[80px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <label className="mb-1 block text-xs font-semibold text-gray-600">Attach screenshot (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTicketFile(e.target.files?.[0] || null)}
                  className="mb-4 text-xs"
                />
                <button
                  onClick={() => void handleSubmitTicket()}
                  disabled={isSubmittingTicket}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {isSubmittingTicket ? 'Submitting...' : 'Submit'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
