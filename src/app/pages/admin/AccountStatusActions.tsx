import { useState } from 'react';
import { DataService } from '../../../lib/dataService';

type AccountStatus = 'active' | 'paused' | 'suspended' | 'banned';

const SUSPENSION_REASONS = [
  'Suspicious activity',
  'Repeated cancellations',
  'Harassment or inappropriate conduct',
  'Suspected fraud',
  'Policy violation under review',
  'Other',
];

const SUSPENSION_DURATIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
  { label: 'Until manually reviewed (indefinite)', hours: null },
];

export function AccountStatusActions({
  userId,
  currentStatus,
  role,
  onChanged,
  size = 'sm',
}: {
  userId: string;
  currentStatus: AccountStatus | string | null | undefined;
  role: string;
  onChanged: () => void | Promise<void>;
  size?: 'sm' | 'md';
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AccountStatus | null>(null);
  const [presetReason, setPresetReason] = useState(SUSPENSION_REASONS[0]);
  const [reason, setReason] = useState('');
  const [selectedDurationHours, setSelectedDurationHours] = useState<number | null>(168); // default 7 days

  const status = currentStatus || 'active';
  const buttonClass = size === 'md' ? 'px-3.5 py-2 text-sm' : 'px-2.5 py-1 text-xs';

  const handleConfirm = async () => {
    if (!confirming) return;
    setIsPending(true);
    setError(null);

    let finalReason: string | undefined = undefined;
    let expiresAt: string | null = null;

    if (confirming === 'suspended') {
      const parts = [presetReason !== 'Other' ? presetReason : null, reason.trim() || null].filter(Boolean);
      finalReason = parts.join(' — ') || 'Temporary account suspension under review';

      if (selectedDurationHours !== null) {
        expiresAt = new Date(Date.now() + selectedDurationHours * 60 * 60 * 1000).toISOString();
      }
    } else {
      finalReason = reason.trim() || undefined;
    }

    const response = await DataService.adminSetAccountStatus(userId, confirming, finalReason, expiresAt);
    if (response.error) {
      setIsPending(false);
      setError((response.error as any).message || 'Unable to update account status.');
      return;
    }

    // Only the banned <-> not-banned edge actually needs the Auth-layer
    // call (see DataService.setAuthBanStatus) - pausing/suspending/
    // reactivating from those never touches it. Account status itself is
    // already saved at this point either way, so a failure here is
    // reported but doesn't roll back or re-block the confirmed change.
    if (confirming === 'banned' || status === 'banned') {
      const authResponse = await DataService.setAuthBanStatus(userId, confirming === 'banned');
      if (authResponse.error) {
        setIsPending(false);
        setError((authResponse.error as any).message || 'Account status saved, but updating sign-in access failed.');
        return;
      }
    }

    setIsPending(false);
    setConfirming(null);
    setReason('');
    await onChanged();
  };

  if (confirming) {
    const labels: Record<AccountStatus, string> = { active: 'reactivate', paused: 'pause', suspended: 'suspend', banned: 'ban' };
    return (
      <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 text-sm">
        <p className="mb-2 font-bold text-gray-900">
          {labels[confirming].charAt(0).toUpperCase() + labels[confirming].slice(1)} this account?
        </p>

        {confirming === 'suspended' && (
          <div className="mb-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Reason category</label>
              <select
                value={presetReason}
                onChange={(e) => setPresetReason(e.target.value)}
                className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-400"
              >
                {SUSPENSION_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Duration</label>
              <select
                value={selectedDurationHours === null ? 'indefinite' : String(selectedDurationHours)}
                onChange={(e) => setSelectedDurationHours(e.target.value === 'indefinite' ? null : Number(e.target.value))}
                className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-400"
              >
                {SUSPENSION_DURATIONS.map((d) => (
                  <option key={d.label} value={d.hours === null ? 'indefinite' : String(d.hours)}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Additional notes / User explanation</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the specific issue or steps for review..."
                className="w-full min-h-[55px] rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 border border-amber-200">
              <p className="font-semibold">Policy enforcement:</p>
              <p>• Blocks new bookings, messages, and job applications while suspended.</p>
              <p>• Existing bookings and deposits are preserved without automatic cancellation.</p>
              <p>• The user will be notified in-app with the reason and duration.</p>
            </div>
          </div>
        )}

        {confirming === 'active' && (
          <div className="mb-3">
            <p className="mb-2 text-xs text-gray-600">
              Reactivating will immediately lift all account restrictions and allow the user to access the marketplace.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for lifting restriction (optional)"
              className="w-full min-h-[50px] rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        )}

        {(confirming === 'banned' || confirming === 'paused') && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="mb-2 w-full min-h-[60px] rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-400"
          />
        )}

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={isPending}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:shadow-lg disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Confirm'}
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              setConfirming(null);
              setReason('');
              setError(null);
            }}
            className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== 'active' && (
        <button
          onClick={() => setConfirming('active')}
          className={`rounded-lg border border-sky-200 font-semibold text-gray-700 hover:bg-sky-50 ${buttonClass}`}
        >
          Reactivate
        </button>
      )}
      {status !== 'suspended' && role !== 'admin' && (
        <button
          onClick={() => setConfirming('suspended')}
          className={`rounded-lg border border-amber-300 font-semibold text-amber-700 hover:bg-amber-50 ${buttonClass}`}
        >
          Suspend
        </button>
      )}
      {status !== 'banned' && role !== 'admin' && (
        <button
          onClick={() => setConfirming('banned')}
          className={`rounded-lg border border-red-300 font-semibold text-red-700 hover:bg-red-50 ${buttonClass}`}
        >
          Ban
        </button>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
