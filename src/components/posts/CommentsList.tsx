import { ChevronDown } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { formatCommentTimeAgo } from '../../lib/commentThreads';

export interface CommentUser {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface CommentItem {
  id: string;
  content: string;
  created_at: string;
  user?: CommentUser;
}

interface CommentsListProps {
  comments: CommentItem[];
  loading: boolean;
  fallbackAvatarUrl: string;
  emptyLabel?: string;
  renderContent?: (content: string) => React.ReactNode;

  /** Threaded replies (used by the For You feed). Omit for a flat comment list. */
  threaded?: boolean;
  postId?: string;
  repliesByParent?: Record<string, CommentItem[]>;
  expandedReplyThreadsByKey?: Record<string, boolean>;
  onToggleReplyThread?: (threadKey: string) => void;
  replyTarget?: string | null;
  /** `mentionAuthor` is set when replying to a nested reply rather than the root comment. */
  onReply?: (rootComment: CommentItem, mentionAuthor?: CommentItem) => void;
  replyDraft?: (threadKey: string) => string;
  onReplyDraftChange?: (threadKey: string, value: string) => void;
  onSubmitReply?: (comment: CommentItem) => void;
  isSubmittingReply?: (threadKey: string) => boolean;
  getReplyKey?: (postId: string, commentId: string) => string;
}

function CommentRow({
  comment,
  fallbackAvatarUrl,
  renderContent,
  avatarSizeClassName,
  onReplyClick,
}: {
  comment: CommentItem;
  fallbackAvatarUrl: string;
  renderContent: (content: string) => React.ReactNode;
  avatarSizeClassName: string;
  onReplyClick?: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Avatar
        src={comment.user?.avatar_url || fallbackAvatarUrl}
        alt={comment.user?.full_name || 'User'}
        sizeClassName={avatarSizeClassName}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-400">{comment.user?.full_name || 'User'}</p>
        <div className="mt-0.5 text-sm text-gray-100">{renderContent(comment.content)}</div>
        <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-500">
          <span>{formatCommentTimeAgo(comment.created_at)}</span>
          {onReplyClick && (
            <button type="button" onClick={onReplyClick} className="hover:text-gray-300">
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentsList({
  comments,
  loading,
  fallbackAvatarUrl,
  emptyLabel = 'No comments yet.',
  renderContent = (content) => <span className="whitespace-pre-wrap">{content}</span>,
  threaded = false,
  postId,
  repliesByParent = {},
  expandedReplyThreadsByKey = {},
  onToggleReplyThread,
  replyTarget,
  onReply,
  replyDraft,
  onReplyDraftChange,
  onSubmitReply,
  isSubmittingReply,
  getReplyKey = (p, c) => `${p}:${c}`,
}: CommentsListProps) {
  if (loading) {
    return <p className="text-sm text-gray-400">Loading comments...</p>;
  }

  if (comments.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>;
  }

  const replyBox = (parentId: string, comment: CommentItem) => {
    const threadKey = getReplyKey(postId || '', parentId);
    return onSubmitReply && replyTarget === parentId ? (
      <div className="mt-2 flex gap-2 pl-11">
        <input
          value={replyDraft?.(threadKey) || ''}
          onChange={(event) => onReplyDraftChange?.(threadKey, event.target.value)}
          placeholder="Write a reply..."
          className="flex-1 rounded-full border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-gray-600"
        />
        <button
          type="button"
          onClick={() => onSubmitReply(comment)}
          disabled={!!isSubmittingReply?.(threadKey)}
          className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
        >
          {isSubmittingReply?.(threadKey) ? 'Sending...' : 'Reply'}
        </button>
      </div>
    ) : null;
  };

  if (!threaded || !postId) {
    return (
      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            fallbackAvatarUrl={fallbackAvatarUrl}
            renderContent={renderContent}
            avatarSizeClassName="h-9 w-9 rounded-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const parentId = String(comment.id);
        const threadKey = getReplyKey(postId, parentId);
        const replies = repliesByParent[parentId] || [];
        const expanded = !!expandedReplyThreadsByKey[threadKey];
        // A single reply is shown right away; 2+ replies collapse behind "View replies".
        const visibleReplies = replies.length <= 1 || expanded ? replies : [];
        const hasHiddenReplies = replies.length > 1;

        return (
          <div key={comment.id}>
            <CommentRow
              comment={comment}
              fallbackAvatarUrl={fallbackAvatarUrl}
              renderContent={renderContent}
              avatarSizeClassName="h-9 w-9 rounded-full"
              onReplyClick={onReply ? () => onReply(comment) : undefined}
            />

            {replyBox(parentId, comment)}

            {visibleReplies.length > 0 ? (
              <div className="mt-3 space-y-3 pl-11">
                {visibleReplies.map((reply) => (
                  <div key={reply.id}>
                    <CommentRow
                      comment={reply}
                      fallbackAvatarUrl={fallbackAvatarUrl}
                      renderContent={renderContent}
                      avatarSizeClassName="h-7 w-7 rounded-full"
                      onReplyClick={onReply ? () => onReply(comment, reply) : undefined}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {hasHiddenReplies ? (
              <button
                type="button"
                onClick={() => onToggleReplyThread?.(threadKey)}
                className="mt-2 ml-11 flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-300"
              >
                <span className="h-px w-6 bg-gray-700" />
                {expanded ? 'Hide replies' : `View ${replies.length} replies`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default CommentsList;
