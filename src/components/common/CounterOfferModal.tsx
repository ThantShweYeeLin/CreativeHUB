import { Calendar, Clock, DollarSign, ListChecks, MessageSquare, Send, X } from 'lucide-react';
import { formatCurrencyAmount } from '../../lib/currency';

// Shared by RequestsPage.tsx (client) and FreelancerDashboard.tsx (freelancer) -
// same form, same fields, previously duplicated almost verbatim in both
// files. Pulled into one component so a design change (like this one) only
// has to happen once and the two sides can't visually drift apart.
export function CounterOfferModal({
  recipientName,
  projectName,
  currentPrice,
  currentCurrency = 'THB',
  pricePlaceholder,
  priceValue,
  onPriceChange,
  messagePlaceholder,
  messageValue,
  onMessageChange,
  dateValue,
  onDateChange,
  timeValue,
  onTimeChange,
  endTimeValue,
  onEndTimeChange,
  includesValue,
  onIncludesChange,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  recipientName: string;
  projectName: string;
  currentPrice?: number | null;
  currentCurrency?: string;
  pricePlaceholder: string;
  priceValue: string;
  onPriceChange: (value: string) => void;
  messagePlaceholder: string;
  messageValue: string;
  onMessageChange: (value: string) => void;
  dateValue: string;
  onDateChange: (value: string) => void;
  timeValue: string;
  onTimeChange: (value: string) => void;
  endTimeValue: string;
  onEndTimeChange: (value: string) => void;
  includesValue: string;
  onIncludesChange: (value: string) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const fieldClass =
    'w-full rounded-xl border border-sky-100 bg-white px-3 py-2.5 pl-9 text-sm text-gray-900 outline-none transition-shadow focus:border-sky-300 focus:ring-2 focus:ring-sky-200';

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden overflow-y-auto rounded-2xl bg-white shadow-[0_20px_60px_rgba(56,189,248,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-5">
          <button
            onClick={onCancel}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white">Make a Counter Offer</h3>
              <p className="truncate text-sm text-sky-100">
                To {recipientName} · {projectName}
              </p>
            </div>
          </div>
          {currentPrice != null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
              Current offer: {formatCurrencyAmount(currentPrice, currentCurrency)}
            </p>
          )}
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Your proposed price</label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                <input
                  type="number"
                  min={0}
                  value={priceValue}
                  onChange={(e) => onPriceChange(e.target.value)}
                  placeholder={pricePlaceholder}
                  className={fieldClass}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Leave blank to keep the current price.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Message</label>
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                <input
                  value={messageValue}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder={messagePlaceholder}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Schedule (optional — keeps the current one if left blank)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                <input type="date" value={dateValue} onChange={(e) => onDateChange(e.target.value)} className={fieldClass} />
              </div>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                <input type="time" value={timeValue} onChange={(e) => onTimeChange(e.target.value)} className={fieldClass} />
              </div>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                <input type="time" value={endTimeValue} onChange={(e) => onEndTimeChange(e.target.value)} className={fieldClass} />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Date · Start time · End time</p>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <ListChecks className="h-3.5 w-3.5 text-sky-400" /> What's included (optional, one per line)
            </label>
            <textarea
              value={includesValue}
              onChange={(e) => onIncludesChange(e.target.value)}
              rows={3}
              placeholder={'8 hours photography\nEdited photos\nOnline gallery'}
              className="w-full rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-sky-100 bg-sky-50/50 px-6 py-4">
          <button
            onClick={onCancel}
            className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-sky-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Sending...' : 'Send Counter Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
