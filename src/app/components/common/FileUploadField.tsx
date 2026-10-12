import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

interface FileUploadFieldProps {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  /** Precomputed by the caller (e.g. "3 files selected" or a single file's name) — null/empty shows the placeholder. */
  selectedLabel?: string | null;
  buttonLabel?: string;
  /** Tighter sizing for inline use next to another control (e.g. EvidenceItemEditor's row). */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

// Every plain `<input type="file">` in this app rendered the browser's own
// "Choose File / No file selected" control, inconsistent with every OTHER
// file input here (profile photo, chat attachments, dispute evidence, ...),
// which already hide the native input behind a styled trigger. This is
// that same pattern as a shared component, so a selected file's name is
// actually visible instead of the generic "No file selected" the raw
// control shows once something's picked.
export function FileUploadField({
  accept,
  multiple,
  onFilesSelected,
  selectedLabel,
  buttonLabel = 'Choose file',
  compact = false,
  disabled = false,
  className = '',
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          onFilesSelected(Array.from(event.target.files || []));
          // Lets picking the exact same file again re-fire onChange (e.g.
          // after removing it from the selection) — the native input
          // otherwise treats an identical selection as a no-op change.
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 font-semibold text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
        }`}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {buttonLabel}
      </button>
      <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{selectedLabel || 'No file chosen'}</span>
    </div>
  );
}
