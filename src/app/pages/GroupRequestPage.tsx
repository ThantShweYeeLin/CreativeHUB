import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, Search, Users, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { DataService } from '../../lib/dataService';
import { convertAmount, formatCurrencyAmount, normalizeCurrencyCode } from '../../lib/currency';
import { appendBudgetMeta, inferCurrencyFromLocation, SUPPORTED_CURRENCIES, type BudgetMeta } from '../../lib/requestBudget';
import { appendScheduleMeta, generateTimeSlots, formatTimeLabel } from '../../lib/requestSchedule';
import { appendLocationMeta } from '../../lib/requestLocation';

interface GroupRequestPageProps {
  onBack: () => void;
}

interface FreelancerOption {
  userId: string;
  fullName: string;
  title: string;
  skills: string[];
  hourlyRate: number | null;
  rateCurrency: string;
  avatarUrl: string | null;
  gender: any;
}

interface PerFreelancerForm {
  purpose: string;
  customPurpose: string;
  budget: string;
}

const OTHER_PURPOSE_VALUE = '__other__';

export function GroupRequestPage({ onBack }: GroupRequestPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency: preferredCurrency } = useCurrency();

  const [allFreelancers, setAllFreelancers] = useState<FreelancerOption[]>([]);
  const [isLoadingFreelancers, setIsLoadingFreelancers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perFreelancerForm, setPerFreelancerForm] = useState<Record<string, PerFreelancerForm>>({});

  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [currency, setCurrency] = useState(normalizeCurrencyCode(preferredCurrency, 'THB'));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFreelancers() {
      const response = await DataService.getAllFreelancers(100);
      if (!isMounted) return;

      const options: FreelancerOption[] = (response.data || [])
        .map((item: any) => ({
          userId: String(item.user_id || item.users?.id || ''),
          fullName: item.users?.full_name || item.title || 'Freelancer',
          title: item.title || 'Creative Freelancer',
          skills: Array.isArray(item.skills) ? item.skills : [],
          hourlyRate: item.hourly_rate ? Number(item.hourly_rate) : null,
          rateCurrency: normalizeCurrencyCode(item.users?.preferred_currency, 'THB'),
          avatarUrl: item.users?.avatar_url || null,
          gender: item.users?.gender || null,
        }))
        .filter((item: FreelancerOption) => item.userId && item.userId !== user?.id);

      setAllFreelancers(options);
      setIsLoadingFreelancers(false);
    }

    loadFreelancers();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadClientCurrency() {
      if (!user?.id) return;
      const response = await DataService.getUser(user.id);
      if (!isMounted) return;

      const profileCurrency = normalizeCurrencyCode((response.data as any)?.preferred_currency, '');
      const inferredCurrency = inferCurrencyFromLocation(response.data?.location || null);
      setCurrency(profileCurrency || inferredCurrency);
    }

    loadClientCurrency();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const selectedFreelancers = useMemo(
    () => selectedIds.map((freelancerId) => allFreelancers.find((item) => item.userId === freelancerId)).filter((item): item is FreelancerOption => Boolean(item)),
    [selectedIds, allFreelancers]
  );

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allFreelancers
      .filter((item) => !selectedIds.includes(item.userId))
      .filter((item) => !query || item.fullName.toLowerCase().includes(query) || item.title.toLowerCase().includes(query))
      .slice(0, 30);
  }, [allFreelancers, selectedIds, searchQuery]);

  const timeSlots = useMemo(() => generateTimeSlots('06:00', '22:00'), []);
  const todayDateString = new Date().toISOString().slice(0, 10);

  const minimumFor = (freelancer: FreelancerOption) =>
    freelancer.hourlyRate ? convertAmount(freelancer.hourlyRate, freelancer.rateCurrency, currency) : 0;

  const addFreelancer = (freelancerId: string) => {
    setSelectedIds((current) => (current.includes(freelancerId) ? current : [...current, freelancerId]));
    setPerFreelancerForm((current) => (current[freelancerId] ? current : { ...current, [freelancerId]: { purpose: '', customPurpose: '', budget: '' } }));
    setSearchQuery('');
  };

  const removeFreelancer = (freelancerId: string) => {
    setSelectedIds((current) => current.filter((item) => item !== freelancerId));
    setPerFreelancerForm((current) => {
      const next = { ...current };
      delete next[freelancerId];
      return next;
    });
  };

  const updatePerFreelancer = (freelancerId: string, patch: Partial<PerFreelancerForm>) => {
    setPerFreelancerForm((current) => ({
      ...current,
      [freelancerId]: { ...(current[freelancerId] || { purpose: '', customPurpose: '', budget: '' }), ...patch },
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!user?.id) {
      setError('You must be signed in to send a group request.');
      return;
    }
    if (!projectName.trim()) {
      setError('Enter a project name.');
      return;
    }
    if (selectedFreelancers.length === 0) {
      setError('Select at least one freelancer.');
      return;
    }
    if (!location.trim()) {
      setError('Enter a location for this booking.');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      setError('Choose a date and time for this booking.');
      return;
    }

    const perRecipient: Record<string, { projectName: string; budget: number; description: string }> = {};

    for (const freelancer of selectedFreelancers) {
      const form = perFreelancerForm[freelancer.userId] || { purpose: '', customPurpose: '', budget: '' };
      const resolvedPurpose = form.purpose === OTHER_PURPOSE_VALUE ? form.customPurpose.trim() : form.purpose;

      if (!resolvedPurpose) {
        setError(`Choose a purpose for ${freelancer.fullName}.`);
        return;
      }

      const budgetAmount = Number(form.budget);
      if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
        setError(`Enter a budget for ${freelancer.fullName}.`);
        return;
      }

      const minimum = minimumFor(freelancer);
      if (budgetAmount < minimum) {
        setError(`Your offer to ${freelancer.fullName} must be at least ${formatCurrencyAmount(minimum, currency)}.`);
        return;
      }

      const budgetMeta: BudgetMeta = { currency, min: minimum, max: budgetAmount };
      const description = appendLocationMeta(
        appendScheduleMeta(appendBudgetMeta(notes, budgetMeta), { date: scheduleDate, time: scheduleTime }),
        location.trim()
      );

      // Each freelancer's own purpose stays visible alongside the overall
      // project name, since requests.project_name is a single text column —
      // e.g. "Jane's Wedding — Bridal Makeup" for the makeup artist,
      // "Jane's Wedding — Wedding Photography" for the photographer.
      perRecipient[freelancer.userId] = { projectName: `${projectName.trim()} — ${resolvedPurpose}`, budget: budgetAmount, description };
    }

    setIsSubmitting(true);

    const firstOverride = perRecipient[selectedFreelancers[0].userId];
    const { error: requestError } = await DataService.createBookingRequests({
      clientId: user.id,
      recipientIds: selectedFreelancers.map((item) => item.userId),
      projectName: firstOverride.projectName,
      budget: firstOverride.budget,
      description: firstOverride.description,
      perRecipient,
    });

    setIsSubmitting(false);

    if (requestError) {
      setError((requestError as any).message || 'Unable to send group request.');
      return;
    }

    navigate('/requests');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <button onClick={onBack} className="mb-3 flex items-center gap-2 font-semibold text-gray-900 transition-colors hover:text-black">
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gray-900 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Group Request</h1>
              <p className="text-sm text-gray-600">Book multiple freelancers at once, each with their own purpose and budget.</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div>
          <label htmlFor="projectName" className="mb-2 block text-sm font-semibold text-gray-900">Project Name</label>
          <input
            id="projectName"
            required
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="e.g. Jane's Wedding, Company Photoshoot 2026"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">Search freelancers</label>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search freelancer by name or specialty..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
            {isLoadingFreelancers && <p className="rounded-lg bg-white px-3 py-3 text-sm text-gray-500">Loading freelancers...</p>}
            {!isLoadingFreelancers && searchResults.length === 0 && (
              <p className="rounded-lg bg-white px-3 py-3 text-sm text-gray-500">No freelancers match that search.</p>
            )}
            {searchResults.map((freelancer) => (
              <button
                type="button"
                key={freelancer.userId}
                onClick={() => addFreelancer(freelancer.userId)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={freelancer.avatarUrl || ''} alt={freelancer.fullName} gender={freelancer.gender} sizeClassName="h-9 w-9" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{freelancer.fullName}</p>
                    <p className="text-xs text-gray-500">{freelancer.title}</p>
                  </div>
                </div>
                <span className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white">Add</span>
              </button>
            ))}
          </div>
        </div>

        {selectedFreelancers.length > 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900">
              Selected freelancers <span className="font-normal text-gray-500">({selectedFreelancers.length})</span>
            </label>
            {selectedFreelancers.map((freelancer) => {
              const form = perFreelancerForm[freelancer.userId] || { purpose: '', customPurpose: '', budget: '' };
              const minimum = minimumFor(freelancer);
              return (
                <div key={freelancer.userId} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={freelancer.avatarUrl || ''} alt={freelancer.fullName} gender={freelancer.gender} sizeClassName="h-12 w-12" />
                      <div>
                        <h3 className="font-bold text-gray-900">{freelancer.fullName}</h3>
                        <p className="text-sm text-gray-600">{freelancer.title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFreelancer(freelancer.userId)}
                      className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label={`Remove ${freelancer.fullName}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-700">Purpose</label>
                      <select
                        required
                        value={form.purpose}
                        onChange={(event) => updatePerFreelancer(freelancer.userId, { purpose: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        <option value="" disabled>Select a purpose</option>
                        {freelancer.skills.map((skill) => (
                          <option key={skill} value={skill}>{skill}</option>
                        ))}
                        <option value={OTHER_PURPOSE_VALUE}>Other (please specify)</option>
                      </select>
                      {form.purpose === OTHER_PURPOSE_VALUE && (
                        <input
                          required
                          value={form.customPurpose}
                          onChange={(event) => updatePerFreelancer(freelancer.userId, { customPurpose: event.target.value })}
                          placeholder="Type the purpose"
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                        Budget <span className="font-normal text-gray-500">(min. {formatCurrencyAmount(minimum, currency)})</span>
                      </label>
                      <input
                        required
                        inputMode="decimal"
                        value={form.budget}
                        onChange={(event) => updatePerFreelancer(freelancer.userId, { budget: event.target.value })}
                        placeholder={`Minimum ${formatCurrencyAmount(minimum, currency)}`}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                      {form.budget && Number(form.budget) < minimum && (
                        <p className="mt-1.5 text-xs font-semibold text-red-600">
                          Must be at least {formatCurrencyAmount(minimum, currency)}.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
          <p className="text-sm font-semibold text-gray-900">Shared for the whole group</p>

          <div>
            <label htmlFor="location" className="mb-2 block text-sm font-semibold text-gray-900">Location</label>
            <input
              id="location"
              required
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Where should everyone meet?"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-gray-900">Notes <span className="font-normal text-gray-500">(optional)</span></label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the whole group should know?"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Schedule</label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="date"
                required
                min={todayDateString}
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <select
                required
                value={scheduleTime}
                onChange={(event) => setScheduleTime(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="" disabled>Select a time</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Currency</label>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {SUPPORTED_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedFreelancers.length === 0}
          className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3.5 font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60"
        >
          {isSubmitting ? 'Sending...' : selectedFreelancers.length > 0 ? `Send Request to ${selectedFreelancers.length} Freelancer${selectedFreelancers.length === 1 ? '' : 's'}` : 'Select freelancers to continue'}
        </button>
      </form>
    </div>
  );
}
