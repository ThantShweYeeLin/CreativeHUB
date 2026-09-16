import { X } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export interface LikedUser {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  gender?: string | null;
}

interface LikesListModalProps {
  /** The post's real like count (from the posts row) — always shown in the header, independent of how many rows are actually loaded below. */
  totalCount: number;
  users: LikedUser[];
  isLoading?: boolean;
  fallbackAvatarUrl: string;
  onClose: () => void;
  onViewUser?: (userId: string) => void;
}

// A bounded, scrollable overlay for "who liked this" — unlike a flex-wrap
// list of pill buttons (which balloons the page for a popular post with
// hundreds or thousands of likes), this stays a fixed-height dialog no
// matter how many likers there are, and the header count always reflects
// the post's real total even when only a capped page of rows is loaded.
export function LikesListModal({ totalCount, users, isLoading, fallbackAvatarUrl, onClose, onViewUser }: LikesListModalProps) {
  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-sky-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'Like' : 'Likes'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-sky-50 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">Loading likes...</p>
          ) : users.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">No visible liker accounts for this post yet.</p>
          ) : (
            <>
              {users.map((likedUser) => (
                <button
                  key={likedUser.id}
                  type="button"
                  onClick={() => onViewUser?.(likedUser.id)}
                  disabled={!onViewUser}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors enabled:hover:bg-sky-50"
                >
                  <Avatar
                    src={likedUser.avatar_url || fallbackAvatarUrl}
                    alt={likedUser.full_name || likedUser.email || 'User'}
                    sizeClassName="h-10 w-10 flex-shrink-0 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{likedUser.full_name || likedUser.email || 'Unknown'}</p>
                    <p className="truncate text-xs text-gray-500">@{String(likedUser.email || '').split('@')[0]}</p>
                  </div>
                </button>
              ))}
              {users.length < totalCount && (
                <p className="px-3 py-3 text-center text-xs text-gray-400">
                  Showing {users.length.toLocaleString()} of {totalCount.toLocaleString()}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
