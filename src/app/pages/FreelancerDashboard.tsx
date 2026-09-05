import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  Edit,
  Layers,
  MapPin,
  Plus,
  Settings,
  Star,
  Trash2,
  TrendingUp,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { stripRequestDisplayMeta, summarizeGroupRequestMembers } from '../../lib/groupRequest';
import { extractBudgetMeta, formatBudgetRange, stripBudgetMeta } from '../../lib/requestBudget';
import { extractScheduleMeta, formatScheduleMeta } from '../../lib/requestSchedule';
import { extractLocationMeta } from '../../lib/requestLocation';
import { acceptRequestAndCreateBooking } from '../../lib/acceptRequest';
import { getBookingEscrowState, formatCountdown } from '../../lib/bookingEscrow';
import { CalendarView } from './freelancer-dashboard/CalendarView';
import { MAX_NEGOTIATION_ROUNDS } from '../../lib/negotiation';
import { ConfirmOfferDialog } from '../components/negotiation/ConfirmOfferDialog';
import { NegotiationHistoryModal } from '../components/negotiation/NegotiationHistoryModal';

type DashboardSection = 'requests' | 'bookings' | 'analytics' | 'calendar' | 'reviews' | 'earnings' | 'teams' | 'settings';

const PAYMENT_STATUS_SEQUENCE = ['unpaid', 'deposit_paid', 'paid'] as const;
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Unpaid',
  deposit_paid: 'Deposit secured',
  paid: 'Paid in full',
};

const SERVICE_PRICING_TYPES = ['fixed', 'starting_from', 'custom_quote'] as const;

interface FreelancerDashboardProps {
  onBack: () => void;
  section: DashboardSection;
  initialOpenRequestId?: string | undefined;
}

interface ServiceFormState {
  name: string;
  description: string;
  starting_price: string;
  pricing_type: (typeof SERVICE_PRICING_TYPES)[number];
  duration: string;
  included: string;
  extras: string;
  requirements: string;
}

const EMPTY_SERVICE_FORM: ServiceFormState = {
  name: '',
  description: '',
  starting_price: '',
  pricing_type: 'starting_from',
  duration: '',
  included: '',
  extras: '',
  requirements: '',
};

