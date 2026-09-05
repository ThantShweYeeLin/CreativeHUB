import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface PostCardProps {
  authorName: string;
  authorAvatarUrl: string;
  authorSubtitle?: string;
  onViewAuthor?: () => void;
  createdAtLabel?: string;

  /** Chips/tags rendered between the author row and the media (location, category, labels...). */
  badges?: React.ReactNode;

  imageUrl?: string | null;
  isVideo?: boolean;
  onOpenPost: () => void;

  caption?: string;
  /** Extra content rendered after the caption (hashtags, poll, attachments...). */
  afterCaption?: React.ReactNode;

  likesCount: number;
  liked: boolean;
  onToggleLike: () => void;
  onShowLikes?: () => void;

  commentsCount: number;
  onOpenComment: () => void;

  onShare?: () => void;

  saved?: boolean;
  onToggleSave?: () => void;
}

export function PostCard({
  authorName,
  authorAvatarUrl,
  authorSubtitle,
  onViewAuthor,
  createdAtLabel,
  badges,
  imageUrl,
  isVideo,
  onOpenPost,
  caption,
  afterCaption,
  likesCount,
  liked,
  onToggleLike,
  onShowLikes,
  commentsCount,
  onOpenComment,
  onShare,
  saved,
  onToggleSave,
}: PostCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg md:rounded-3xl">
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <button
          type="button"
          onClick={onViewAuthor}
          disabled={!onViewAuthor}
          className="flex min-w-0 items-center gap-3 text-left transition-opacity enabled:hover:opacity-80"
        >
          <Avatar src={authorAvatarUrl} alt={authorName} sizeClassName="h-12 w-12 flex-shrink-0 shadow-md ring-2 ring-white rounded-full" />
          <div className="min-w-0">
            <h3 className="truncate font-bold text-gray-900">{authorName}</h3>
            {authorSubtitle && <p className="truncate text-sm text-gray-600">{authorSubtitle}</p>}
          </div>
        </button>
        {createdAtLabel && <span className="ml-3 flex-shrink-0 text-sm text-gray-500">{createdAtLabel}</span>}
      </div>

      {badges && <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-6">{badges}</div>}

      {imageUrl && (
        <div onClick={onOpenPost} className="relative block aspect-square w-full cursor-pointer bg-gray-100 text-left">
          {isVideo ? (
            <video src={imageUrl} className="h-full w-full object-cover" controls onClick={(event) => event.stopPropagation()} />
          ) : (
            <ImageWithFallback src={imageUrl} alt={caption || 'Post image'} className="h-full w-full object-cover" />
          )}
        </div>
      )}

      <div className="px-4 py-3 md:px-6 md:py-4">
        {caption && <p className="whitespace-pre-line text-gray-900">{caption}</p>}
        {afterCaption && <div className="mt-3 space-y-3">{afterCaption}</div>}

        <div className={`flex items-center justify-between ${caption || afterCaption ? 'mt-3' : ''}`}>
          <div className="flex items-center gap-4">
            <div
              className={`group flex items-center gap-2 rounded-full bg-gray-50 px-3 py-2 transition-all hover:bg-gray-100 ${onShowLikes ? 'cursor-pointer' : ''}`}
              onClick={onShowLikes}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleLike();
                }}
              >
                <Heart className={`h-7 w-7 transition-all ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-700 group-hover:scale-110'}`} />
              </button>
              <span className="font-semibold text-gray-900">{likesCount}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Like</span>
            </div>
            <button
              type="button"
              onClick={onOpenComment}
              className="group flex items-center gap-2 rounded-full bg-gray-50 px-3 py-2 transition-all hover:bg-gray-100"
            >
              <MessageCircle className="h-7 w-7 text-gray-700 transition-transform group-hover:scale-110" />
              <span className="font-semibold text-gray-900">{commentsCount}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Comment</span>
            </button>
            {onShare && (
              <button type="button" onClick={onShare} className="group flex items-center gap-2 rounded-full bg-gray-50 px-3 py-2 transition-all hover:bg-gray-100">
                <Share2 className="h-6 w-6 text-gray-700 transition-transform group-hover:scale-110" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Share</span>
              </button>
            )}
          </div>
          {onToggleSave && (
            <button type="button" onClick={onToggleSave} className="transition-all">
              <Bookmark className={`h-6 w-6 transition-all ${saved ? 'fill-gray-900 text-gray-900 scale-110' : 'text-gray-700 hover:scale-110'}`} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default PostCard;
