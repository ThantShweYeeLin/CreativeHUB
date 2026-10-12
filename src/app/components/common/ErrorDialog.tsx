import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';

interface ErrorDialogProps {
  message: string;
  onClose: () => void;
  title?: string;
}

// A blocking "must click OK" modal for errors a client can easily miss as a
// small inline banner above a long form (a request/booking submission
// failing because the slot/day was just taken by someone else, an overlap,
// a blocked date, ...) - createPortal + a z-index above every other modal
// in the app (the booking form itself is z-[1400], the app guide is 1600)
// so this always renders on top regardless of what else is open underneath.
export function ErrorDialog({ message, onClose, title = 'Something went wrong' }: ErrorDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <h3 id="error-dialog-title" className="text-lg font-bold text-gray-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
        >
          OK
        </button>
      </div>
    </div>,
    document.body
  );
}
