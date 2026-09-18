import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// A selected-but-not-yet-uploaded image, shown as an actual thumbnail
// instead of its raw (usually a meaningless generated UUID) filename —
// used by every message composer that supports attachments (ticket
// conversation, dispute conversation, both client and admin sides).
export function AttachmentPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  return (
    <div className="relative inline-flex">
      <img src={previewUrl} alt="Attachment preview" className="h-16 w-16 rounded-lg border border-sky-100 object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/80 text-white hover:bg-gray-900"
        aria-label="Remove attachment"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
