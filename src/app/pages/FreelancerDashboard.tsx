import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Layers,
  MapPin,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { summarizeGroupRequestMembers } from '../../lib/groupRequest';
import { geocodeAddress } from '../../lib/osmGeocoding';
import { extractBudgetMeta, formatBudgetRange, stripBudgetMeta } from '../../lib/requestBudget';
import { extractScheduleMeta, formatScheduleMeta } from '../../lib/requestSchedule';
import { isValidSocialUrl, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_ICONS, type SocialPlatform } from '../../lib/socialPlatforms';

type DashboardSection = 'requests' | 'analytics' | 'settings';

interface FreelancerDashboardProps {
  onBack: () => void;
  section: DashboardSection;
  initialOpenRequestId?: string | undefined;
}

interface SocialLinkFormEntry {
  id: string | null;
  platform: SocialPlatform;
  url: string;
}

interface SettingsFormState {
  title: string;
  description: string;
  hourly_rate: number;
  experience_years: number;
  is_available: boolean;
  location: string;
  skills: string;
  styles: string;
  working_hours_start: string;
  working_hours_end: string;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function FreelancerDashboard({ onBack, section, initialOpenRequestId }: FreelancerDashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const [freelancerProfile, setFreelancerProfile] = useState<any | null>(null);
  // Social links are edited locally and only written to Supabase when the
  // freelancer clicks "Save Settings" — id is null for a link not yet saved.
  const [socialLinks, setSocialLinks] = useState<SocialLinkFormEntry[]>([]);
  const [originalSocialLinkIds, setOriginalSocialLinkIds] = useState<string[]>([]);
  const [newSocialPlatform, setNewSocialPlatform] = useState<SocialPlatform>('Instagram');
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [groupMemberNamesByRequest, setGroupMemberNamesByRequest] = useState<Record<string, string[]>>({});
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestMinBudget, setRequestMinBudget] = useState('');
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    title: '',
    description: '',
    hourly_rate: 0,
    experience_years: 0,
    is_available: true,
    location: '',
    skills: '',
    styles: '',
    working_hours_start: '09:00',
    working_hours_end: '18:00',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const [profileResponse, requestsResponse, userResponse] = await Promise.all([
        DataService.getFreelancerProfile(user.id),
        DataService.getFreelancerRequests(user.id),
        DataService.getUser(user.id),
      ]);

      if (!isMounted) return;

      if (profileResponse.error || !profileResponse.data) {
        setError((profileResponse.error as any)?.message || 'Unable to load freelancer profile.');
        setFreelancerProfile(null);
        setSocialLinks([]);
        setOriginalSocialLinkIds([]);
        setRequests([]);
        setIsLoading(false);
        return;
      }

      setFreelancerProfile(profileResponse.data);
      setRequests(requestsResponse.data || []);

      const socialLinksResponse = await DataService.getFreelancerSocialLinks(profileResponse.data.id);
      if (!isMounted) return;

      if (socialLinksResponse.error) {
        setError((socialLinksResponse.error as any)?.message || 'Unable to load social links.');
        setSocialLinks([]);
        setOriginalSocialLinkIds([]);
      } else {
        const links = (socialLinksResponse.data || []).map((link: any) => ({ id: link.id as string, platform: link.platform, url: link.url }));
        setSocialLinks(links);
        setOriginalSocialLinkIds(links.map((link) => link.id));
      }

      setSettingsForm({
        title: profileResponse.data.title || '',
        description: profileResponse.data.description || '',
        hourly_rate: Number(profileResponse.data.hourly_rate || 0),
        experience_years: Number(profileResponse.data.experience_years || 0),
        is_available: profileResponse.data.is_available !== false,
        location: userResponse.data?.location || '',
        skills: (profileResponse.data.skills || []).join(', '),
        styles: (profileResponse.data.styles || []).join(', '),
        working_hours_start: profileResponse.data.working_hours_start || '09:00',
        working_hours_end: profileResponse.data.working_hours_end || '18:00',
      });

