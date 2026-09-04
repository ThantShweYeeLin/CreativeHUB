import { useEffect } from 'react';
import { X } from 'lucide-react';
import { CommentInput } from './CommentInput';
import { CommentsList, type CommentItem } from './CommentsList';

interface PostDetailModalProps {
  onClose: () => void;

  commentsCount?: number;

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
}

export function PostDetailModal({
  onClose,
  commentsCount,
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
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-[55dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl sm:h-auto sm:max-h-[80vh] sm:w-full sm:max-w-lg sm:rounded-3xl">
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

        <div className="flex-1 overflow-y-auto p-5">
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

        {canComment && (
          <CommentInput
            avatarUrl={currentUserAvatarUrl}
            avatarAlt="You"
            value={commentDraft}
            onChange={onCommentDraftChange}
            onSubmit={onSubmitComment}
            submitting={isSubmittingComment}
          />
        )}
      </div>
    </div>
  );
}

export default PostDetailModal;
