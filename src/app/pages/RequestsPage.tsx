import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, MessageCircle, Edit, AlertCircle, DollarSign, Check, X, UserPlus, Search, Clock, MapPin } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { FeedService } from '../../lib/feedService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { stripRequestDisplayMeta, summarizeGroupRequestMembers } from '../../lib/groupRequest';
import { appendBudgetMeta, extractBudgetMeta, formatBudgetRange, stripBudgetMeta } from '../../lib/requestBudget';
import { appendScheduleMeta, extractScheduleMeta, formatScheduleMeta, generateTimeSlots, formatTimeLabel } from '../../lib/requestSchedule';
import { appendLocationMeta, extractLocationMeta } from '../../lib/requestLocation';
import { convertAmount, formatCurrencyAmount } from '../../lib/currency';
import { acceptRequestAndCreateBooking } from '../../lib/acceptRequest';
import { ConfirmOfferDialog } from '../components/negotiation/ConfirmOfferDialog';
import { NegotiationHistoryModal } from '../components/negotiation/NegotiationHistoryModal';
import { MAX_NEGOTIATION_ROUNDS } from '../../lib/negotiation';

interface RequestsPageProps {
  onBack: () => void;
  onViewProfile?: (freelancerId: string) => void;
  onOpenMessages?: (recipientId?: string) => void;
}

type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'cancelled';

const OTHER_PURPOSE_VALUE = '__other__';
const OTHER_LOCATION_VALUE = '__other__';

const getStatusColor = (status: RequestStatus) => {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'countered':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'accepted':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-500 border-gray-200';
  }
};

