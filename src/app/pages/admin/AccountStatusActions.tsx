import { useState } from 'react';
import { DataService } from '../../../lib/dataService';

type AccountStatus = 'active' | 'paused' | 'suspended' | 'banned';

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
  const [reason, setReason] = useState('');

  const status = currentStatus || 'active';
  const buttonClass = size === 'md' ? 'px-3.5 py-2 text-sm' : 'px-2.5 py-1 text-xs';

  const handleConfirm = async () => {
    if (!confirming) return;
    setIsPending(true);
    setError(null);
    const response = await DataService.adminSetAccountStatus(userId, confirming, reason.trim() || undefined);
    setIsPending(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update account status.');
      return;
    }
    setConfirming(null);
    setReason('');
    await onChanged();
  };

  if (confirming) {
    const labels: Record<AccountStatus, string> = { active: 'reactivate', paused: 'pause', suspended: 'suspend', banned: 'ban' };
    return (
      <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-900">
          {labels[confirming].charAt(0).toUpperCase() + labels[confirming].slice(1)} this account?
        </p>
        {confirming !== 'active' && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="mb-2 w-full min-h-[60px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
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
