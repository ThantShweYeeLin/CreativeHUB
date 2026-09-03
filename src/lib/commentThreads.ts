export interface ThreadableComment {
  id: string | number;
  content: string;
  created_at: string;
  user?: { full_name?: string | null } | null;
}

export interface CommentThreads<T> {
  roots: T[];
  repliesByParent: Record<string, T[]>;
}

export function normalizeCommentHandle(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.]/g, '');
}

export function extractMentionToken(content: string) {
  const match = content.trim().match(/^@([a-zA-Z0-9_.]+)/);
  return match?.[1] || null;
}

/**
 * Groups a flat comment list into roots + replies. There is no parent_id column on
 * client_post_comments, so a reply is recognized by its content starting with
 * "@AuthorName" (written by submitReply) and matched to the nearest earlier root
 * comment from that author — this only supports one level of nesting, matching
 * Instagram/TikTok's flat "reply to a top-level comment" model.
 */
export function buildCommentThreads<T extends ThreadableComment>(comments: T[]): CommentThreads<T> {
  const roots: T[] = [];
  const repliesByParent: Record<string, T[]> = {};

  comments.forEach((comment) => {
    const mention = extractMentionToken(comment.content || '');

    if (mention) {
      const normalizedMention = normalizeCommentHandle(mention);
      const parent = [...roots]
        .reverse()
        .find((candidate) => {
          const byName = normalizeCommentHandle(candidate.user?.full_name);
          return byName && byName === normalizedMention;
        });

      if (parent) {
        const parentId = String(parent.id);
        if (!repliesByParent[parentId]) {
          repliesByParent[parentId] = [];
        }
        repliesByParent[parentId].push(comment);
        return;
      }
    }

    roots.push(comment);
  });

  return { roots, repliesByParent };
}

export function getReplyKey(postId: string, commentId: string) {
  return `${postId}:${commentId}`;
}

/** Pre-fills a reply draft addressed to a specific comment/reply author. */
export function buildMentionPrefill(name: string | null | undefined) {
  return `@${name || 'User'} `;
}

/** True once there's actual reply text beyond the auto-filled "@Name " mention. */
export function hasReplyContent(draftText: string) {
  const trimmed = draftText.trim();
  const mention = extractMentionToken(trimmed);
  if (!mention) {
    return trimmed.length > 0;
  }
  return trimmed.slice(1 + mention.length).trim().length > 0;
}

/** Short relative timestamp for a comment/reply, e.g. "3d", "2h", "Just now". */
export function formatCommentTimeAgo(dateString: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}
