import { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../common/Avatar';

interface CommentInputProps {
  avatarUrl: string;
  avatarAlt: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  placeholder?: string;
  /** Bump this number to force-focus the input, even if it's already mounted/open. */
  focusToken?: number;
}

export function CommentInput({
  avatarUrl,
  avatarAlt,
  value,
  onChange,
  onSubmit,
  submitting = false,
  placeholder = 'Add comment...',
  focusToken,
}: CommentInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusToken) {
      inputRef.current?.focus();
    }
  }, [focusToken]);

  const canSubmit = !submitting && !!value.trim();

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-gray-800 bg-neutral-900 p-3 sm:p-4">
      <Avatar src={avatarUrl} alt={avatarAlt} sizeClassName="h-8 w-8 rounded-full" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && canSubmit) {
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="flex-1 rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-gray-600"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="shrink-0 rounded-full p-2 text-gray-500 enabled:text-white enabled:hover:bg-white/10"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

export default CommentInput;
