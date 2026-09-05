import { useEffect } from 'react';
import { Bookmark, Heart, MessageCircle, Share2, Trash2, X } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { CommentInput } from './CommentInput';
import { CommentsList, type CommentItem } from './CommentsList';

export interface LikedUser {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface PostDetailModalProps {
  onClose: () => void;

  /** false = the old comments-only sheet (no photo/caption/like row) — just a "N comments" bar + comments + input. Defaults to true (full post detail, which never shows comments inline — see onOpenComments). */
  showPostContent?: boolean;
  /** Only used when showPostContent is true: clicking the Comment count switches this same modal into the comments-only overlay for this post. */
  onOpenComments?: () => void;

  authorName: string;
  authorAvatarUrl: string;
  authorSubtitle?: string;
  onViewAuthor?: () => void;
  createdAtLabel?: string;

  caption?: string;
  imageUrl?: string | null;
  isVideo?: boolean;
  onOpenPhoto?: () => void;
  /** Extra content rendered after the caption (hashtags, poll, attachments...). */
  afterCaption?: React.ReactNode;

  likesCount: number;
  liked: boolean;
  onToggleLike: () => void;

  commentsCount?: number;

  saved?: boolean;
  onToggleSave?: () => void;

  onShare?: () => void;

  likedUsers?: LikedUser[];
  loadingLikedUsers?: boolean;
  showLikedUsers?: boolean;
  onToggleShowLikedUsers?: () => void;
  onViewLikedUser?: (userId: string) => void;

  canDelete?: boolean;
  onDelete?: () => void;

  // Comments
  comments: CommentItem[];
  loadingComments: boolean;
  canComment: boolean;
  fallbackAvatarUrl: string;
  renderCommentContent?: (content: string) => React.ReactNode;
  threadedComments?: boolean;
  postId?: string;
  repliesByParent?: Record<string, CommentItem[]>;
  expandedReplyThreadsByKey?: Record<string, boolean>;
  onToggleReplyThread?: (threadKey: string) => void;
  replyTarget?: string | null;
  onReply?: (rootComment: CommentItem, mentionAuthor?: CommentItem) => void;
  replyDraft?: (threadKey: string) => string;
  onReplyDraftChange?: (threadKey: string, value: string) => void;
  onSubmitReply?: (comment: CommentItem) => void;
  isSubmittingReply?: (threadKey: string) => boolean;
  getReplyKey?: (postId: string, commentId: string) => string;

