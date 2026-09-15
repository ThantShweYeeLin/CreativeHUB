import { ImagePlus, X } from 'lucide-react';

export interface ImageUpload {
  file: File;
  previewUrl: string;
}

export function ProfileImageDropzone({
  label,
  helper,
  upload,
  existingImageUrl,
  isDragging,
  previewClassName,
  onDragChange,
  onChange,
  onRemove,
}: {
  label: string;
  helper: string;
  upload: ImageUpload | null;
  /** Already-saved photo (e.g. chosen at sign-up) to show until the user picks a new one. */
  existingImageUrl?: string | null;
  isDragging: boolean;
  previewClassName: string;
  onDragChange: (isDragging: boolean) => void;
  onChange: (file: File) => void;
  onRemove: () => void;
}) {
  const handleFiles = (files: FileList | null) => {
    const file = Array.from(files || []).find((item) => item.type.startsWith('image/'));
    if (file) {
      onChange(file);
    }
  };

  const previewUrl = upload?.previewUrl || existingImageUrl || null;

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          onDragChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragChange(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragChange(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging ? 'border-sky-400 bg-sky-100' : 'border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-white'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        {previewUrl ? (
          <>
            <img src={previewUrl} alt={`${label} preview`} className={previewClassName} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity hover:bg-black/40 hover:opacity-100">
              <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-900">
                {upload ? 'Change photo' : 'Click or drag to change'}
              </span>
            </div>
            {upload && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onRemove();
                }}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md transition-colors hover:bg-gradient-to-br hover:from-sky-500 hover:to-blue-600 hover:text-white"
                aria-label={`Remove ${label.toLowerCase()}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
              <ImagePlus className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-gray-900">Drag an image here or choose a photo</p>
            <p className="mt-1 text-xs text-gray-500">{helper}</p>
          </>
        )}
      </label>
    </div>
  );
}
