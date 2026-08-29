import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, MessageCircle, Edit, AlertCircle, DollarSign, Check, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { stripRequestDisplayMeta, summarizeGroupRequestMembers } from '../../lib/groupRequest';
import { appendBudgetMeta, extractBudgetMeta, formatBudgetRange, stripBudgetMeta } from '../../lib/requestBudget';
import { extractScheduleMeta, formatScheduleMeta } from '../../lib/requestSchedule';
import { extractLocationMeta } from '../../lib/requestLocation';
import { formatCurrencyAmount } from '../../lib/currency';
import { acceptRequestAndCreateBooking } from '../../lib/acceptRequest';
import { ConfirmOfferDialog } from '../components/negotiation/ConfirmOfferDialog';
import { NegotiationHistoryModal } from '../components/negotiation/NegotiationHistoryModal';
import { MAX_NEGOTIATION_ROUNDS } from '../../lib/negotiation';

interface RequestsPageProps {
  onBack: () => void;
  onViewProfile?: (status: 'accepted' | 'pending' | 'rejected') => void;
  onOpenMessages?: (recipientId?: string) => void;
}

type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'countered';

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
  const [availableFreelancers, setAvailableFreelancers] = useState<Array<{ id: string; full_name: string; title: string }>>([]);
  const [counterFormOpenForId, setCounterFormOpenForId] = useState<string | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState('');
  const [counterMessageInput, setCounterMessageInput] = useState('');
  const [counterIncludesInput, setCounterIncludesInput] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'accept' | 'reject'; request: any } | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [historyModalRequestId, setHistoryModalRequestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    projectName: '',
    currency: 'THB',
    budgetMin: '',
    budgetMax: '',
    description: '',
    recipientIds: [] as string[],
  });

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

  const normalizedRequests = useMemo(
    () =>
      requests.map((request) => ({
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
        includes: request.includes || null,
        date: request.created_at,
        message: stripRequestDisplayMeta(request.plain_message || request.message || request.description || '') || 'Group request',
      })),
    [requests, groupMemberNamesByRequest]
  );

  const openEditRequest = (request: any) => {
    if (request.status !== 'pending') {
      return;
    }

    setEditingRequest(request);
    setEditForm({
      projectName: request.projectName,
      currency: request.budgetMeta?.currency || 'THB',
      budgetMin: String(request.budgetMeta?.min || request.budget || ''),
      budgetMax: String(request.budgetMeta?.max || request.budget || ''),
      description: request.message || '',
      recipientIds: request.groupMeta?.recipients || [],
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

    const descriptionWithBudget = appendBudgetMeta(editForm.description, {
      currency: (editForm.currency || editingRequest.budgetMeta?.currency || 'THB').trim().toUpperCase(),
      min,
      max,
    });

    const response = await DataService.updatePendingBookingRequest({
      requestId: editingRequest.id,
      clientId: user.id,
      projectName: editForm.projectName,
      description: descriptionWithBudget,
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

  const handleSendCounterOffer = async (requestId: string) => {
    const price = Number(counterPriceInput);
    if (!counterPriceInput.trim() || !Number.isFinite(price) || price <= 0) {
      setError('Enter a valid proposed price.');
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
    await reloadRequests();
  };

  const handleAcceptCounter = async (normalizedRequest: any) => {
    setError(null);
    const rawRequest = requests.find((item) => item.id === normalizedRequest.id);
    if (!rawRequest) return;

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

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    setIsSubmittingConfirm(true);
    if (confirmAction.type === 'accept') {
      await handleAcceptCounter(confirmAction.request);
    } else {
      await handleRejectCounter(confirmAction.request.id);
    }
    setIsSubmittingConfirm(false);
    setConfirmAction(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 mb-6 md:mb-8">
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
            <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
          </div>
        ) : (
        <div className="space-y-4">
          {normalizedRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
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
                            onClick={() => request.freelancer.id && navigate(`/profile/${request.freelancer.id}`)}
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

                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 mb-4 text-xs md:text-sm text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-900">Budget:</span> {formatBudgetRange(request.budgetMeta)}
                      </div>
                      {request.scheduleMeta && (
                        <div>
                          <span className="font-semibold text-gray-900">Schedule:</span> {formatScheduleMeta(request.scheduleMeta)}
                        </div>
                      )}
                      {request.locationMeta && (
                        <div>
                          <span className="font-semibold text-gray-900">Location:</span> {request.locationMeta}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-900">Sent:</span> {new Date(request.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
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
                            Accept {formatCurrencyAmount(request.counterPrice || 0, 'THB')}
                          </button>
                          {Number(request.counterRound || 1) < MAX_NEGOTIATION_ROUNDS && (
                            <button
                              onClick={() => {
                                setCounterFormOpenForId(request.id);
                                setCounterPriceInput('');
                                setCounterMessageInput('');
                                setCounterIncludesInput('');
                              }}
                              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-semibold hover:bg-black transition-colors"
                            >
                              <DollarSign className="w-4 h-4" />
                              Counter Again
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'reject', request })}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                          <button
                            onClick={() => setHistoryModalRequestId(request.id)}
                            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 hover:bg-gray-50"
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
                            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View Details
                          </button>
                        </div>
                      )}
                      {request.status === 'accepted' && (
                        <button
                          onClick={() => onOpenMessages?.(request.freelancer.id)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </button>
                      )}
                      {request.status === 'rejected' && (
                        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm md:text-base font-semibold hover:bg-gray-200 transition-colors">
                          <AlertCircle className="w-4 h-4" />
                          View Reason
                        </button>
                      )}
                      <button
                        onClick={() => onViewProfile?.(request.status as 'accepted' | 'pending' | 'rejected')}
                        className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm md:text-base font-semibold transition-colors text-center"
                      >
                        View Profile
                      </button>
                    </div>

                    {request.status === 'countered' && request.counterMessage && (
                      <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">
                          {request.counterBy === 'freelancer' ? "Freelancer's counter offer: " : 'Your counter offer: '}
                        </span>
                        {formatCurrencyAmount(request.counterPrice || 0, 'THB')} — "{request.counterMessage}"
                      </div>
                    )}

                    {counterFormOpenForId === request.id && (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-3 text-sm font-semibold text-gray-900">Propose a different price</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <input
                            type="number"
                            min={0}
                            value={counterPriceInput}
                            onChange={(event) => setCounterPriceInput(event.target.value)}
                            placeholder="e.g. 6000"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
                          <input
                            value={counterMessageInput}
                            onChange={(event) => setCounterMessageInput(event.target.value)}
                            placeholder="Message (optional)"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
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
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Empty State */}
        {!isLoading && normalizedRequests.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-12 h-12 text-gray-900" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Requests Yet</h3>
            <p className="text-gray-600">Start exploring and send booking requests to freelancers!</p>
          </div>
        )}
      </div>

      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Edit Pending Request</h3>
            <div className="mt-4 space-y-4">
              <input
                value={editForm.projectName}
                onChange={(event) => setEditForm((current) => ({ ...current, projectName: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                placeholder="Project name"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  value={editForm.currency}
                  onChange={(event) => setEditForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  placeholder="Currency"
                />
                <input
                  value={editForm.budgetMin}
                  onChange={(event) => setEditForm((current) => ({ ...current, budgetMin: event.target.value }))}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  placeholder="Min budget"
                />
                <input
                  value={editForm.budgetMax}
                  onChange={(event) => setEditForm((current) => ({ ...current, budgetMax: event.target.value }))}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  placeholder="Max budget"
                />
              </div>

              <textarea
                rows={4}
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                placeholder="Description"
              />

              {editingRequest.groupMeta && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-900">Recipients</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
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
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={() => setEditingRequest(null)} className="flex-1 rounded-xl bg-gray-100 px-4 py-2 font-semibold text-gray-700">Cancel</button>
              <button onClick={() => void saveRequestEdits()} className="flex-1 rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmOfferDialog
          type={confirmAction.type}
          projectName={confirmAction.request.projectName}
          price={confirmAction.request.status === 'countered' ? Number(confirmAction.request.counterPrice || 0) : Number(confirmAction.request.budget || 0)}
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
  );
}
