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
}

export function CommentInput({
  avatarUrl,
  avatarAlt,
  value,
  onChange,
  onSubmit,
  submitting = false,
  placeholder = 'Add comment...',
}: CommentInputProps) {
  const canSubmit = !submitting && !!value.trim();

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white p-3 sm:p-4">
      <Avatar src={avatarUrl} alt={avatarAlt} sizeClassName="h-8 w-8 rounded-full" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && canSubmit) {
            onSubmit();
          }
        }}
        placeholder={placeholder}
        // 16px+ font size — anything smaller makes iOS Safari auto-zoom the
        // whole page in when this input gets focus, which is what was
        // breaking the sheet's layout and requiring a manual pinch-zoom out.
        className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-base text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-gray-300"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="shrink-0 rounded-full p-2 text-gray-400 enabled:text-gray-900 enabled:hover:bg-gray-100"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

export default CommentInput;
