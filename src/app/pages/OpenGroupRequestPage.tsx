import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, MapPin, Plus, X } from 'lucide-react';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { LeafletLocationPicker, type LocationPoint } from '../../components/common/LeafletLocationPicker';
import { useCurrency } from '../../contexts/CurrencyContext';
import { EVENT_MATCHER_CATEGORY_LABELS } from '../../lib/categories';
import { normalizeCurrencyCode } from '../../lib/currency';
import { DataService } from '../../lib/dataService';

interface RoleDraft {
  key: number;
  category: string;
  budget: string;
  slots: string;
}

// Posts an OPEN Group Request: describe the roles you need and Premium
// freelancers who fit (category, area, availability) are notified and can
// apply. Applications arrive in My Requests like any freelancer offer -
// nothing is booked until you accept one.
export function OpenGroupRequestPage() {
  const navigate = useNavigate();
  const { currency: preferredCurrency } = useCurrency();
  const currency = normalizeCurrencyCode(preferredCurrency);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [roles, setRoles] = useState<RoleDraft[]>([{ key: 1, category: EVENT_MATCHER_CATEGORY_LABELS[0], budget: '', slots: '1' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const updateRole = (key: number, patch: Partial<RoleDraft>) =>
    setRoles((current) => current.map((role) => (role.key === key ? { ...role, ...patch } : role)));

  const handleSubmit = async () => {
    setError(null);
    if (title.trim().length < 3) return setError('Give your request a short title.');
    if (!eventDate || eventDate < today) return setError('Pick an event date that is today or later.');
    if (!location) return setError('Choose where the event is happening.');
    if (roles.some((role) => !(Number(role.budget) > 0))) return setError('Set a budget for every role.');

    setIsSubmitting(true);
    const { error: createError } = await DataService.createGroupOpportunity({
      title: title.trim(),
      description: description.trim(),
      eventDate,
      startTime,
      endTime,
      locationCity: location.city || location.district || null,
      locationText: location.formattedAddress,
      latitude: location.latitude,
      longitude: location.longitude,
      roles: roles.map((role) => ({
        category: role.category,
        budget: Number(role.budget),
        currency,
        slots: Math.max(1, Math.min(20, Number(role.slots) || 1)),
      })),
    });
    setIsSubmitting(false);

    if (createError) {
      setError(createError.message || 'Unable to post your request.');
      return;
    }
    navigate('/requests');
  };

  return (
    <div className="relative min-h-screen pb-20">
      <PageBackdrop />
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-6">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 font-semibold text-gray-900 hover:text-black">
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Post an open Group Request</h1>
        <p className="mb-6 text-sm text-gray-600">
          Describe the team you need. Premium freelancers who match your roles, area and date are notified and can apply — you review every application in My Requests before anything is booked.
        </p>

        <div className="space-y-5 rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Sarah & Tom's wedding" className="w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Details (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Theme, guest count, anything freelancers should know" className="min-h-[80px] w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Event date</label>
              <input type="date" min={today} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Start (optional)</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">End (optional)</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Location</label>
            <button type="button" onClick={() => setIsPickingLocation(true)} className="flex w-full items-center gap-2 rounded-lg border border-sky-100 px-3 py-2 text-left text-sm hover:bg-sky-50">
              <MapPin className="h-4 w-4 text-sky-600" />
              {location ? location.formattedAddress : 'Choose on the map'}
            </button>
            <p className="mt-1 text-xs text-gray-500">Freelancers only see the city/area until a booking is confirmed.</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600">Roles you need ({currency})</p>
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50/50 p-2">
                  <select value={role.category} onChange={(e) => updateRole(role.key, { category: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-sky-100 bg-white px-2 py-2 text-sm">
                    {EVENT_MATCHER_CATEGORY_LABELS.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                  <input type="number" min="1" value={role.budget} onChange={(e) => updateRole(role.key, { budget: e.target.value })} placeholder="Budget" className="w-28 rounded-lg border border-sky-100 bg-white px-2 py-2 text-sm" />
                  <input type="number" min="1" max="20" value={role.slots} onChange={(e) => updateRole(role.key, { slots: e.target.value })} title="How many freelancers for this role" className="w-16 rounded-lg border border-sky-100 bg-white px-2 py-2 text-sm" />
                  {roles.length > 1 && (
                    <button type="button" onClick={() => setRoles((current) => current.filter((item) => item.key !== role.key))} className="text-gray-400 hover:text-gray-900" aria-label="Remove role">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {roles.length < 10 && (
              <button type="button" onClick={() => setRoles((current) => [...current, { key: Date.now(), category: EVENT_MATCHER_CATEGORY_LABELS[0], budget: '', slots: '1' }])} className="mt-2 flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700">
                <Plus className="h-4 w-4" /> Add another role
              </button>
            )}
            <p className="mt-1 text-xs text-gray-500">Budget is per freelancer. The last box is how many freelancers you need for that role.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60">
            {isSubmitting ? 'Posting…' : 'Post request'}
          </button>
        </div>
      </div>
      {isPickingLocation && (
        <LeafletLocationPicker initialPoint={location} onCancel={() => setIsPickingLocation(false)} onConfirm={(point) => { setLocation(point); setIsPickingLocation(false); }} />
      )}
    </div>
  );
}
