import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MessageCircle, Edit, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { appendBudgetMeta, extractBudgetMeta, formatBudgetRange, stripBudgetMeta } from '../../lib/requestBudget';

interface RequestsPageProps {
  onBack: () => void;
  onViewProfile?: (status: 'accepted' | 'pending' | 'rejected') => void;
  onOpenMessages?: () => void;
}

const getStatusColor = (status: 'pending' | 'accepted' | 'rejected') => {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'accepted':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200';
  }
};

const getStatusText = (status: 'pending' | 'accepted' | 'rejected') => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function RequestsPage({ onBack, onViewProfile, onOpenMessages }: RequestsPageProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [availableFreelancers, setAvailableFreelancers] = useState<Array<{ id: string; full_name: string; title: string }>>([]);
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

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const normalizedRequests = useMemo(
    () =>
      requests.map((request) => ({
        budgetMeta: extractBudgetMeta(request.message, request.description) || {
          currency: 'THB',
          min: Number(request.budget || 0),
          max: Number(request.budget || 0),
        },
        id: request.id,
        groupMeta: request.group_meta || null,
        acceptanceProgress: request.acceptance_progress || '0 out of 1 accepted',
        isGroupRequest: Boolean(request.is_group_request),
        freelancer: {
          name: request.freelancer?.full_name || 'Freelancer',
          specialty: request.freelancer?.title || 'Creative Freelancer',
          avatar: request.freelancer?.avatar_url || DEFAULT_AVATAR_URL,
        },
        projectName: request.project_name,
        budget: Number(request.budget || 0),
        status: request.status as 'pending' | 'accepted' | 'rejected',
        date: request.created_at,
        message: stripBudgetMeta(request.plain_message || request.message || request.description || ''),
      })),
    [requests]
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
                  <div className="flex-shrink-0 self-center md:self-auto">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden ring-2 ring-white shadow-md">
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
                          <span className="font-semibold">{request.freelancer.name}</span>
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
                      <div>
                        <span className="font-semibold text-gray-900">Sent:</span> {new Date(request.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      {request.isGroupRequest && (
                        <div>
                          <span className="font-semibold text-gray-900">Status:</span> {request.acceptanceProgress}
                        </div>
                      )}
                    </div>

                    {/* Response Message */}
                    {request.message && (
                      <div className={`p-3 md:p-4 rounded-xl mb-4 ${
                        request.status === 'accepted'
                          ? 'bg-green-50 border-2 border-green-100'
                          : request.status === 'rejected'
                          ? 'bg-red-50 border-2 border-red-100'
                          : 'bg-gray-50 border-2 border-gray-100'
                      }`}>
                        <p className="text-xs md:text-sm text-gray-700 italic">"{request.message}"</p>
                      </div>
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
                      {request.status === 'accepted' && (
                        <button
                          onClick={onOpenMessages}
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
                        onClick={() => onViewProfile?.(request.status)}
                        className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm md:text-base font-semibold transition-colors text-center"
                      >
                        View Profile
                      </button>
                    </div>
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
    </div>
  );
}