const getStatusText = (status: RequestStatus) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function RequestsPage({ onBack, onViewProfile, onOpenMessages }: RequestsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [groupMemberNamesByRequest, setGroupMemberNamesByRequest] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [availableFreelancers, setAvailableFreelancers] = useState<
    Array<{ id: string; full_name: string; title: string; skills: string[]; hourlyRate: number | null; rateCurrency: string }>
  >([]);
  const [addReplacementFor, setAddReplacementFor] = useState<any | null>(null);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementFreelancerId, setReplacementFreelancerId] = useState<string | null>(null);
  const [replacementPurpose, setReplacementPurpose] = useState('');
  const [replacementCustomPurpose, setReplacementCustomPurpose] = useState('');
  const [replacementBudget, setReplacementBudget] = useState('');
  const [isSubmittingReplacement, setIsSubmittingReplacement] = useState(false);
  const [counterFormOpenForId, setCounterFormOpenForId] = useState<string | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState('');
  const [counterMessageInput, setCounterMessageInput] = useState('');
  const [counterIncludesInput, setCounterIncludesInput] = useState('');
  const [counterDateInput, setCounterDateInput] = useState('');
  const [counterTimeInput, setCounterTimeInput] = useState('');
  const [counterEndTimeInput, setCounterEndTimeInput] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'accept' | 'reject'; request: any } | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [historyModalRequestId, setHistoryModalRequestId] = useState<string | null>(null);
  const [openingBookingForRequestId, setOpeningBookingForRequestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    projectName: '',
    currency: 'THB',
    budgetMin: '',
    budgetMax: '',
    description: '',
    recipientIds: [] as string[],
    scheduleDate: '',
    scheduleTime: '',
    scheduleEndTime: '',
    location: '',
    customLocation: '',
  });
  const [editLocationOptions, setEditLocationOptions] = useState<string[]>([]);
  // The freelancer's own limits (working hours, minimum rate) — the
  // original request creation form (FreelancerProfile.tsx) enforces these
  // by construction (a working-hours-bounded time <select>, a `min` on the
  // budget input), but this edit form used plain <input type="time">/
  // number fields with no such bound, letting an edit land outside either
  // one even though the freelancer never offered that. Mirrors that same
  // enforcement here instead of re-deriving a third copy of it.
  const [editTimeSlots, setEditTimeSlots] = useState<string[]>([]);
  const [editMinimumOffer, setEditMinimumOffer] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const response = await DataService.getClientRequestsWithProgress(user.id);
      if (!isMounted) return;

      if (response.error) {
        setError((response.error as any)?.message || 'Unable to load your requests.');
        setRequests([]);
      } else {
        setRequests(response.data || []);
      }

      setIsLoading(false);
    }

    async function loadFreelancerOptions() {
      const response = await DataService.getAllFreelancers(80);
      if (!isMounted || response.error) {
        return;
      }

      const items = (response.data || []).map((item: any) => ({
        id: String(item.user_id || item.users?.id || item.id),
        full_name: item.users?.full_name || item.title || 'Freelancer',
        title: item.title || item.skills?.[0] || 'Creative Freelancer',
        skills: Array.isArray(item.skills) ? item.skills : [],
        hourlyRate: item.hourly_rate ? Number(item.hourly_rate) : null,
        rateCurrency: item.users?.preferred_currency || 'THB',
      }));
      setAvailableFreelancers(items);
    }

    loadRequests();
    loadFreelancerOptions();

    // If navigation passed an openRequestId in state, attempt to open that request after load
    const openRequestId = (location.state as any)?.openRequestId as string | undefined;
    if (openRequestId) {
      (async () => {
        // Wait briefly for requests to load then open the matching one
        await new Promise((r) => setTimeout(r, 250));
        const resp = await DataService.getClientRequestsWithProgress(user?.id || '');
        if (!resp.error) {
          const found = (resp.data || []).find((r: any) => r.id === openRequestId);
          if (found) openEditRequest(found);
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Without this, a freelancer's counter offer / accept / reject only ever
  // showed up here after a manual page reload — the initial load effect
  // above only ever runs once on mount.
  useEffect(() => {
    if (!user?.id) return;

    const channel = FeedService.subscribeToRequests(user.id, () => {
      void reloadRequests();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    const groupRecipientIds = requests.flatMap((request) => request.group_meta?.recipients || []);
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
        const meta = request.group_meta || DataService.getRequestGroupMeta(request);
        if (!meta?.recipients?.length) {
          continue;
        }

        const names = meta.recipients
          .map((recipientId: string) => profilesById.get(String(recipientId))?.full_name)
          .filter((name: string | null | undefined): name is string => Boolean(name && name.trim()));

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

  const normalizedRequests = useMemo(
    () =>
      requests.map((request) => ({
        raw: request,
        budgetMeta: extractBudgetMeta(request.message, request.description) || {
          currency: 'THB',
          min: Number(request.budget || 0),
          max: Number(request.budget || 0),
        },
        scheduleMeta: extractScheduleMeta(request.message, request.description),
        locationMeta: extractLocationMeta(request.message, request.description),
        notesText: stripRequestDisplayMeta(request.message || request.description || ''),
        id: request.id,
        groupMeta: request.group_meta || null,
        acceptanceProgress: request.acceptance_progress || '0 out of 1 accepted',
        isGroupRequest: Boolean(request.is_group_request),
        freelancer: {
          id: request.freelancer?.id || request.freelancer_id || '',
          name: request.freelancer?.full_name || 'Freelancer',
          specialty: request.freelancer?.title || 'Creative Freelancer',
          avatar: request.freelancer?.avatar_url || DEFAULT_AVATAR_URL,
          gender: request.freelancer?.gender || null,
        },
        projectName: request.project_name,
        budget: Number(request.budget || 0),
        status: request.status as RequestStatus,
        counterPrice: request.counter_price != null ? Number(request.counter_price) : null,
        counterMessage: request.counter_message || null,
        counterBy: request.counter_by || null,
        counterRound: Number(request.counter_round || 1),
        counterDate: request.counter_date || null,
        counterTime: request.counter_time ? String(request.counter_time).slice(0, 5) : null,
        counterEndTime: request.counter_end_time ? String(request.counter_end_time).slice(0, 5) : null,
        includes: request.includes || null,
        date: request.created_at,
      })),
    [requests, groupMemberNamesByRequest]
  );

  const openEditRequest = async (request: any) => {
    if (request.status !== 'pending') {
      return;
    }

    setEditingRequest(request);
    // Now that this modal actually renders {error} (see the banner above
    // the Save/Cancel row below), a stale error left over from some other
    // action must not carry over and show up the instant this opens.
    setError(null);

    // Same three sources FreelancerProfile.tsx's own booking form builds its
    // location dropdown from (studio locations, preferred locations, plain
    // profile location) — fetched fresh here since RequestsPage never
    // otherwise loads a single freelancer's full profile. getUser alongside
    // it for preferred_currency, which getFreelancerProfile's own nested
    // users(...) select doesn't include (needed to convert hourly_rate into
    // the same currency this request's budget is in, below).
    const [profileResponse, freelancerUserResponse] = await Promise.all([
      DataService.getFreelancerProfile(request.freelancer.id),
      DataService.getUser(request.freelancer.id),
    ]);
    const freelancerProfile = profileResponse.data as any;
    const studioName: string = freelancerProfile?.studio_name || '';
    const studioLocations: Array<{ formattedAddress: string }> = freelancerProfile?.studio_locations || [];
    const preferredLocations: Array<{ formattedAddress: string }> = freelancerProfile?.locations || [];
    const studioLocationOptions = studioLocations.map((loc) => (studioName ? `${studioName} — ${loc.formattedAddress}` : loc.formattedAddress));
    const locationOptions = [...studioLocationOptions, ...preferredLocations.map((loc) => loc.formattedAddress)];
    const plainProfileLocation = freelancerProfile?.users?.location;
    if (plainProfileLocation && !locationOptions.includes(plainProfileLocation)) {
      locationOptions.unshift(plainProfileLocation);
    }
    setEditLocationOptions(locationOptions);

    // Same working-hours-bounded slot list as the creation form (see
    // FreelancerProfile.tsx) — this doesn't also exclude the freelancer's
    // other bookings on the chosen date the way that form does, since this
    // request's OWN existing slot is one of those bookings; the freelancer
    // still reviews and can reject/counter an edited request same as a new
    // one, so this only needs to keep it inside their stated working hours.
    setEditTimeSlots(generateTimeSlots(freelancerProfile?.working_hours_start, freelancerProfile?.working_hours_end));

    const requestCurrency = request.budgetMeta?.currency || 'THB';
    const freelancerRateCurrency = (freelancerUserResponse.data as any)?.preferred_currency || 'THB';
    setEditMinimumOffer(
      freelancerProfile?.hourly_rate ? convertAmount(Number(freelancerProfile.hourly_rate), freelancerRateCurrency, requestCurrency) : 0
    );

    const currentLocation = request.locationMeta || '';
    const isKnownLocation = !currentLocation || locationOptions.includes(currentLocation);

    setEditForm({
      projectName: request.projectName,
      currency: requestCurrency,
      budgetMin: String(request.budgetMeta?.min || request.budget || ''),
      budgetMax: String(request.budgetMeta?.max || request.budget || ''),
      description: request.notesText || '',
      recipientIds: request.groupMeta?.recipients || [],
      scheduleDate: request.scheduleMeta?.date || '',
      scheduleTime: request.scheduleMeta?.time || '',
      scheduleEndTime: request.scheduleMeta?.endTime || '',
      location: isKnownLocation ? currentLocation : OTHER_LOCATION_VALUE,
      customLocation: isKnownLocation ? '' : currentLocation,
    });
  };

  const saveRequestEdits = async () => {
    if (!user?.id || !editingRequest) {
      return;
    }

    const min = Number(editForm.budgetMin);
    const max = Number(editForm.budgetMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || max < min) {
      setError('Please enter a valid budget range.');
      return;
    }

    if (editMinimumOffer > 0 && min < editMinimumOffer) {
      setError(`Your budget must be at least ${formatCurrencyAmount(editMinimumOffer, editForm.currency)}.`);
      return;
    }

    if (Boolean(editForm.scheduleDate) !== Boolean(editForm.scheduleTime)) {
      setError('Please set both a date and a time, or leave both empty.');
      return;
    }

    if (editForm.scheduleEndTime && !editForm.scheduleTime) {
      setError('Please set a start time before an end time.');
      return;
    }

    if (editForm.scheduleEndTime && editForm.scheduleEndTime <= editForm.scheduleTime) {
      setError('End time must be after the start time.');
      return;
    }

    const descriptionWithBudget = appendBudgetMeta(editForm.description, {
      currency: (editForm.currency || editingRequest.budgetMeta?.currency || 'THB').trim().toUpperCase(),
      min,
      max,
    });

    const descriptionWithSchedule =
      editForm.scheduleDate && editForm.scheduleTime
        ? appendScheduleMeta(descriptionWithBudget, {
            date: editForm.scheduleDate,
            time: editForm.scheduleTime,
            endTime: editForm.scheduleEndTime || undefined,
          })
        : descriptionWithBudget;

    const resolvedLocation = editForm.location === OTHER_LOCATION_VALUE ? editForm.customLocation.trim() : editForm.location;
    const descriptionWithLocation = appendLocationMeta(descriptionWithSchedule, resolvedLocation.trim());

    const response = await DataService.updatePendingBookingRequest({
      requestId: editingRequest.id,
      clientId: user.id,
      projectName: editForm.projectName,
      description: descriptionWithLocation,
      budget: max,
      recipientIds: editingRequest.groupMeta ? editForm.recipientIds : undefined,
    });

    if (response.error) {
      setError((response.error as any).message || 'Unable to update request.');
      return;
    }

    setEditingRequest(null);
    setError(null);

    const reload = await DataService.getClientRequestsWithProgress(user.id);
    if (!reload.error) {
      setRequests(reload.data || []);
    }
  };

  const reloadRequests = async () => {
    if (!user?.id) return;
    const reload = await DataService.getClientRequestsWithProgress(user.id);
    if (!reload.error) {
      setRequests(reload.data || []);
    }
  };

  const openAddReplacement = (normalizedRequest: any) => {
    setAddReplacementFor(normalizedRequest);
    setReplacementSearch('');
    setReplacementFreelancerId(null);
    setReplacementPurpose('');
    setReplacementCustomPurpose('');
    setReplacementBudget('');
    setError(null);
  };

  const replacementMinimum = (freelancer: { hourlyRate: number | null; rateCurrency: string }) =>
    freelancer.hourlyRate ? convertAmount(freelancer.hourlyRate, freelancer.rateCurrency, 'THB') : 0;

  const submitAddReplacement = async () => {
    const groupId = addReplacementFor?.groupMeta?.group_id;
    if (!user?.id || !groupId || !replacementFreelancerId) {
      return;
    }

    const freelancer = availableFreelancers.find((item) => item.id === replacementFreelancerId);
    const resolvedPurpose = replacementPurpose === OTHER_PURPOSE_VALUE ? replacementCustomPurpose.trim() : replacementPurpose;
    if (!resolvedPurpose) {
      setError('Choose a purpose for the new freelancer.');
      return;
    }

    const budgetAmount = Number(replacementBudget);
    if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
      setError('Enter a budget for the new freelancer.');
      return;
    }

    if (freelancer) {
      const minimum = replacementMinimum(freelancer);
      if (budgetAmount < minimum) {
        setError(`Your offer must be at least ${formatCurrencyAmount(minimum, 'THB')}.`);
        return;
      }
    }

    setIsSubmittingReplacement(true);
    const { error: addError } = await DataService.addFreelancerToGroupRequest({
      clientId: user.id,
      groupId,
      freelancerId: replacementFreelancerId,
      projectName: resolvedPurpose,
      budget: budgetAmount,
    });
    setIsSubmittingReplacement(false);

    if (addError) {
      setError((addError as any).message || 'Unable to add this freelancer.');
      return;
    }

    setAddReplacementFor(null);
    await reloadRequests();
  };

  const getEffectiveSchedule = (normalizedRequest: any) => {
    if (normalizedRequest?.status === 'countered' && normalizedRequest.counterDate) {
      return {
        date: normalizedRequest.counterDate,
        time: normalizedRequest.counterTime || '',
        endTime: normalizedRequest.counterEndTime || '',
      };
    }
    return normalizedRequest?.scheduleMeta || { date: '', time: '', endTime: '' };
  };

  // The price a counter offer starts from if the client doesn't touch that
  // field at all — the request's current terms, so e.g. changing only the
  // time doesn't force re-typing a price that isn't actually changing.
  const getEffectivePrice = (normalizedRequest: any) =>
    normalizedRequest?.status === 'countered' && normalizedRequest.counterPrice != null
      ? Number(normalizedRequest.counterPrice)
      : Number(normalizedRequest?.budget || 0);

  const openCounterForm = (normalizedRequest: any) => {
    const schedule = getEffectiveSchedule(normalizedRequest);
    setCounterFormOpenForId(normalizedRequest.id);
    setCounterPriceInput(String(getEffectivePrice(normalizedRequest) || ''));
    setCounterMessageInput('');
    setCounterIncludesInput('');
    setCounterDateInput(schedule.date || '');
    setCounterTimeInput(schedule.time || '');
    setCounterEndTimeInput(schedule.endTime || '');
  };

  const handleSendCounterOffer = async (requestId: string) => {
    const normalizedRequest = normalizedRequests.find((item) => item.id === requestId);

    // Every field here is optional — whatever the client leaves untouched
    // (or clears) just carries over the request's current terms, so e.g.
    // countering only the time doesn't require re-entering a price.
    const trimmedPrice = counterPriceInput.trim();
    const price = trimmedPrice ? Number(trimmedPrice) : getEffectivePrice(normalizedRequest);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a valid proposed price.');
      return;
    }

    const effectiveSchedule = getEffectiveSchedule(normalizedRequest);
    const counterDate = counterDateInput || effectiveSchedule.date;
    const counterTime = counterTimeInput || effectiveSchedule.time;
    if (!counterDate || !counterTime) {
      setError('Choose a date and time for your counter offer.');
      return;
    }

    const counterEndTime = counterEndTimeInput || effectiveSchedule.endTime || '';
    if (counterEndTime && counterEndTime <= counterTime) {
      setError('End time must be after the start time.');
      return;
    }

    const rawRequest = requests.find((item) => item.id === requestId);
    const nextRound = Number(rawRequest?.counter_round || 1) + 1;

    setError(null);
    setIsSubmittingCounter(true);

    const response = await DataService.updateRequest(requestId, {
      status: 'countered',
      counter_price: price,
      counter_message: counterMessageInput.trim() || null,
      counter_by: 'client',
      counter_round: nextRound,
      includes: counterIncludesInput.trim() || null,
      counter_date: counterDate,
      counter_time: counterTime,
      counter_end_time: counterEndTime || null,
    } as any);

    setIsSubmittingCounter(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to send counter offer.');
      return;
    }

    setCounterFormOpenForId(null);
    setCounterPriceInput('');
    setCounterMessageInput('');
    setCounterIncludesInput('');
    setCounterDateInput('');
    setCounterTimeInput('');
    setCounterEndTimeInput('');
    await reloadRequests();
  };

  const handleAcceptCounter = async (normalizedRequest: any) => {
    setError(null);
    const rawRequest = normalizedRequest.raw || requests.find((item) => item.id === normalizedRequest.id);
    if (!rawRequest) {
      setError('Unable to find this request\'s details. Please refresh the page and try again.');
      return;
    }

    const counterPrice = Number(normalizedRequest.counterPrice);
    const { error: acceptError } = await acceptRequestAndCreateBooking(rawRequest, counterPrice);
    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    const response = await DataService.updateRequest(normalizedRequest.id, { status: 'accepted', budget: counterPrice } as any);
    if (response.error) {
      setError((response.error as any).message || 'Unable to accept counter offer.');
      return;
    }

    await reloadRequests();
  };

  const handleRejectCounter = async (requestId: string) => {
    setError(null);
    const response = await DataService.updateRequest(requestId, { status: 'rejected' } as any);
    if (response.error) {
      setError((response.error as any).message || 'Unable to reject counter offer.');
      return;
    }
    await reloadRequests();
  };

  const handleOpenAcceptedRequest = async (request: any) => {
    if (request.status !== 'accepted' || openingBookingForRequestId) {
      return;
    }

    setOpeningBookingForRequestId(request.id);
    setError(null);

    const response = await DataService.getBookingByRequestId(request.id);

    setOpeningBookingForRequestId(null);

    if (response.error || !response.data?.id) {
      setError('Unable to find the booking for this request.');
      return;
    }

    navigate(`/booking/${response.data.id}`);
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    setIsSubmittingConfirm(true);
    // Without this, an unexpected thrown error (as opposed to a returned
    // { error }) left the dialog stuck on "Please wait..." forever — neither
    // line below it ever ran, and the user had no way out but a page reload.
    try {
      if (confirmAction.type === 'accept') {
        await handleAcceptCounter(confirmAction.request);
      } else {
        await handleRejectCounter(confirmAction.request.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmittingConfirm(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="relative min-h-screen pb-20 md:pb-12">
      <PageBackdrop />
      <div className="relative z-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-sky-100 mb-6 md:mb-8">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            Back to Home
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">My Requests</h1>
            <p className="text-sm md:text-base text-gray-600">Track and manage your booking requests</p>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
          </div>
        ) : (
        <div className="space-y-4">
          {normalizedRequests.map((request) => (
            <div
              key={request.id}
              onClick={() => request.status === 'accepted' && void handleOpenAcceptedRequest(request)}
              className={`bg-white/90 backdrop-blur-xl rounded-xl md:rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 overflow-hidden hover:shadow-[0_12px_36px_rgba(56,189,248,0.25)] transition-shadow ${
                request.status === 'accepted' ? 'cursor-pointer' : ''
              }`}
            >
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                  {/* Freelancer Avatar */}
                  <div className="relative flex-shrink-0 self-center md:self-auto w-16 h-16 md:w-20 md:h-20">
                    <div className="h-full w-full rounded-xl overflow-hidden ring-2 ring-white shadow-md">
                      <ImageWithFallback
                        src={request.freelancer.avatar}
                        alt={request.freelancer.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 gap-2">
                      <div className="text-center md:text-left">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
                          {request.projectName}
                        </h3>
                        <p className="text-sm md:text-base text-gray-600">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              request.freelancer.id && navigate(`/profile/${request.freelancer.id}`);
                            }}
                            className="font-semibold text-gray-900 hover:text-black"
                          >
                            {request.freelancer.name}
                          </button>
                          {' · '}
                          {request.freelancer.specialty}
                        </p>
                      </div>
                      <div
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold border-2 ${getStatusColor(request.status)} self-center md:self-auto whitespace-nowrap`}
                      >
                        {getStatusText(request.status)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 mb-4 text-xs md:text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="font-semibold text-gray-900">{formatBudgetRange(request.budgetMeta)}</span>
                      </div>
                      {request.scheduleMeta && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{formatScheduleMeta(request.scheduleMeta)}</span>
                        </div>
                      )}
                      {request.locationMeta && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{request.locationMeta}</span>
                        </div>
                      )}
                      <div className="text-gray-400">
                        Sent {new Date(request.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      {request.isGroupRequest && (
                        <div>
                          <span className="font-semibold text-gray-900">Status:</span> {request.acceptanceProgress}
                        </div>
                      )}
                    </div>

                    {request.notesText && (
                      <p className="mb-4 text-xs md:text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">Notes:</span> {request.notesText}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
                      {request.status === 'pending' && (
                        <button
                          onClick={() => openEditRequest(request)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg text-sm md:text-base font-semibold shadow-md shadow-sky-500/30 hover:shadow-lg hover:scale-105 transition-all"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Request
                        </button>
                      )}
                      {request.status === 'countered' && request.counterBy === 'freelancer' && (
                        <>
                          <button
                            onClick={() => setConfirmAction({ type: 'accept', request })}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm md:text-base font-semibold hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            Accept {formatCurrencyAmount(request.counterPrice || 0, request.budgetMeta?.currency || 'THB')}
                          </button>
                          {Number(request.counterRound || 1) < MAX_NEGOTIATION_ROUNDS && (
                            <button
                              onClick={() => openCounterForm(request)}
                              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg text-sm md:text-base font-semibold shadow-md shadow-sky-500/30 hover:shadow-lg transition-all"
                            >
                              <DollarSign className="w-4 h-4" />
                              Counter Again
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'reject', request })}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-50 text-gray-700 rounded-lg text-sm md:text-base font-semibold hover:bg-sky-100 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                          <button
                            onClick={() => setHistoryModalRequestId(request.id)}
                            className="rounded-lg border border-sky-200 px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 hover:bg-sky-50"
                          >
                            View Details
                          </button>
                        </>
                      )}
                      {request.status === 'countered' && request.counterBy === 'client' && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="px-4 py-2.5 text-sm text-gray-500">
                            Waiting for {request.freelancer.name} to respond to your {formatCurrencyAmount(request.counterPrice || 0, 'THB')} offer.
                          </div>
                          <button
                            onClick={() => setHistoryModalRequestId(request.id)}
                            className="rounded-lg border border-sky-200 px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 hover:bg-sky-50"
                          >
                            View Details
                          </button>
                        </div>
                      )}
                      {request.status === 'accepted' && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenMessages?.(request.freelancer.id);
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg text-sm md:text-base font-semibold shadow-md shadow-sky-500/30 hover:shadow-lg hover:scale-105 transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </button>
                      )}
                      {request.status === 'rejected' && (
                        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-50 text-gray-700 rounded-lg text-sm md:text-base font-semibold hover:bg-sky-100 transition-colors">
                          <AlertCircle className="w-4 h-4" />
                          View Reason
                        </button>
                      )}
                      {request.status === 'rejected' && request.isGroupRequest && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openAddReplacement(request);
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg text-sm md:text-base font-semibold shadow-md shadow-sky-500/30 hover:shadow-lg transition-all"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add Another Freelancer
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewProfile?.(request.freelancer.id);
                        }}
                        className="px-4 py-2.5 text-gray-600 hover:bg-sky-50 rounded-lg text-sm md:text-base font-semibold transition-colors text-center"
                      >
                        View Profile
                      </button>
                    </div>

                    {request.status === 'countered' && (
                      <div className="mt-3 rounded-xl bg-sky-50/60 px-4 py-3 text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">
                          {request.counterBy === 'freelancer' ? "Freelancer's counter offer: " : 'Your counter offer: '}
                        </span>
                        {formatCurrencyAmount(request.counterPrice || 0, 'THB')}
                        {request.counterDate && (
                          <>
                            {' '}
                            · {formatScheduleMeta({ date: request.counterDate, time: request.counterTime || '00:00', endTime: request.counterEndTime || undefined })}
                          </>
                        )}
                        {request.counterMessage && <> — "{request.counterMessage}"</>}
                      </div>
                    )}

                    {counterFormOpenForId === request.id && (
                      <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                        <p className="mb-3 text-sm font-semibold text-gray-900">Propose a different price</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">My proposed price (optional — keeps the current price if left blank)</label>
                            <input
                              type="number"
                              min={0}
                              value={counterPriceInput}
                              onChange={(event) => setCounterPriceInput(event.target.value)}
                              placeholder="e.g. 6000"
                              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Message (optional)</label>
                            <input
                              value={counterMessageInput}
                              onChange={(event) => setCounterMessageInput(event.target.value)}
                              placeholder="Message (optional)"
                              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Proposed date (optional — keeps the current date if left blank)</label>
                            <input
                              type="date"
                              value={counterDateInput}
                              onChange={(event) => setCounterDateInput(event.target.value)}
                              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Proposed start time (optional — keeps the current time if left blank)</label>
                            <input
                              type="time"
                              value={counterTimeInput}
                              onChange={(event) => setCounterTimeInput(event.target.value)}
                              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">Proposed end time (optional — keeps the current end time if left blank)</label>
                            <input
                              type="time"
                              value={counterEndTimeInput}
                              onChange={(event) => setCounterEndTimeInput(event.target.value)}
                              className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
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
                            className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                          />
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            onClick={() => setCounterFormOpenForId(null)}
                            className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void handleSendCounterOffer(request.id)}
                            disabled={isSubmittingCounter}
                            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                          >
                            {isSubmittingCounter ? 'Sending...' : 'Send Counter Offer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Empty State */}
        {!isLoading && normalizedRequests.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-sky-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-12 h-12 text-sky-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Requests Yet</h3>
            <p className="text-gray-600">Start exploring and send booking requests to freelancers!</p>
          </div>
        )}
      </div>

      {editingRequest && (
        <div className="fixed inset-0 z-[1400] overflow-y-auto bg-white">
          <div className="relative min-h-full">
            <PageBackdrop />
            <div className="relative z-10">
              <div className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 backdrop-blur-lg">
                <div className="mx-auto max-w-2xl px-4 py-4">
                  <button
                    onClick={() => setEditingRequest(null)}
                    className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
                      <Edit className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Edit Request</h2>
                      <p className="text-sm text-gray-600">Update the details you sent to {editingRequest.freelancer.name}.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
                <div className="rounded-2xl bg-sky-50/60 p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-sky-100">
                      <ImageWithFallback src={editingRequest.freelancer.avatar} alt={editingRequest.freelancer.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{editingRequest.freelancer.name}</h3>
                      <p className="text-gray-600">{editingRequest.freelancer.specialty}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-project-name" className="mb-2 block text-sm font-semibold text-gray-900">The Purpose</label>
                  <input
                    id="edit-project-name"
                    required
                    value={editForm.projectName}
                    onChange={(event) => setEditForm((current) => ({ ...current, projectName: event.target.value }))}
                    className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="What is this booking for?"
                  />
                </div>

                <div>
                  <label htmlFor="edit-location" className="mb-2 block text-sm font-semibold text-gray-900">Location</label>
                  <select
                    id="edit-location"
                    required
                    value={editForm.location}
                    onChange={(event) => setEditForm((current) => ({ ...current, location: event.target.value }))}
                    className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="" disabled>Select a location</option>
                    {editLocationOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value={OTHER_LOCATION_VALUE}>Other (please specify)</option>
                  </select>
                  {editForm.location === OTHER_LOCATION_VALUE && (
                    <input
                      required
                      value={editForm.customLocation}
                      onChange={(event) => setEditForm((current) => ({ ...current, customLocation: event.target.value }))}
                      className="mt-3 w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder="Type the location for this booking"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="edit-notes" className="mb-2 block text-sm font-semibold text-gray-900">Notes <span className="font-normal text-gray-500">(optional)</span></label>
                  <textarea
                    id="edit-notes"
                    rows={4}
                    value={editForm.description}
                    onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                    className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="Anything else the freelancer should know?"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Schedule</label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={editForm.scheduleDate}
                      onChange={(event) => setEditForm((current) => ({ ...current, scheduleDate: event.target.value }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                    {/* Bounded to the freelancer's own working hours
                        (editTimeSlots, same generateTimeSlots the creation
                        form uses) rather than a plain <input type="time">
                        that let an edit land outside them entirely. */}
                    <select
                      value={editForm.scheduleTime}
                      onChange={(event) => setEditForm((current) => ({ ...current, scheduleTime: event.target.value }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="">Start time</option>
                      {editTimeSlots.map((slot) => (
                        <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.scheduleEndTime}
                      onChange={(event) => setEditForm((current) => ({ ...current, scheduleEndTime: event.target.value }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="">End time</option>
                      {editTimeSlots
                        .filter((slot) => !editForm.scheduleTime || slot > editForm.scheduleTime)
                        .map((slot) => (
                          <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                        ))}
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Date, start time, and end time — leave all three empty if this doesn't need a fixed schedule. Times are limited to{' '}
                    {editingRequest.freelancer.name}'s working hours.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Budget</label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      value={editForm.currency}
                      onChange={(event) => setEditForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder="Currency"
                    />
                    <input
                      value={editForm.budgetMin}
                      onChange={(event) => setEditForm((current) => ({ ...current, budgetMin: event.target.value }))}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder={editMinimumOffer > 0 ? `Minimum ${formatCurrencyAmount(editMinimumOffer, editForm.currency)}` : 'Min budget'}
                    />
                    <input
                      value={editForm.budgetMax}
                      onChange={(event) => setEditForm((current) => ({ ...current, budgetMax: event.target.value }))}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder="Max budget"
                    />
                  </div>
                  {/* Same enforcement as the creation form's minimumOffer
                      (see FreelancerProfile.tsx) — a plain number input
                      here had nothing bounding it to the freelancer's own
                      rate at all. This live hint mirrors that; the actual
                      enforcement is the check in saveRequestEdits. */}
                  {editMinimumOffer > 0 && editForm.budgetMin && Number(editForm.budgetMin) < editMinimumOffer && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      Your budget must be at least {formatCurrencyAmount(editMinimumOffer, editForm.currency)}.
                    </p>
                  )}
                </div>

                {editingRequest.groupMeta && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">Recipients</label>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-sky-100 bg-sky-50/40 p-2">
                      {availableFreelancers.map((freelancer) => {
                        const checked = editForm.recipientIds.includes(freelancer.id);
                        return (
                          <label key={freelancer.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                            <span>{freelancer.full_name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const isChecked = event.target.checked;
                                setEditForm((current) => ({
                                  ...current,
                                  recipientIds: isChecked
                                    ? Array.from(new Set([...current.recipientIds, freelancer.id]))
                                    : current.recipientIds.filter((id) => id !== freelancer.id),
                                }));
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* setError in saveRequestEdits (e.g. the budget-below-
                    the-freelancer's-rate check) had nowhere to actually
                    render inside this modal - the only {error} block in
                    this file lives in the separate "Add Another Freelancer"
                    modal, so validation was firing but silently, making a
                    rejected save look identical to nothing happening.
                    Same banner style as FreelancerProfile.tsx's booking
                    form uses for this. */}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <div className="flex items-center justify-between border-t border-sky-100 pt-6">
                  <button onClick={() => setEditingRequest(null)} className="rounded-xl px-6 py-3.5 font-semibold text-gray-700 transition-colors hover:bg-sky-50">
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveRequestEdits()}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:shadow-lg"
                  >
                    <Check className="h-5 w-5" />
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {addReplacementFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
            <h3 className="text-xl font-bold text-gray-900">Add Another Freelancer</h3>
            <p className="mt-1 text-sm text-gray-600">
              They'll join this group request with the same location and schedule — everyone else's status is untouched.
            </p>

            {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {!replacementFreelancerId ? (
              <div className="mt-4">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={replacementSearch}
                    onChange={(event) => setReplacementSearch(event.target.value)}
                    placeholder="Search freelancer by name..."
                    className="w-full rounded-xl border border-sky-100 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                  {availableFreelancers
                    .filter((item) => item.id !== addReplacementFor.freelancer?.id)
                    .filter((item) => item.full_name.toLowerCase().includes(replacementSearch.trim().toLowerCase()))
                    .map((freelancer) => (
                      <button
                        key={freelancer.id}
                        type="button"
                        onClick={() => setReplacementFreelancerId(freelancer.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left hover:bg-sky-50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{freelancer.full_name}</p>
                          <p className="text-xs text-gray-500">{freelancer.title}</p>
                        </div>
                        <span className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white">Select</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              (() => {
                const freelancer = availableFreelancers.find((item) => item.id === replacementFreelancerId);
                if (!freelancer) return null;
                const minimum = replacementMinimum(freelancer);
                return (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-sky-50/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{freelancer.full_name}</p>
                        <p className="text-xs text-gray-500">{freelancer.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplacementFreelancerId(null)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-700">Purpose</label>
                      <select
                        value={replacementPurpose}
                        onChange={(event) => setReplacementPurpose(event.target.value)}
                        className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <option value="" disabled>Select a purpose</option>
                        {freelancer.skills.map((skill) => (
                          <option key={skill} value={skill}>{skill}</option>
                        ))}
                        <option value={OTHER_PURPOSE_VALUE}>Other (please specify)</option>
                      </select>
                      {replacementPurpose === OTHER_PURPOSE_VALUE && (
                        <input
                          value={replacementCustomPurpose}
                          onChange={(event) => setReplacementCustomPurpose(event.target.value)}
                          placeholder="Type the purpose"
                          className="mt-2 w-full rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                        Budget <span className="font-normal text-gray-500">(min. {formatCurrencyAmount(minimum, 'THB')})</span>
                      </label>
                      <input
                        inputMode="decimal"
                        value={replacementBudget}
                        onChange={(event) => setReplacementBudget(event.target.value)}
                        placeholder={`Minimum ${formatCurrencyAmount(minimum, 'THB')}`}
                        className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                      {replacementBudget && Number(replacementBudget) < minimum && (
                        <p className="mt-1.5 text-xs font-semibold text-red-600">Must be at least {formatCurrencyAmount(minimum, 'THB')}.</p>
                      )}
                    </div>
                  </div>
                );
              })()
            )}

            <div className="mt-5 flex gap-3">
              <button onClick={() => setAddReplacementFor(null)} className="flex-1 rounded-xl bg-sky-50 px-4 py-2 font-semibold text-gray-700">
                Cancel
              </button>
              <button
                onClick={() => void submitAddReplacement()}
                disabled={!replacementFreelancerId || isSubmittingReplacement}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {isSubmittingReplacement ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmOfferDialog
          type={confirmAction.type}
          projectName={confirmAction.request.projectName}
          price={confirmAction.request.status === 'countered' ? Number(confirmAction.request.counterPrice || 0) : Number(confirmAction.request.budget || 0)}
          isCounterOffer={confirmAction.request.status === 'countered'}
          isSubmitting={isSubmittingConfirm}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void handleConfirmedAction()}
        />
      )}

      {historyModalRequestId && (
        <NegotiationHistoryModal
          request={requests.find((item) => item.id === historyModalRequestId)}
          onClose={() => setHistoryModalRequestId(null)}
          canAccept={
            normalizedRequests.find((item) => item.id === historyModalRequestId)?.status === 'countered' &&
            normalizedRequests.find((item) => item.id === historyModalRequestId)?.counterBy === 'freelancer'
          }
          canReject={
            normalizedRequests.find((item) => item.id === historyModalRequestId)?.status === 'countered' &&
            normalizedRequests.find((item) => item.id === historyModalRequestId)?.counterBy === 'freelancer'
          }
          canCounter={
            normalizedRequests.find((item) => item.id === historyModalRequestId)?.status === 'countered' &&
            normalizedRequests.find((item) => item.id === historyModalRequestId)?.counterBy === 'freelancer' &&
            Number(normalizedRequests.find((item) => item.id === historyModalRequestId)?.counterRound || 1) < MAX_NEGOTIATION_ROUNDS
          }
          onAccept={() => {
            const request = normalizedRequests.find((item) => item.id === historyModalRequestId);
            if (request) setConfirmAction({ type: 'accept', request });
            setHistoryModalRequestId(null);
          }}
          onReject={() => {
            const request = normalizedRequests.find((item) => item.id === historyModalRequestId);
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
            const request = normalizedRequests.find((item) => item.id === historyModalRequestId);
            setHistoryModalRequestId(null);
            if (request) onOpenMessages?.(request.freelancer.id);
          }}
        />
      )}
      </div>
    </div>
  );
}