      setIsLoading(false);
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // If navigation provided an initialOpenRequestId, scroll to and highlight that request after load
  useEffect(() => {
    if (!user?.id) return;
    if (!initialOpenRequestId) return;
    if (requests.length === 0) return;

    const openId = initialOpenRequestId;
    setTimeout(() => {
      const el = document.getElementById(`request-${openId}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightRequestId(openId);
        setTimeout(() => setHighlightRequestId(null), 4000);
      }
    }, 300);
  }, [requests, user?.id]);

  useEffect(() => {
    const groupRecipientIds = requests.flatMap((request) => DataService.getRequestGroupMeta(request)?.recipients || []);
    const uniqueRecipientIds = Array.from(new Set(groupRecipientIds.map(String).filter(Boolean)));
    if (!uniqueRecipientIds.length) {
      setGroupMemberNamesByRequest({});
      return;
    }

    let isActive = true;

    (async () => {
      const response = await DataService.getUsersByIds(uniqueRecipientIds);
      if (!isActive || response.error) {
        return;
      }

      const profilesById = new Map((response.data || []).map((user) => [String(user.id), user]));
      const nextMap: Record<string, string[]> = {};

      for (const request of requests) {
        const meta = DataService.getRequestGroupMeta(request);
        if (!meta?.recipients?.length) {
          continue;
        }

        const names = meta.recipients
          .map((recipientId) => profilesById.get(String(recipientId))?.full_name)
          .filter((name): name is string => Boolean(name && name.trim()));

        if (names.length) {
          nextMap[String(request.id)] = names;
        }
      }

      setGroupMemberNamesByRequest(nextMap);
    })();

    return () => {
      isActive = false;
    };
  }, [requests]);

  const stats = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending').length;
    const accepted = requests.filter((request) => request.status === 'accepted').length;
    const rejected = requests.filter((request) => request.status === 'rejected').length;
    const totalBudget = requests.reduce((acc, request) => acc + Number(request.budget || 0), 0);
    const averageBudget = requests.length > 0 ? Math.round(totalBudget / requests.length) : 0;

    return {
      socialLinkCount: socialLinks.length,
      pending,
      accepted,
      rejected,
      totalRequests: requests.length,
      averageBudget,
    };
  }, [socialLinks, requests]);

  const handleRequestDecision = async (requestId: string, status: 'accepted' | 'rejected') => {
    setError(null);
    setSuccess(null);

    const response = await DataService.updateRequest(requestId, { status } as any);
    if (response.error) {
      setError((response.error as any).message || `Unable to ${status} request.`);
      return;
    }

    if (status === 'accepted') {
      const request = requests.find((item) => item.id === requestId);

      if (request) {
        const budgetMeta = extractBudgetMeta(request.message, request.description);
        const bookingResponse = await DataService.createBooking({
          client_id: request.client_id,
          freelancer_id: request.freelancer_id,
          project_name: request.project_name,
          description: stripBudgetMeta(request.description || request.message || 'Auto-created from accepted request.'),
          budget: Number(budgetMeta?.max ?? request.budget ?? 0),
          status: 'confirmed',
          payment_status: 'unpaid',
          deliverables: `Auto-created from request ${request.id}`,
        } as any);

        if (bookingResponse.error) {
          setError((bookingResponse.error as any).message || 'Request accepted, but booking conversion failed.');
        }

        await DataService.ensureConversation(
          request.client_id,
          request.freelancer_id
        );

        const groupMeta = DataService.getRequestGroupMeta(request);
        if (groupMeta?.group_id) {
          const progressResponse = await DataService.getClientRequestsWithProgress(request.client_id);
          const groupRows = (progressResponse.data || []).filter((row: any) => row.group_meta?.group_id === groupMeta.group_id);
          const accepted = groupRows.filter((row: any) => row.status === 'accepted').length;
          const total = groupRows.length || groupMeta.recipients.length;

          await DataService.createNotification({
            user_id: request.client_id,
            actor_id: request.freelancer_id,
            type: 'group_request_progress',
            title: 'Group booking progress',
            message: `${accepted} out of ${total} people have accepted your request.`,
            related_id: request.id,
            post_id: null,
            comment_id: null,
            metadata: { group_id: groupMeta.group_id, accepted, total },
            read: false,
          } as any);

          if (accepted === total && total > 1) {
            const recipients = Array.from(new Set(groupRows.map((row: any) => String(row.freelancer_id))));
            const members = Array.from(new Set([request.client_id, ...recipients]));
            const groupConversation = await DataService.ensureGroupConversationForRequest({
              groupRequestId: groupMeta.group_id,
              title: `${request.project_name || 'Group project'} team`,
              createdBy: request.client_id,
              memberIds: members,
            });

            if (groupConversation.data?.id) {
              await DataService.sendGroupMessage({
                conversationId: groupConversation.data.id,
                senderId: request.client_id,
                content: `All ${total} members accepted. This group chat is now ready for collaboration on ${request.project_name || 'your project'}.`,
              });
            }
          }
        }
      }
    }

    setRequests((current) => current.map((request) => (request.id === requestId ? { ...request, status } : request)));
    setSuccess(status === 'accepted' ? 'Request accepted and converted to booking.' : 'Request rejected.');
  };

  // Social links are only edited in local state here — they're written to
  // Supabase together with the rest of the form in handleSaveSettings.
  const handleAddSocialLink = () => {
    if (!newSocialUrl.trim()) {
      setError('Enter a URL for this social link.');
      return;
    }

    if (!isValidSocialUrl(newSocialUrl)) {
      setError('Enter a valid URL, e.g. https://instagram.com/username.');
      return;
    }

    if (socialLinks.some((link) => link.platform === newSocialPlatform)) {
      setError(`You already added a ${newSocialPlatform} link. Edit or remove it instead.`);
      return;
    }

    setError(null);
    setSocialLinks((current) => [...current, { id: null, platform: newSocialPlatform, url: newSocialUrl.trim() }]);
    setNewSocialUrl('');
  };

  const handleSocialLinkUrlChange = (platform: SocialPlatform, url: string) => {
    setSocialLinks((current) => current.map((link) => (link.platform === platform ? { ...link, url } : link)));
  };

  const handleRemoveSocialLink = (platform: SocialPlatform) => {
    setSocialLinks((current) => current.filter((link) => link.platform !== platform));
  };

  const handleSaveSettings = async () => {
    if (!user?.id) return;

    if (settingsForm.working_hours_start >= settingsForm.working_hours_end) {
      setError('Working hours end time must be after the start time.');
      return;
    }

    setIsSavingSettings(true);
    setError(null);
    setSuccess(null);

    const locationText = settingsForm.location.trim();
    let locationLatitude: number | null = null;
    let locationLongitude: number | null = null;
    let locationPlaceId: string | null = null;

    if (locationText) {
      try {
        const resolved = await geocodeAddress(locationText);
        if (!resolved) {
          setError('Unable to resolve your location. Please use a more specific address.');
          setIsSavingSettings(false);
          return;
        }

        locationLatitude = resolved.latitude;
        locationLongitude = resolved.longitude;
        locationPlaceId = resolved.placeId;
      } catch (resolveError) {
        setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve your location.');
        setIsSavingSettings(false);
        return;
      }
    }

    const [profileUpdate, userUpdate] = await Promise.all([
      DataService.updateFreelancerProfile(user.id, {
        title: settingsForm.title,
        description: settingsForm.description,
        hourly_rate: settingsForm.hourly_rate,
        experience_years: settingsForm.experience_years,
        is_available: settingsForm.is_available,
        skills: parseTags(settingsForm.skills),
        styles: parseTags(settingsForm.styles),
        working_hours_start: settingsForm.working_hours_start,
        working_hours_end: settingsForm.working_hours_end,
        updated_at: new Date().toISOString(),
      } as any),
      DataService.updateUser(user.id, {
        location: locationText || null,
        location_latitude: locationLatitude,
        location_longitude: locationLongitude,
        location_place_id: locationPlaceId,
        updated_at: new Date().toISOString(),
      } as any),
    ]);

    if (profileUpdate.error || userUpdate.error) {
      setError(
        (profileUpdate.error as any)?.message ||
          (userUpdate.error as any)?.message ||
          'Unable to save settings.'
      );
      setIsSavingSettings(false);
      return;
    }

    setFreelancerProfile(profileUpdate.data);

    if (freelancerProfile?.id) {
      const currentIds = socialLinks.filter((link) => link.id).map((link) => link.id as string);
      const toDelete = originalSocialLinkIds.filter((id) => !currentIds.includes(id));
      const toCreate = socialLinks.filter((link) => !link.id);
      const toUpdate = socialLinks.filter((link) => link.id);

      const socialLinkResults = await Promise.all([
        ...toDelete.map((id) => DataService.deleteSocialLink(id)),
        ...toCreate.map((link) => DataService.addSocialLink(freelancerProfile.id, link.platform, link.url)),
        ...toUpdate.map((link) => DataService.updateSocialLink(link.id as string, { url: link.url })),
      ]);

      const socialLinkError = socialLinkResults.find((result) => result.error);
      if (socialLinkError) {
        setError((socialLinkError.error as any)?.message || 'Settings saved, but some social links could not be saved.');
      }

      const refreshedLinks = await DataService.getFreelancerSocialLinks(freelancerProfile.id);
      if (!refreshedLinks.error) {
        const links = (refreshedLinks.data || []).map((link: any) => ({ id: link.id as string, platform: link.platform, url: link.url }));
        setSocialLinks(links);
        setOriginalSocialLinkIds(links.map((link) => link.id));
      }
    }

    setSuccess('Settings saved successfully.');
    setIsSavingSettings(false);
  };

  const tabs: { id: DashboardSection; label: string; icon: any; path: string }[] = [
    { id: 'requests', label: 'Requests', icon: Users, path: '/freelancer-dashboard/requests' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/freelancer-dashboard/analytics' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/freelancer-dashboard/settings' },
  ];

  const filteredRequests = useMemo(() => {
    const minBudget = Number(requestMinBudget || 0);

    return requests
      .filter((request) => (requestStatusFilter === 'all' ? true : request.status === requestStatusFilter))
      .filter((request) => {
        const searchable = `${request.project_name || ''} ${request.client?.full_name || ''} ${request.message || ''}`.toLowerCase();
        return requestSearch.trim().length === 0 || searchable.includes(requestSearch.trim().toLowerCase());
      })
      .filter((request) => {
        if (!requestMinBudget.trim()) return true;
        const meta = extractBudgetMeta(request.message, request.description);
        const effectiveMax = Number(meta?.max ?? request.budget ?? 0);
        return effectiveMax >= minBudget;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, requestStatusFilter, requestSearch, requestMinBudget]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      <div className="sticky top-0 z-10 mb-6 border-b border-gray-200 bg-white/80 backdrop-blur-lg md:mb-8">
        <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-8 md:py-6">
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 transition-colors hover:text-black md:mb-4 md:text-base"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            Back to Home
          </button>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Freelancer Dashboard</h1>
              <p className="text-sm text-gray-600 md:text-base">Manage your requests, analytics, and settings</p>
            </div>
            {freelancerProfile && (
              <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                Status: {freelancerProfile.is_available === false ? 'Unavailable' : 'Available'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-8">
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg md:mb-8 md:rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all md:rounded-xl md:px-6 md:py-3 md:text-base ${
                section === tab.id
                  ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="h-4 w-4 md:h-5 md:w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
          </div>
        ) : section === 'requests' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Freelancer Requests</h2>
              <p className="text-sm text-gray-600 md:text-base">Manage incoming project requests</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => {
                  const count =
                    status === 'all'
                      ? requests.length
                      : requests.filter((request) => request.status === status).length;

                  return (
                    <button
                      key={status}
                      onClick={() => setRequestStatusFilter(status)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        requestStatusFilter === status
                          ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status[0].toUpperCase() + status.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={requestSearch}
                  onChange={(event) => setRequestSearch(event.target.value)}
                  placeholder="Search by project, client, or message"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  type="number"
                  value={requestMinBudget}
                  onChange={(event) => setRequestMinBudget(event.target.value)}
                  placeholder="Minimum budget"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <h3 className="text-xl font-bold text-gray-900">No requests yet</h3>
                <p className="mt-2 text-gray-600">Incoming client requests will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  (() => {
                    const budgetMeta = extractBudgetMeta(request.message, request.description) || {
                      currency: 'THB',
                      min: Number(request.budget || 0),
                      max: Number(request.budget || 0),
                    };

                    const groupMeta = DataService.getRequestGroupMeta(request);
                    const memberNames = groupMeta?.recipients?.length ? (groupMemberNamesByRequest[String(request.id)] || []) : [];
                    const scheduleMeta = extractScheduleMeta(request.message, request.description);
                    const groupSummary = groupMeta?.recipients?.length
                      ? summarizeGroupRequestMembers(groupMeta.recipients, memberNames)
                      : null;

                    return (
                  <div
                    id={`request-${request.id}`}
                    key={request.id}
                    className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-lg ${highlightRequestId === request.id ? 'ring-4 ring-yellow-200' : ''}`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <button
                        type="button"
                        onClick={() => request.client_id && navigate(`/profile/${request.client_id}`)}
                        className="h-14 w-14 rounded-full transition-transform hover:scale-105"
                        aria-label={`Open ${request.client?.full_name || 'Client'} profile`}
                      >
                        <Avatar
                          src={request.client?.avatar_url || DEFAULT_AVATAR_URL}
                          alt={request.client?.full_name || 'Client'}
                          gender={request.client?.gender}
                          sizeClassName="h-full w-full ring-2 ring-white shadow-md rounded-full"
                        />
                      </button>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{request.project_name}</h3>
                        <p className="text-sm text-gray-600">
                          <button
                            type="button"
                            onClick={() => request.client_id && navigate(`/profile/${request.client_id}`)}
                            className="font-semibold text-gray-900 hover:text-black"
                          >
                            {request.client?.full_name || 'Client'}
                          </button>
                        </p>
                        {groupSummary && (
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">Group request</span>
                          </p>
                        )}
                        {request.project_name && (
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">Purpose:</span> {request.project_name}
                          </p>
                        )}
                        {groupMeta?.recipients?.length && memberNames.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
                            <span className="font-semibold text-gray-900">Group members:</span>
                            {memberNames.map((memberName, index) => (
                              <button
                                key={`${request.id}-${memberName}-${index}`}
                                type="button"
                                onClick={() => {
                                  const recipientId = groupMeta.recipients[index];
                                  if (recipientId) navigate(`/profile/${recipientId}`);
                                }}
                                className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 hover:border-gray-300 hover:bg-gray-100"
                              >
                                {memberName}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatBudgetRange(budgetMeta)}</span>
                          {scheduleMeta && (
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-900"><Clock className="h-3.5 w-3.5" />{formatScheduleMeta(scheduleMeta)}</span>
                          )}
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Sent {new Date(request.created_at).toLocaleDateString()}</span>
                          <span className="rounded-full border border-gray-200 px-2 py-1 font-semibold capitalize">{request.status}</span>
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleRequestDecision(request.id, 'accepted')}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" /> Accept
                          </button>
                          <button
                            onClick={() => void handleRequestDecision(request.id, 'rejected')}
                            className="flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            <X className="h-4 w-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                    );
                  })()
                ))}

                {filteredRequests.length === 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg text-gray-600">
                    No requests match these filters.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : section === 'analytics' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Analytics</h2>
              <p className="text-sm text-gray-600 md:text-base">Performance based on your real dashboard data</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
              {[
                { label: 'Social Links', value: stats.socialLinkCount, icon: Layers },
                { label: 'Pending Requests', value: stats.pending, icon: Users },
                { label: 'Accepted Requests', value: stats.accepted, icon: Check },
                {
                  label: 'Average Budget',
                  value: formatCurrencyAmount(
                    convertAmount(stats.averageBudget, 'THB', normalizeCurrencyCode(preferredCurrency, 'THB')),
                    normalizeCurrencyCode(preferredCurrency, 'THB')
                  ),
                  icon: TrendingUp,
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
                  <div className="mb-3 inline-flex rounded-xl bg-gray-100 p-3">
                    <stat.icon className="h-5 w-5 text-gray-900" />
                  </div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Service Settings</h2>
              <p className="text-sm text-gray-600 md:text-base">Update your public freelancer details</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Title</label>
                <input
                  value={settingsForm.title}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Description</label>
                <textarea
                  value={settingsForm.description}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Social Links</label>
                <p className="mb-3 text-xs text-gray-500">Show your work through your social profiles instead of uploading portfolio photos.</p>

                {socialLinks.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {socialLinks.map((link) => {
                      const Icon = SOCIAL_PLATFORM_ICONS[link.platform];
                      return (
                        <div key={link.platform} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <Icon className="h-4 w-4 flex-shrink-0 text-gray-700" />
                          <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-900">{link.platform}</span>
                          <input
                            value={link.url}
                            onChange={(event) => handleSocialLinkUrlChange(link.platform, event.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
                          <button onClick={() => handleRemoveSocialLink(link.platform)} className="flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600" aria-label={`Remove ${link.platform} link`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    value={newSocialPlatform}
                    onChange={(event) => setNewSocialPlatform(event.target.value as SocialPlatform)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 sm:w-40"
                  >
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <option key={platform} value={platform} disabled={socialLinks.some((link) => link.platform === platform)}>
                        {platform}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newSocialUrl}
                    onChange={(event) => setNewSocialUrl(event.target.value)}
                    placeholder={`https://${newSocialPlatform.toLowerCase()}.com/username`}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    onClick={handleAddSocialLink}
                    className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Hourly Rate (THB)</label>
                  <input
                    type="number"
                    value={settingsForm.hourly_rate}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, hourly_rate: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Experience Years</label>
                  <input
                    type="number"
                    value={settingsForm.experience_years}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, experience_years: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      value={settingsForm.location}
                      onChange={(event) => setSettingsForm((current) => ({ ...current, location: event.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-9 pr-4 outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Skills (comma separated)</label>
                  <input
                    value={settingsForm.skills}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, skills: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Styles (comma separated)</label>
                  <input
                    value={settingsForm.styles}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, styles: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Working hours start</label>
                  <input
                    type="time"
                    value={settingsForm.working_hours_start}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, working_hours_start: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Working hours end</label>
                  <input
                    type="time"
                    value={settingsForm.working_hours_end}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, working_hours_end: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <p className="md:col-span-2 text-xs text-gray-500">
                  Clients booking you can only choose a time within this range.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={settingsForm.is_available}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, is_available: event.target.checked }))}
                />
                Available for new bookings
              </label>
              <button
                onClick={() => void handleSaveSettings()}
                disabled={isSavingSettings}
                className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-6 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