  // Comment input
  currentUserAvatarUrl: string;
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  onSubmitComment: () => void;
  isSubmittingComment: boolean;
  /** Bump this to focus the comment input as soon as the modal opens (Comment button, not a general open). */
  commentFocusToken?: number;
}

export function PostDetailModal({
  onClose,
  showPostContent = true,
  onOpenComments,
  authorName,
  authorAvatarUrl,
  authorSubtitle,
  onViewAuthor,
  createdAtLabel,
  caption,
  imageUrl,
  isVideo,
  onOpenPhoto,
  afterCaption,
  likesCount,
  liked,
  onToggleLike,
  commentsCount,
  saved,
  onToggleSave,
  onShare,
  likedUsers = [],
  loadingLikedUsers,
  showLikedUsers,
  onToggleShowLikedUsers,
  onViewLikedUser,
  canDelete,
  onDelete,
  comments,
  loadingComments,
  canComment,
  fallbackAvatarUrl,
  renderCommentContent,
  threadedComments,
  postId,
  repliesByParent,
  expandedReplyThreadsByKey,
  onToggleReplyThread,
  replyTarget,
  onReply,
  replyDraft,
  onReplyDraftChange,
  onSubmitReply,
  isSubmittingReply,
  getReplyKey,
  currentUserAvatarUrl,
  commentDraft,
  onCommentDraftChange,
  onSubmitComment,
  isSubmittingComment,
  commentFocusToken,
}: PostDetailModalProps) {
  useEffect(() => {
    // `overflow: hidden` alone doesn't stop touch-scrolling on iOS Safari —
    // pinning the body in place with position: fixed is what actually works
    // there, so the feed can't be scrolled behind the sheet.
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      // Above the global mobile bottom nav (z-[1200], see MobileBottomNav) —
      // otherwise its opaque bar sits on top of the sheet's bottom edge,
      // hiding the comment input behind it on phones.
      className={`fixed inset-0 z-[1300] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center ${showPostContent ? 'sm:p-6' : 'sm:p-4'}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl sm:h-auto sm:rounded-3xl ${
          showPostContent ? 'sm:max-h-[90vh] sm:w-[75vw] sm:max-w-[1100px]' : 'sm:max-h-[85vh] sm:w-full sm:max-w-lg'
        }`}
      >
        {showPostContent ? (
          <>
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={onViewAuthor}
                disabled={!onViewAuthor}
                className="flex items-center gap-3 text-left transition-opacity enabled:hover:opacity-80"
              >
                <Avatar src={authorAvatarUrl} alt={authorName} sizeClassName="h-10 w-10 ring-2 ring-gray-200 rounded-full" />
                <div>
                  <p className="font-semibold text-gray-900">{authorName}</p>
                  {authorSubtitle && <p className="text-xs text-gray-500">{authorSubtitle}</p>}
                  {createdAtLabel && <p className="text-xs text-gray-500">{createdAtLabel}</p>}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {canDelete && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    title="Delete post"
                    className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {imageUrl && (
              // No forced width here — the image renders at its own natural
              // size (capped by max-height/max-width), so a portrait photo
              // stays narrow instead of being stretched to the full card
              // width, and the visible boundary matches the photo itself.
              <div className="mt-3 inline-flex max-h-[40vh] max-w-full shrink-0 items-center justify-center self-center bg-gray-100 sm:max-h-[58vh]">
                {isVideo ? (
                  <video src={imageUrl} className="max-h-[40vh] max-w-full w-auto sm:max-h-[58vh]" controls />
                ) : (
                  <button type="button" onClick={onOpenPhoto} disabled={!onOpenPhoto} className="block max-h-[40vh] max-w-full sm:max-h-[58vh]">
                    <ImageWithFallback src={imageUrl} alt={caption || 'Post image'} className="max-h-[40vh] max-w-full w-auto sm:max-h-[58vh]" />
                  </button>
                )}
              </div>
            )}

            {(caption || afterCaption) && (
              <div className="shrink-0 px-5 pt-3">
                {caption && <p className="whitespace-pre-line text-sm text-gray-800">{caption}</p>}
                {afterCaption}
              </div>
            )}
          </>
        ) : (
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {typeof commentsCount === 'number' ? `${commentsCount} comments` : 'Comments'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {showPostContent && (
            <>
              <div className="flex flex-wrap items-center gap-4 border-y border-gray-200 py-3">
                <button onClick={onToggleLike} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                  {likesCount}
                </button>
                {onToggleShowLikedUsers && (
                  <button onClick={onToggleShowLikedUsers} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                    {loadingLikedUsers ? 'Loading...' : 'View likes'}
                  </button>
                )}
                {onOpenComments ? (
                  <button onClick={onOpenComments} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <MessageCircle className="h-5 w-5 text-gray-700" />
                    {commentsCount ?? comments.length}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <MessageCircle className="h-5 w-5 text-gray-700" />
                    {commentsCount ?? comments.length}
                  </span>
                )}
                {onShare && (
                  <button onClick={onShare} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Share2 className="h-5 w-5 text-gray-700" />
                    Share
                  </button>
                )}
                {onToggleSave && (
                  <button onClick={onToggleSave} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Bookmark className={`h-5 w-5 ${saved ? 'fill-gray-900 text-gray-900' : 'text-gray-700'}`} />
                    Save
                  </button>
                )}
              </div>

              {showLikedUsers && likedUsers.length > 0 ? (
                <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="mb-2 font-semibold text-gray-900">Liked by</p>
                  <div className="flex flex-wrap gap-3">
                    {likedUsers.map((likedUser) => (
                      <button
                        key={likedUser.id}
                        type="button"
                        onClick={() => onViewLikedUser?.(likedUser.id)}
                        disabled={!onViewLikedUser}
                        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm transition enabled:hover:bg-gray-100"
                      >
                        <Avatar
                          src={likedUser.avatar_url || authorAvatarUrl}
                          alt={likedUser.full_name || likedUser.email || 'User'}
                          sizeClassName="h-8 w-8 rounded-full"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{likedUser.full_name || likedUser.email || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">@{String(likedUser.email || '').split('@')[0]}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {!showPostContent && (
            <div className="space-y-3">
              {canComment ? (
                <CommentsList
                  comments={comments}
                  loading={loadingComments}
                  fallbackAvatarUrl={fallbackAvatarUrl}
                  renderContent={renderCommentContent}
                  threaded={threadedComments}
                  postId={postId}
                  repliesByParent={repliesByParent}
                  expandedReplyThreadsByKey={expandedReplyThreadsByKey}
                  onToggleReplyThread={onToggleReplyThread}
                  replyTarget={replyTarget}
                  onReply={onReply}
                  replyDraft={replyDraft}
                  onReplyDraftChange={onReplyDraftChange}
                  onSubmitReply={onSubmitReply}
                  isSubmittingReply={isSubmittingReply}
                  getReplyKey={getReplyKey}
                />
              ) : (
                <p className="text-sm text-gray-500">Comments are not available for this post yet.</p>
              )}
            </div>
          )}
        </div>

        {!showPostContent && canComment && (
          <CommentInput
            avatarUrl={currentUserAvatarUrl}
            avatarAlt="You"
            value={commentDraft}
            onChange={onCommentDraftChange}
            onSubmit={onSubmitComment}
            submitting={isSubmittingComment}
            focusToken={commentFocusToken}
          />
        )}
      </div>
    </div>
  );
}

export default PostDetailModal;
