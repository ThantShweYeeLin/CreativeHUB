import { Check, X } from 'lucide-react';
import { formatCurrencyAmount } from '../../../lib/currency';

interface ConfirmOfferDialogProps {
  type: 'accept' | 'reject';
  freelancerName?: string;
  projectName: string;
  price: number;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmOfferDialog({
  type,
  freelancerName,
  projectName,
  price,
  isSubmitting,
  onCancel,
  onConfirm,
}: ConfirmOfferDialogProps) {
  const isAccept = type === 'accept';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isAccept ? 'bg-green-100' : 'bg-red-100'}`}>
          {isAccept ? <Check className="h-6 w-6 text-green-600" /> : <X className="h-6 w-6 text-red-600" />}
        </div>

        <h3 className="text-lg font-bold text-gray-900">
          {isAccept ? 'Accept Counter Offer?' : 'Reject this counter offer?'}
        </h3>

        {isAccept ? (
          <>
            <p className="mt-2 text-sm text-gray-600">You are agreeing to:</p>
            <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
              {freelancerName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Freelancer</span>
                  <span className="font-semibold text-gray-900">{freelancerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Service</span>
                <span className="font-semibold text-gray-900">{projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Final Agreed Price</span>
                <span className="font-semibold text-gray-900">{formatCurrencyAmount(price, 'THB')}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">By accepting, this offer will become the agreed project proposal.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-600">This will end the current negotiation for "{projectName}".</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 rounded-xl px-4 py-2.5 font-semibold text-white disabled:opacity-60 ${
              isAccept ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? 'Please wait...' : isAccept ? 'Accept & Continue' : 'Reject Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