export function FreelancerDashboard({ onBack, section, initialOpenRequestId }: FreelancerDashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();
  const [freelancerProfile, setFreelancerProfile] = useState<any | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [groupMemberNamesByRequest, setGroupMemberNamesByRequest] = useState<Record<string, string[]>>({});
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'countered'>('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestMinBudget, setRequestMinBudget] = useState('');
  const [counterFormOpenForId, setCounterFormOpenForId] = useState<string | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState('');
  const [counterMessageInput, setCounterMessageInput] = useState('');
  const [counterIncludesInput, setCounterIncludesInput] = useState('');
  const [counterDateInput, setCounterDateInput] = useState('');
  const [counterTimeInput, setCounterTimeInput] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'accept' | 'reject'; request: any } | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [historyModalRequestId, setHistoryModalRequestId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');
  const [isSavingBlockedDate, setIsSavingBlockedDate] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(EMPTY_SERVICE_FORM);
  const [isSavingService, setIsSavingService] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [isSubmittingReplyForId, setIsSubmittingReplyForId] = useState<string | null>(null);
  const [isUpdatingPaymentForId, setIsUpdatingPaymentForId] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<any[]>([]);
  const [teamBookingConfirmations, setTeamBookingConfirmations] = useState<any[]>([]);
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState<Record<string, any[]>>({});
  const [teamEarnings, setTeamEarnings] = useState<Array<{ id: string; teamName: string; projectName: string; share: number }>>([]);
  const [isCreateTeamFormOpen, setIsCreateTeamFormOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [inviteFormOpenForTeamId, setInviteFormOpenForTeamId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRevenueShare, setInviteRevenueShare] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isRespondingToInvitationId, setIsRespondingToInvitationId] = useState<string | null>(null);
  const [isRespondingToConfirmationId, setIsRespondingToConfirmationId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const [profileResponse, requestsResponse, bookingsResponse] = await Promise.all([
        DataService.getFreelancerProfile(user.id),
        DataService.getFreelancerRequests(user.id),
        DataService.getFreelancerBookings(user.id),
      ]);

      if (!isMounted) return;

      if (profileResponse.error || !profileResponse.data) {
        setError((profileResponse.error as any)?.message || 'Unable to load freelancer profile.');
        setFreelancerProfile(null);
        setRequests([]);
        setIsLoading(false);
        return;
      }

      setFreelancerProfile(profileResponse.data);
      setRequests(requestsResponse.data || []);
      setBookings(bookingsResponse.data || []);

      const [blockedDatesResponse, servicesResponse, reviewsResponse] = await Promise.all([
        DataService.getFreelancerBlockedDates(profileResponse.data.id),
        DataService.getFreelancerServices(profileResponse.data.id),
        DataService.getFreelancerReviews(user.id),
      ]);
      if (!isMounted) return;

      setBlockedDates(blockedDatesResponse.data || []);
      setServices(servicesResponse.data || []);
      setReviews(reviewsResponse.data || []);
      void loadTeamsData(user.id);

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

  const loadTeamsData = async (userId: string) => {
    const [teamsResponse, invitationsResponse, confirmationsResponse] = await Promise.all([
      DataService.getUserTeams(userId),
      DataService.getMyTeamInvitations(userId),
      DataService.getFreelancerTeamBookingConfirmations(userId),
    ]);

    const myTeams = teamsResponse.data || [];
    setTeams(myTeams);
    setTeamInvitations(invitationsResponse.data || []);
    setTeamBookingConfirmations(confirmationsResponse.data || []);

    const memberLists = await Promise.all(myTeams.map((entry: any) => DataService.getTeamMembers(entry.team_id || entry.team?.id)));
    const nextMembersByTeamId: Record<string, any[]> = {};
    myTeams.forEach((entry: any, index: number) => {
      const teamId = entry.team_id || entry.team?.id;
      if (teamId) nextMembersByTeamId[teamId] = memberLists[index]?.data || [];
    });
    setTeamMembersByTeamId(nextMembersByTeamId);

    const teamBookingLists = await Promise.all(myTeams.map((entry: any) => DataService.getTeamBookingsForTeam(entry.team_id || entry.team?.id)));
    const earnings: Array<{ id: string; teamName: string; projectName: string; share: number }> = [];
    myTeams.forEach((entry: any, index: number) => {
      const sharePercent = Number(entry.revenue_share_percent || 0);
      const confirmedBookings = (teamBookingLists[index]?.data || []).filter((tb: any) => tb.status === 'confirmed');
      for (const tb of confirmedBookings) {
        earnings.push({
          id: tb.id,
          teamName: entry.team?.name || 'Team',
          projectName: tb.project_name,
          share: (Number(tb.budget || 0) * sharePercent) / 100,
        });
      }
    });
    setTeamEarnings(earnings);
  };

  const stats = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending').length;
    const accepted = requests.filter((request) => request.status === 'accepted').length;
    const rejected = requests.filter((request) => request.status === 'rejected').length;
    const totalBudget = requests.reduce((acc, request) => acc + Number(request.budget || 0), 0);
    const averageBudget = requests.length > 0 ? Math.round(totalBudget / requests.length) : 0;

    return {
      socialLinkCount: (freelancerProfile?.social_links || []).length,
      pending,
      accepted,
      rejected,
      totalRequests: requests.length,
      averageBudget,
    };
  }, [freelancerProfile, requests]);

  const earningsStats = useMemo(() => {
    const totalEarned = bookings
      .filter((booking) => booking.payment_status === 'paid')
      .reduce((acc, booking) => acc + Number(booking.budget || 0), 0);
    const pendingInEscrow = bookings
      .filter((booking) => booking.payment_status !== 'paid' && booking.status !== 'cancelled')
      .reduce((acc, booking) => acc + Number(booking.budget || 0), 0);

    return { totalEarned, pendingInEscrow, bookingCount: bookings.length };
  }, [bookings]);

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
      if (!request) {
        setError('Request accepted, but could not find its details to create a booking. Please refresh and check My Bookings.');
        return;
      }

      const { error: acceptError } = await acceptRequestAndCreateBooking(request);
      if (acceptError) {
        setError(acceptError.message);
        return;
      }
    }

    setRequests((current) => current.map((request) => (request.id === requestId ? { ...request, status } : request)));
    setSuccess(status === 'accepted' ? 'Request accepted and converted to booking.' : 'Request rejected.');
  };

  const getEffectiveSchedule = (request: any) => {
    if (request?.status === 'countered' && request.counter_date) {
      return { date: request.counter_date, time: (request.counter_time || '').slice(0, 5) };
    }
    return extractScheduleMeta(request?.message, request?.description) || { date: '', time: '' };
  };

  const openCounterForm = (request: any) => {
    const schedule = getEffectiveSchedule(request);
    setCounterFormOpenForId(request.id);
    setCounterPriceInput('');
    setCounterMessageInput('');
    setCounterIncludesInput('');
    setCounterDateInput(schedule.date || '');
    setCounterTimeInput(schedule.time || '');
  };

  const handleSendCounterOffer = async (requestId: string) => {
    const price = Number(counterPriceInput);
    if (!counterPriceInput.trim() || !Number.isFinite(price) || price <= 0) {
      setError('Enter a valid proposed price.');
      return;
    }
    if (!counterDateInput || !counterTimeInput) {
      setError('Choose a date and time for your counter offer.');
      return;
    }

    const request = requests.find((item) => item.id === requestId);
    const nextRound = Number(request?.counter_round || 1) + 1;
    const includes = counterIncludesInput.trim() || null;

    setError(null);
    setSuccess(null);
    setIsSubmittingCounter(true);

    const response = await DataService.updateRequest(requestId, {
      status: 'countered',
      counter_price: price,
      counter_message: counterMessageInput.trim() || null,
      counter_by: 'freelancer',
      counter_round: nextRound,
      includes,
      counter_date: counterDateInput,
      counter_time: counterTimeInput,
    } as any);

    setIsSubmittingCounter(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to send counter offer.');
      return;
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: 'countered',
              counter_price: price,
              counter_message: counterMessageInput.trim() || null,
              counter_by: 'freelancer',
              counter_round: nextRound,
              includes,
              counter_date: counterDateInput,
              counter_time: counterTimeInput,
            }
          : request
      )
    );
    setCounterFormOpenForId(null);
    setCounterPriceInput('');
    setCounterMessageInput('');
    setCounterIncludesInput('');
    setCounterDateInput('');
    setCounterTimeInput('');
    setSuccess('Counter offer sent.');
  };

  const handleAcceptCounter = async (request: any) => {
    setError(null);
    setSuccess(null);

    const counterPrice = Number(request.counter_price);
    const { error: acceptError } = await acceptRequestAndCreateBooking(request, counterPrice);
    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    const response = await DataService.updateRequest(request.id, { status: 'accepted', budget: counterPrice } as any);
    if (response.error) {
      setError((response.error as any).message || 'Unable to accept counter offer.');
      return;
    }

    setRequests((current) =>
      current.map((item) => (item.id === request.id ? { ...item, status: 'accepted', budget: counterPrice } : item))
    );
    setSuccess('Counter offer accepted and converted to booking.');
  };

  const handleRejectCounter = async (requestId: string) => {
    setError(null);
    setSuccess(null);

    const response = await DataService.updateRequest(requestId, { status: 'rejected' } as any);
    if (response.error) {
      setError((response.error as any).message || 'Unable to reject counter offer.');
      return;
    }

    setRequests((current) => current.map((item) => (item.id === requestId ? { ...item, status: 'rejected' } : item)));
    setSuccess('Counter offer rejected.');
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, request } = confirmAction;
    setIsSubmittingConfirm(true);

    if (type === 'accept') {
      if (request.status === 'countered') {
        await handleAcceptCounter(request);
      } else {
        await handleRequestDecision(request.id, 'accepted');
      }
    } else {
      if (request.status === 'countered') {
        await handleRejectCounter(request.id);
      } else {
        await handleRequestDecision(request.id, 'rejected');
      }
    }

    setIsSubmittingConfirm(false);
    setConfirmAction(null);
  };


  const handleAddBlockedDate = async () => {
    if (!freelancerProfile?.id || !newBlockedDate) {
      setError('Choose a date to block.');
      return;
    }

    setError(null);
    setIsSavingBlockedDate(true);
    const response = await DataService.addBlockedDate(freelancerProfile.id, newBlockedDate, newBlockedReason.trim() || null);
    setIsSavingBlockedDate(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to block that date.');
      return;
    }

    setBlockedDates((current) => [...current, response.data].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)));
    setNewBlockedDate('');
    setNewBlockedReason('');
    setSuccess('Date blocked.');
  };

  const handleCalendarBlockDate = async (date: string, reason: string) => {
    if (!freelancerProfile?.id) return;

    setError(null);
    setIsSavingBlockedDate(true);
    const response = await DataService.addBlockedDate(freelancerProfile.id, date, reason.trim() || null);
    setIsSavingBlockedDate(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to block that date.');
      return;
    }

    setBlockedDates((current) => [...current, response.data].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)));
    setSuccess('Date blocked.');
  };

  const handleRemoveBlockedDate = async (id: string) => {
    setError(null);
    const response = await DataService.removeBlockedDate(id);
    if (response.error) {
      setError((response.error as any).message || 'Unable to unblock that date.');
      return;
    }
    setBlockedDates((current) => current.filter((item) => item.id !== id));
  };

  const openServiceForm = (service?: any) => {
    if (service) {
      setEditingServiceId(service.id);
      setServiceForm({
        name: service.name || '',
        description: service.description || '',
        starting_price: service.starting_price != null ? String(service.starting_price) : '',
        pricing_type: service.pricing_type || 'starting_from',
        duration: service.duration || '',
        included: service.included || '',
        extras: (service.extras || []).map((extra: any) => `${extra.label}:${extra.price}`).join(', '),
        requirements: service.requirements || '',
      });
    } else {
      setEditingServiceId(null);
      setServiceForm(EMPTY_SERVICE_FORM);
    }
    setIsServiceFormOpen(true);
  };

  const parseExtras = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [label, price] = entry.split(':').map((part) => part.trim());
        return { label: label || entry, price: Number(price || 0) };
      });

  const handleSaveService = async () => {
    if (!freelancerProfile?.id || !serviceForm.name.trim()) {
      setError('Give this service a name.');
      return;
    }

    setError(null);
    setIsSavingService(true);

    const payload = {
      freelancer_id: freelancerProfile.id,
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      starting_price: serviceForm.starting_price ? Number(serviceForm.starting_price) : null,
      pricing_type: serviceForm.pricing_type,
      duration: serviceForm.duration.trim() || null,
      included: serviceForm.included.trim() || null,
      extras: parseExtras(serviceForm.extras),
      requirements: serviceForm.requirements.trim() || null,
    };

    const response = editingServiceId
      ? await DataService.updateFreelancerService(editingServiceId, payload)
      : await DataService.createFreelancerService(payload);

    setIsSavingService(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to save service.');
      return;
    }

    setServices((current) =>
      editingServiceId
        ? current.map((item) => (item.id === editingServiceId ? response.data : item))
        : [...current, response.data]
    );
    setIsServiceFormOpen(false);
    setEditingServiceId(null);
    setServiceForm(EMPTY_SERVICE_FORM);
    setSuccess('Service saved.');
  };

  const handleDeleteService = async (id: string) => {
    setError(null);
    const response = await DataService.deleteFreelancerService(id);
    if (response.error) {
      setError((response.error as any).message || 'Unable to delete service.');
      return;
    }
    setServices((current) => current.filter((item) => item.id !== id));
  };

  const handleSubmitReviewReply = async (reviewId: string) => {
    const reply = (replyDraftByReviewId[reviewId] || '').trim();
    if (!reply) {
      setError('Write a reply before submitting.');
      return;
    }

    setError(null);
    setIsSubmittingReplyForId(reviewId);
    const response = await DataService.replyToReview(reviewId, reply);
    setIsSubmittingReplyForId(null);

    if (response.error) {
      setError((response.error as any).message || 'Unable to submit reply.');
      return;
    }

    setReviews((current) => current.map((item) => (item.id === reviewId ? { ...item, ...response.data } : item)));
    setReplyDraftByReviewId((current) => {
      const next = { ...current };
      delete next[reviewId];
      return next;
    });
    setSuccess('Reply posted.');
  };

  const handleAdvancePaymentStatus = async (booking: any) => {
    const currentIndex = PAYMENT_STATUS_SEQUENCE.indexOf(booking.payment_status);
    const nextStatus = PAYMENT_STATUS_SEQUENCE[currentIndex + 1];
    if (!nextStatus) return;

    setError(null);
    setIsUpdatingPaymentForId(booking.id);
    const response = await DataService.updateBooking(booking.id, { payment_status: nextStatus } as any);
    setIsUpdatingPaymentForId(null);

    if (response.error) {
      setError((response.error as any).message || 'Unable to update payment status.');
      return;
    }

    setBookings((current) => current.map((item) => (item.id === booking.id ? { ...item, payment_status: nextStatus } : item)));
    setSuccess(`Marked as ${PAYMENT_STATUS_LABEL[nextStatus].toLowerCase()}.`);
  };

  const handleCreateTeam = async () => {
    if (!user?.id || !newTeamName.trim()) {
      setError('Give your team a name.');
      return;
    }

    setError(null);
    setIsSavingTeam(true);
    const response = await DataService.createTeam(user.id, newTeamName.trim(), newTeamDescription.trim() || null);
    setIsSavingTeam(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to create team.');
      return;
    }

    setIsCreateTeamFormOpen(false);
    setNewTeamName('');
    setNewTeamDescription('');
    setSuccess('Team created.');
    await loadTeamsData(user.id);
  };

  const handleSendTeamInvite = async (teamId: string) => {
    if (!user?.id || !inviteEmail.trim()) {
      setError('Enter the email of the freelancer you want to invite.');
      return;
    }

    setError(null);
    setIsSendingInvite(true);

    const userResponse = await DataService.getUserByEmail(inviteEmail.trim());
    if (userResponse.error || !userResponse.data) {
      setIsSendingInvite(false);
      setError('No account found with that email.');
      return;
    }

    const share = inviteRevenueShare.trim() ? Number(inviteRevenueShare) : null;
    const response = await DataService.inviteToTeam(teamId, user.id, userResponse.data.id, share);
    setIsSendingInvite(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to send invitation.');
      return;
    }

    setInviteFormOpenForTeamId(null);
    setInviteEmail('');
    setInviteRevenueShare('');
    setSuccess('Invitation sent.');
  };

  const handleRespondToTeamInvitation = async (invitationId: string, accept: boolean) => {
    if (!user?.id) return;
    setError(null);
    setIsRespondingToInvitationId(invitationId);
    const response = await DataService.respondToTeamInvitation(invitationId, accept);
    setIsRespondingToInvitationId(null);

    if (response.error) {
      setError((response.error as any).message || 'Unable to respond to invitation.');
      return;
    }

    setSuccess(accept ? 'You joined the team.' : 'Invitation declined.');
    await loadTeamsData(user.id);
  };

  const handleRespondToTeamBookingConfirmation = async (confirmationId: string, decision: 'confirmed' | 'declined') => {
    if (!user?.id) return;
    setError(null);
    setIsRespondingToConfirmationId(confirmationId);
    const response = await DataService.respondToTeamBookingConfirmation(confirmationId, decision);
    setIsRespondingToConfirmationId(null);

    if (response.error) {
      setError((response.error as any).message || 'Unable to respond to team booking.');
      return;
    }

    setSuccess(decision === 'confirmed' ? 'Confirmed.' : 'Declined.');
    await loadTeamsData(user.id);
  };

  const tabs: { id: DashboardSection; label: string; icon: any; path: string }[] = [
    { id: 'requests', label: 'Requests', icon: Users, path: '/freelancer-dashboard/requests' },
    { id: 'bookings', label: 'Bookings', icon: ClipboardList, path: '/freelancer-dashboard/bookings' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, path: '/freelancer-dashboard/calendar' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/freelancer-dashboard/analytics' },
    { id: 'reviews', label: 'Reviews', icon: Star, path: '/freelancer-dashboard/reviews' },
    { id: 'earnings', label: 'Earnings', icon: DollarSign, path: '/freelancer-dashboard/earnings' },
    { id: 'teams', label: 'Teams', icon: UsersRound, path: '/freelancer-dashboard/teams' },
    { id: 'settings', label: 'Services', icon: Settings, path: '/freelancer-dashboard/settings' },
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

  const bookingCards = useMemo(() => {
    const ESCROW_STATUS_LABEL: Record<string, { label: string; color: string }> = {
      awaiting_deposit: { label: 'Awaiting deposit', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      deposit_secured: { label: 'Deposit secured', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      awaiting_client_confirmation: { label: 'Awaiting client confirmation', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      disputed: { label: 'Disputed — action needed', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      released: { label: 'Paid in full', color: 'bg-green-100 text-green-700 border-green-200' },
      refunded: { label: 'Refunded', color: 'bg-red-100 text-red-700 border-red-200' },
    };

    return bookings
      .filter((booking) => getBookingEscrowState(booking) !== 'annulled')
      .map((booking) => {
        const escrowState = getBookingEscrowState(booking);
        const status = ESCROW_STATUS_LABEL[escrowState] || { label: booking.status, color: 'bg-gray-100 text-gray-700 border-gray-200' };
        const scheduleMeta = booking.start_date
          ? { date: booking.start_date, time: booking.start_time || '00:00' }
          : extractScheduleMeta(booking.description);
        const locationMeta = extractLocationMeta(booking.description);
        const deadline =
          escrowState === 'awaiting_deposit'
            ? booking.deposit_deadline
            : escrowState === 'awaiting_client_confirmation'
            ? booking.client_response_deadline
            : escrowState === 'disputed'
            ? booking.dispute_response_deadline
            : null;

        return {
          id: booking.id,
          bookingId: `#${booking.id.slice(0, 8).toUpperCase()}`,
          clientName: booking.client?.full_name || 'CreativeHUB User',
          clientImage: booking.client?.avatar_url || DEFAULT_AVATAR_URL,
          clientGender: booking.client?.gender || null,
          projectName: booking.project_name,
          date: scheduleMeta
            ? booking.start_date && !booking.start_time
              ? new Date(`${scheduleMeta.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              : formatScheduleMeta(scheduleMeta)
            : 'Schedule pending',
          location: locationMeta || 'Location to be confirmed',
          statusLabel: status.label,
          statusColor: status.color,
          countdown: deadline ? formatCountdown(deadline) : null,
          totalAmount: Number(booking.budget || 0),
          deposit: Math.round(Number(booking.budget || 0) * 0.3),
        };
      });
  }, [bookings]);

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
              <p className="text-sm text-gray-600 md:text-base">Manage requests, calendar, services, and bookings</p>
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
                {(['all', 'pending', 'countered', 'accepted', 'rejected'] as const).map((status) => {
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
                  placeholder="e.g. 2000"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
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
                    const locationMeta = extractLocationMeta(request.message, request.description);
                    const notesText = stripRequestDisplayMeta(request.message || request.description || '');
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
                        {locationMeta && (
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">Location:</span> {locationMeta}
                          </p>
                        )}
                        {notesText && (
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">Notes:</span> {notesText}
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setConfirmAction({ type: 'accept', request })}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" /> Accept
                          </button>
                          {Number(request.counter_round || 1) < MAX_NEGOTIATION_ROUNDS && (
                            <button
                              onClick={() => openCounterForm(request)}
                              className="flex items-center gap-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                            >
                              <DollarSign className="h-4 w-4" /> Counter Offer
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'reject', request })}
                            className="flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            <X className="h-4 w-4" /> Reject
                          </button>
                          <button
                            onClick={() => setHistoryModalRequestId(request.id)}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View Details
                          </button>
                        </div>
                      )}
                      {request.status === 'countered' && request.counter_by === 'client' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setConfirmAction({ type: 'accept', request })}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" /> Accept {formatCurrencyAmount(Number(request.counter_price || 0), budgetMeta.currency)}
                          </button>
                          {Number(request.counter_round || 1) < MAX_NEGOTIATION_ROUNDS && (
                            <button
                              onClick={() => openCounterForm(request)}
                              className="flex items-center gap-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                            >
                              <DollarSign className="h-4 w-4" /> Counter Again
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'reject', request })}
                            className="flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            <X className="h-4 w-4" /> Reject
                          </button>
                          <button
                            onClick={() => setHistoryModalRequestId(request.id)}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View Details
                          </button>
                        </div>
                      )}
                      {request.status === 'countered' && request.counter_by === 'freelancer' && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right text-sm text-gray-500">
                            Waiting for client to respond to your {formatCurrencyAmount(Number(request.counter_price || 0), 'THB')} offer.
                          </div>
                          <button
                            onClick={() => setHistoryModalRequestId(request.id)}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View Details
                          </button>
                        </div>
                      )}
                    </div>

                    {request.status === 'countered' && (
                      <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">
                          {request.counter_by === 'client' ? "Client's counter offer: " : 'Your counter offer: '}
                        </span>
                        {formatCurrencyAmount(Number(request.counter_price || 0), 'THB')}
                        {request.counter_date && (
                          <> · {formatScheduleMeta({ date: request.counter_date, time: (request.counter_time || '00:00').slice(0, 5) })}</>
                        )}
                        {request.counter_message && <> — "{request.counter_message}"</>}
                      </div>
                    )}

                    {counterFormOpenForId === request.id && (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-3 text-sm font-semibold text-gray-900">Propose a different price</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">My proposed price</label>
                            <input
                              type="number"
                              min={0}
                              value={counterPriceInput}
                              onChange={(event) => setCounterPriceInput(event.target.value)}
                              placeholder="e.g. 7000"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Message (optional)</label>
                            <input
                              value={counterMessageInput}
                              onChange={(event) => setCounterMessageInput(event.target.value)}
                              placeholder='e.g. "I can provide the requested service for ฿7,000."'
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Proposed date</label>
                            <input
                              type="date"
                              value={counterDateInput}
                              onChange={(event) => setCounterDateInput(event.target.value)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Proposed time</label>
                            <input
                              type="time"
                              value={counterTimeInput}
                              onChange={(event) => setCounterTimeInput(event.target.value)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-semibold text-gray-600">What's included (optional, one per line)</label>
                          <textarea
                            value={counterIncludesInput}
                            onChange={(event) => setCounterIncludesInput(event.target.value)}
                            rows={3}
                            placeholder={'8 hours photography\nEdited photos\nOnline gallery'}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            onClick={() => setCounterFormOpenForId(null)}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void handleSendCounterOffer(request.id)}
                            disabled={isSubmittingCounter}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                          >
                            {isSubmittingCounter ? 'Sending...' : 'Send Counter Offer'}
                          </button>
                        </div>
                      </div>
                    )}
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
        ) : section === 'bookings' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Bookings</h2>
              <p className="text-sm text-gray-600 md:text-base">
                Clients who booked you — deposit status, evidence submission, and dispute resolution
              </p>
            </div>

            {bookingCards.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <p className="text-sm text-gray-500">No bookings yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookingCards.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => navigate(`/freelancer-booking/${booking.id}`)}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-lg transition-all hover:border-gray-900 hover:shadow-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={booking.clientImage}
                          alt={booking.clientName}
                          gender={booking.clientGender}
                          sizeClassName="h-14 w-14 flex-shrink-0 rounded-full ring-2 ring-gray-200"
                        />
                        <div>
                          <h3 className="font-bold text-gray-900">{booking.clientName}</h3>
                          <p className="text-sm text-gray-600">{booking.projectName}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>

                    <div className="mb-4 space-y-1 rounded-xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar className="h-3 w-3" />
                        <span>{booking.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <MapPin className="h-3 w-3" />
                        <span>{booking.location}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${booking.statusColor}`}>
                          {booking.statusLabel}
                        </div>
                        <span className="text-xs text-gray-500">{booking.bookingId}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Deposit</div>
                        <div className="font-bold text-gray-900">
                          {formatCurrencyAmount(
                            convertAmount(booking.deposit, 'THB', normalizeCurrencyCode(preferredCurrency, 'THB')),
                            normalizeCurrencyCode(preferredCurrency, 'THB')
                          )}
                        </div>
                      </div>
                    </div>

                    {booking.countdown && (
                      <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3 text-xs font-semibold text-amber-700">
                        <Clock className="h-3 w-3" />
                        <span>{booking.countdown}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : section === 'calendar' ? (
          <CalendarView
            bookings={bookings}
            blockedDates={blockedDates}
            onBlockDate={handleCalendarBlockDate}
            onUnblockDate={handleRemoveBlockedDate}
            isSavingBlockedDate={isSavingBlockedDate}
          />
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
        ) : section === 'reviews' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">My Reviews</h2>
              <p className="text-sm text-gray-600 md:text-base">See what clients are saying, and reply to a review</p>
            </div>

            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <p className="text-sm text-gray-500">No reviews yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={review.reviewer?.avatar_url || DEFAULT_AVATAR_URL}
                          alt={review.reviewer?.full_name || 'Client'}
                          gender={review.reviewer?.gender}
                          sizeClassName="w-10 h-10"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{review.reviewer?.full_name || 'Client'}</p>
                          <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {Number(review.rating).toFixed(1)}
                      </div>
                    </div>

                    {review.comment && <p className="mt-3 text-sm text-gray-700">{review.comment}</p>}

                    {review.reply ? (
                      <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
                        <p className="text-xs font-semibold text-gray-900">Your reply</p>
                        <p className="mt-1 text-sm text-gray-700">{review.reply}</p>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={replyDraftByReviewId[review.id] || ''}
                          onChange={(event) =>
                            setReplyDraftByReviewId((current) => ({ ...current, [review.id]: event.target.value }))
                          }
                          placeholder="Write a reply..."
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                        />
                        <button
                          onClick={() => void handleSubmitReviewReply(review.id)}
                          disabled={isSubmittingReplyForId === review.id}
                          className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                        >
                          {isSubmittingReplyForId === review.id ? 'Posting...' : 'Reply'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : section === 'earnings' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Earnings</h2>
              <p className="text-sm text-gray-600 md:text-base">Simulated earnings and payment status — no real payments are processed</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
              {[
                {
                  label: 'Total earned',
                  value: formatCurrencyAmount(
                    convertAmount(earningsStats.totalEarned, 'THB', normalizeCurrencyCode(preferredCurrency, 'THB')),
                    normalizeCurrencyCode(preferredCurrency, 'THB')
                  ),
                  icon: DollarSign,
                },
                {
                  label: 'Pending / in escrow',
                  value: formatCurrencyAmount(
                    convertAmount(earningsStats.pendingInEscrow, 'THB', normalizeCurrencyCode(preferredCurrency, 'THB')),
                    normalizeCurrencyCode(preferredCurrency, 'THB')
                  ),
                  icon: Clock,
                },
                { label: 'Total bookings', value: earningsStats.bookingCount, icon: Layers },
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

            {bookings.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <p className="text-sm text-gray-500">No bookings yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => {
                  const isDisputed = booking.dispute_status === 'open';
                  const isRefunded = booking.payment_status === 'refunded';
                  // unpaid -> deposit_paid is a client-only action (paying money in) —
                  // a freelancer can only advance deposit_paid -> paid from here.
                  const nextStatus =
                    isDisputed || isRefunded || booking.payment_status === 'unpaid'
                      ? null
                      : PAYMENT_STATUS_SEQUENCE[PAYMENT_STATUS_SEQUENCE.indexOf(booking.payment_status) + 1];
                  return (
                    <div
                      key={booking.id}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between md:p-5"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{booking.project_name}</p>
                        <p className="text-xs text-gray-500">
                          {booking.client?.full_name || 'Client'} ·{' '}
                          {formatCurrencyAmount(
                            convertAmount(Number(booking.budget || 0), 'THB', normalizeCurrencyCode(preferredCurrency, 'THB')),
                            normalizeCurrencyCode(preferredCurrency, 'THB')
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isDisputed ? (
                          <button
                            onClick={() => navigate(`/freelancer-booking/${booking.id}`)}
                            className="flex-shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            Disputed — action needed
                          </button>
                        ) : isRefunded ? (
                          <span className="flex-shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                            Refunded
                          </span>
                        ) : (
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                            {PAYMENT_STATUS_LABEL[booking.payment_status] || booking.payment_status} {booking.payment_status === 'paid' ? '✓' : ''}
                          </span>
                        )}
                        {nextStatus ? (
                          <button
                            onClick={() => void handleAdvancePaymentStatus(booking)}
                            disabled={isUpdatingPaymentForId === booking.id}
                            className="flex-shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                          >
                            {isUpdatingPaymentForId === booking.id ? 'Updating...' : `Mark as ${PAYMENT_STATUS_LABEL[nextStatus]}`}
                          </button>
                        ) : !isDisputed && !isRefunded && booking.payment_status === 'unpaid' ? (
                          <span className="flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                            Awaiting client deposit
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {teamEarnings.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-bold text-gray-900">Team Earnings</h3>
                <div className="space-y-2">
                  {teamEarnings.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{entry.projectName}</p>
                        <p className="text-xs text-gray-500">{entry.teamName}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        Your share:{' '}
                        {formatCurrencyAmount(
                          convertAmount(entry.share, 'THB', normalizeCurrencyCode(preferredCurrency, 'THB')),
                          normalizeCurrencyCode(preferredCurrency, 'THB')
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : section === 'teams' ? (
          <div className="space-y-6 md:space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Teams</h2>
                <p className="text-sm text-gray-600 md:text-base">Create a team, invite members, and take on jobs together</p>
              </div>
              <button
                onClick={() => setIsCreateTeamFormOpen((current) => !current)}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                <Plus className="h-4 w-4" />
                Create Team
              </button>
            </div>

            {isCreateTeamFormOpen && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
                <p className="mb-3 text-sm font-semibold text-gray-900">New team</p>
                <div className="space-y-3">
                  <input
                    value={newTeamName}
                    onChange={(event) => setNewTeamName(event.target.value)}
                    placeholder="Team name"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <textarea
                    value={newTeamDescription}
                    onChange={(event) => setNewTeamDescription(event.target.value)}
                    placeholder="What does this team do?"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    onClick={() => void handleCreateTeam()}
                    disabled={isSavingTeam}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {isSavingTeam ? 'Creating...' : 'Create Team'}
                  </button>
                </div>
              </div>
            )}

            {teamInvitations.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
                <h3 className="mb-3 text-lg font-bold text-gray-900">Team Invitations</h3>
                <div className="space-y-2">
                  {teamInvitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{invitation.team?.name}</p>
                        <p className="text-xs text-gray-600">Invited by {invitation.inviter?.full_name || 'a team owner'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleRespondToTeamInvitation(invitation.id, true)}
                          disabled={isRespondingToInvitationId === invitation.id}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => void handleRespondToTeamInvitation(invitation.id, false)}
                          disabled={isRespondingToInvitationId === invitation.id}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {teamBookingConfirmations.filter((confirmation) => confirmation.status === 'pending').length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
                <h3 className="mb-3 text-lg font-bold text-gray-900">Team Booking Requests</h3>
                <div className="space-y-2">
                  {teamBookingConfirmations
                    .filter((confirmation) => confirmation.status === 'pending')
                    .map((confirmation) => (
                      <div key={confirmation.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{confirmation.team_booking?.project_name}</p>
                          <p className="text-xs text-gray-600">
                            {confirmation.team_booking?.team?.name} · {confirmation.team_booking?.client?.full_name || 'Client'} ·{' '}
                            {formatCurrencyAmount(Number(confirmation.team_booking?.budget || 0), 'THB')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleRespondToTeamBookingConfirmation(confirmation.id, 'confirmed')}
                            disabled={isRespondingToConfirmationId === confirmation.id}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => void handleRespondToTeamBookingConfirmation(confirmation.id, 'declined')}
                            disabled={isRespondingToConfirmationId === confirmation.id}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {teams.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <p className="text-sm text-gray-500">You're not part of a team yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((entry) => {
                  const team = entry.team;
                  const isOwner = entry.role === 'owner';
                  const members = teamMembersByTeamId[team?.id] || [];

                  return (
                    <div key={team?.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{team?.name}</p>
                          {team?.description && <p className="mt-1 text-sm text-gray-600">{team.description}</p>}
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => navigate(`/team/${team.id}`)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View Public Page
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => setInviteFormOpenForTeamId((current) => (current === team.id ? null : team.id))}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              Invite Member
                            </button>
                          )}
                        </div>
                      </div>

                      {inviteFormOpenForTeamId === team?.id && (
                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <input
                              value={inviteEmail}
                              onChange={(event) => setInviteEmail(event.target.value)}
                              placeholder="e.g. name@example.com"
                              className="sm:col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={inviteRevenueShare}
                              onChange={(event) => setInviteRevenueShare(event.target.value)}
                              placeholder="e.g. 30"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <button
                            onClick={() => void handleSendTeamInvite(team.id)}
                            disabled={isSendingInvite}
                            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                          >
                            {isSendingInvite ? 'Sending...' : 'Send Invite'}
                          </button>
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        {members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={member.user?.avatar_url || DEFAULT_AVATAR_URL}
                                alt={member.user?.full_name || 'Member'}
                                gender={member.user?.gender}
                                sizeClassName="w-8 h-8"
                              />
                              <span className="text-sm font-semibold text-gray-900">{member.user?.full_name || 'Member'}</span>
                              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-semibold capitalize text-gray-600">
                                {member.role}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{Number(member.revenue_share_percent || 0)}% share</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Services</h2>
              <p className="text-sm text-gray-600 md:text-base">Manage your bookable services and blocked availability. Public profile details (title, rate, skills, styles, working hours, and more) are edited from Edit Profile.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
              <h3 className="mb-1 text-lg font-bold text-gray-900">Blocked Dates</h3>
              <p className="mb-4 text-sm text-gray-600">Block off specific dates you're not available, with an optional reason.</p>

              {blockedDates.length > 0 && (
                <div className="mb-4 space-y-2">
                  {blockedDates.map((blocked) => (
                    <div key={blocked.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(blocked.blocked_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {blocked.reason && <p className="text-xs text-gray-600">{blocked.reason}</p>}
                      </div>
                      <button
                        onClick={() => void handleRemoveBlockedDate(blocked.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600"
                        aria-label="Unblock date"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="date"
                  value={newBlockedDate}
                  onChange={(event) => setNewBlockedDate(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 sm:w-48"
                />
                <input
                  value={newBlockedReason}
                  onChange={(event) => setNewBlockedReason(event.target.value)}
                  placeholder="Reason (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => void handleAddBlockedDate()}
                  disabled={isSavingBlockedDate}
                  className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Block Date
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">My Services</h3>
                  <p className="text-sm text-gray-600">Shown on your public profile so clients know what you offer and what it costs.</p>
                </div>
                <button
                  onClick={() => openServiceForm()}
                  className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  Add Service
                </button>
              </div>

              {services.length > 0 && (
                <div className="mb-4 space-y-2">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{service.name}</p>
                        <p className="text-xs text-gray-600">
                          {service.pricing_type === 'fixed' && service.starting_price != null
                            ? formatCurrencyAmount(Number(service.starting_price), 'THB')
                            : service.pricing_type === 'custom_quote'
                            ? 'Custom quote'
                            : service.starting_price != null
                            ? `From ${formatCurrencyAmount(Number(service.starting_price), 'THB')}`
                            : 'Price on request'}
                          {service.duration ? ` · ${service.duration}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        <button
                          onClick={() => openServiceForm(service)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                          aria-label={`Edit ${service.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void handleDeleteService(service.id)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600"
                          aria-label={`Delete ${service.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isServiceFormOpen && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">{editingServiceId ? 'Edit service' : 'New service'}</p>
                  <input
                    value={serviceForm.name}
                    onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Service name, e.g. Wedding Photography"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <textarea
                    value={serviceForm.description}
                    onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="What this service includes"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <select
                      value={serviceForm.pricing_type}
                      onChange={(event) => setServiceForm((current) => ({ ...current, pricing_type: event.target.value as ServiceFormState['pricing_type'] }))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="fixed">Fixed price</option>
                      <option value="starting_from">Starting from</option>
                      <option value="custom_quote">Custom quote</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={serviceForm.starting_price}
                      onChange={(event) => setServiceForm((current) => ({ ...current, starting_price: event.target.value }))}
                      placeholder="e.g. 1500"
                      disabled={serviceForm.pricing_type === 'custom_quote'}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
                    />
                    <input
                      value={serviceForm.duration}
                      onChange={(event) => setServiceForm((current) => ({ ...current, duration: event.target.value }))}
                      placeholder="How long it takes, e.g. 8 hours (not a price)"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <input
                    value={serviceForm.included}
                    onChange={(event) => setServiceForm((current) => ({ ...current, included: event.target.value }))}
                    placeholder="What's included, e.g. 300 edited photos, online gallery"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    value={serviceForm.extras}
                    onChange={(event) => setServiceForm((current) => ({ ...current, extras: event.target.value }))}
                    placeholder="Optional extras, e.g. Additional hour:1000, Drone shots:1500"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    value={serviceForm.requirements}
                    onChange={(event) => setServiceForm((current) => ({ ...current, requirements: event.target.value }))}
                    placeholder="Requirements for this service (optional)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsServiceFormOpen(false);
                        setEditingServiceId(null);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSaveService()}
                      disabled={isSavingService}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                    >
                      {isSavingService ? 'Saving...' : 'Save Service'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmOfferDialog
          type={confirmAction.type}
          projectName={confirmAction.request.project_name}
          price={
            confirmAction.request.status === 'countered'
              ? Number(confirmAction.request.counter_price || 0)
              : Number(confirmAction.request.budget || 0)
          }
          isSubmitting={isSubmittingConfirm}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void handleConfirmedAction()}
        />
      )}

      {historyModalRequestId && (
        <NegotiationHistoryModal
          request={requests.find((item) => item.id === historyModalRequestId)}
          onClose={() => setHistoryModalRequestId(null)}
          canAccept={['pending', 'countered'].includes(
            requests.find((item) => item.id === historyModalRequestId)?.status
          ) && requests.find((item) => item.id === historyModalRequestId)?.counter_by !== 'freelancer'}
          canReject={['pending', 'countered'].includes(
            requests.find((item) => item.id === historyModalRequestId)?.status
          ) && requests.find((item) => item.id === historyModalRequestId)?.counter_by !== 'freelancer'}
          canCounter={
            (() => {
              const request = requests.find((item) => item.id === historyModalRequestId);
              if (!request) return false;
              if (request.status === 'pending') return Number(request.counter_round || 1) < MAX_NEGOTIATION_ROUNDS;
              if (request.status === 'countered' && request.counter_by === 'client') return Number(request.counter_round || 1) < MAX_NEGOTIATION_ROUNDS;
              return false;
            })()
          }
          onAccept={() => {
            const request = requests.find((item) => item.id === historyModalRequestId);
            if (request) setConfirmAction({ type: 'accept', request });
            setHistoryModalRequestId(null);
          }}
          onReject={() => {
            const request = requests.find((item) => item.id === historyModalRequestId);
            if (request) setConfirmAction({ type: 'reject', request });
            setHistoryModalRequestId(null);
          }}
          onCounter={() => {
            setCounterFormOpenForId(historyModalRequestId);
            setCounterPriceInput('');
            setCounterMessageInput('');
            setCounterIncludesInput('');
            setHistoryModalRequestId(null);
          }}
          onMessage={() => {
            const request = requests.find((item) => item.id === historyModalRequestId);
            setHistoryModalRequestId(null);
            if (request) navigate('/messages', { state: { openConversationWithUserId: request.client_id } });
          }}
        />
      )}
    </div>
  );
}
