import {
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  PlayCircle,
  Reply,
  Send,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import type { FeedCommentRow, FeedPostRow, SaveCollectionRow, ShareTarget, SuggestedCreatorRow } from '../../lib/database.types';
import { FeedService, type FeedCursor } from '../../lib/feedService';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ForYouPageProps {
  onViewProfile?: () => void;
}

const categories = [
  'Fashion Designers',
  'Photographers',
  'Videographers',
  'Models',
  'Makeup Artists',
  'Graphic Designers',
  'Illustrators',
  'Stylists',
  'Architects',
  'Creative Directors',
];

const shareTargets: Array<{ target: ShareTarget; label: string; url?: (link: string) => string }> = [
  { target: 'copy_link', label: 'Copy link' },
  { target: 'creativehub', label: 'Share in CreativeHUB' },
  { target: 'whatsapp', label: 'WhatsApp', url: (link) => `https://wa.me/?text=${encodeURIComponent(link)}` },
  { target: 'telegram', label: 'Telegram', url: (link) => `https://t.me/share/url?url=${encodeURIComponent(link)}` },
  { target: 'facebook', label: 'Facebook', url: (link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  { target: 'x', label: 'X', url: (link) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}` },
];

function timeAgo(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(delta / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ src, name, size = 'h-11 w-11' }: { src?: string | null; name: string; size?: string }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-full bg-gray-950 text-white ring-1 ring-gray-200`}>
      {src ? (
        <ImageWithFallback src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-semibold">{initials(name)}</div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 p-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="aspect-[4/5] animate-pulse bg-gray-100" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-52 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

function CommentThread({
  comments,
  userId,
  onReply,
  onDelete,
}: {
  comments: FeedCommentRow[];
  userId: string;
  onReply: (comment: FeedCommentRow) => void;
  onDelete: (commentId: string) => void;
}) {
  const commentsByParent = comments.reduce<Record<string, FeedCommentRow[]>>((acc, comment) => {
    const key = comment.parent_id ?? 'root';
    acc[key] = [...(acc[key] ?? []), comment];
    return acc;
  }, {});

  const renderBranch = (parentId: string, depth = 0) =>
    (commentsByParent[parentId] ?? []).map((comment) => (
      <div key={comment.id} className={depth > 0 ? 'ml-10 border-l border-gray-200 pl-4' : undefined}>
        <CommentRow comment={comment} userId={userId} onReply={onReply} onDelete={onDelete} compact={depth > 0} />
        <div className="mt-3 space-y-3">{renderBranch(comment.id, depth + 1)}</div>
      </div>
    ));

  return <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">{renderBranch('root')}</div>;
}

function CommentRow({
  comment,
  userId,
  onReply,
  onDelete,
  compact = false,
}: {
  comment: FeedCommentRow;
  userId: string;
  onReply: (comment: FeedCommentRow) => void;
  onDelete: (commentId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar src={comment.author.avatar_url} name={comment.author.full_name} size={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-gray-950">{comment.author.full_name}</span>
            <span className="text-xs text-gray-500">@{comment.author.username}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-800">{comment.body}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
          <span>{timeAgo(comment.created_at)}</span>
          <button onClick={() => onReply(comment)} className="inline-flex items-center gap-1 font-medium hover:text-gray-900">
            <Reply className="h-3.5 w-3.5" />
            Reply
          </button>
          {comment.user_id === userId && (
            <button onClick={() => onDelete(comment.id)} className="inline-flex items-center gap-1 font-medium hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ForYouPage({ onViewProfile }: ForYouPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPostRow[]>([]);
  const [suggestedCreators, setSuggestedCreators] = useState<SuggestedCreatorRow[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<Record<string, number>>({});
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, FeedCommentRow[]>>({});
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<FeedCommentRow | null>(null);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [savePostId, setSavePostId] = useState<string | null>(null);
  const [collections, setCollections] = useState<SaveCollectionRow[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [doubleTapPostId, setDoubleTapPostId] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement | null>(null);
  const lastTap = useRef<Record<string, number>>({});

  const currentUserId = user?.id ?? '';

  const selectedPost = useMemo(() => posts.find((post) => post.id === sharePostId || post.id === savePostId), [posts, sharePostId, savePostId]);

  const loadFeed = useCallback(
    async (mode: 'reset' | 'more' = 'reset') => {
      if (!currentUserId) return;
      if (mode === 'more' && (!hasMore || loadingMore)) return;

      mode === 'more' ? setLoadingMore(true) : setLoading(true);
      setError(null);

      try {
        const page = await FeedService.getForYouFeed(currentUserId, mode === 'more' ? cursor : null);
        setCursor(page.nextCursor);
        setHasMore(Boolean(page.nextCursor));
        setPosts((existing) => (mode === 'more' ? [...existing, ...page.posts] : page.posts));
      } catch (feedError) {
        setError(feedError instanceof Error ? feedError.message : 'Unable to load the For You feed.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [currentUserId, cursor, hasMore, loadingMore],
  );

  const refreshSuggestions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setSuggestedCreators(await FeedService.getSuggestedCreators(currentUserId));
    } catch {
      setSuggestedCreators([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadFeed('reset');
    refreshSuggestions();
  }, [loadFeed, refreshSuggestions]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    let refreshTimer: number | undefined;
    const channel = FeedService.subscribeToFeed(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadFeed('reset'), 350);
    });

    const notifications = FeedService.subscribeToNotifications(currentUserId, () => {
      toast.success('You have a new notification.');
    });

    return () => {
      window.clearTimeout(refreshTimer);
      channel.unsubscribe();
      notifications.unsubscribe();
    };
  }, [currentUserId, loadFeed]);

  useEffect(() => {
    if (!commentsPostId) return undefined;
    const refresh = async () => {
      const rows = await FeedService.getComments(commentsPostId);
      setComments((current) => ({ ...current, [commentsPostId]: rows }));
    };

    refresh();
    const channel = FeedService.subscribeToComments(commentsPostId, refresh);
    return () => {
      channel.unsubscribe();
    };
  }, [commentsPostId]);

  useEffect(() => {
    if (!savePostId || !currentUserId) return;

    const loadCollections = async () => {
      setLoadingCollections(true);
      try {
        setCollections(await FeedService.getCollections(currentUserId));
      } catch {
        setCollections([]);
      } finally {
        setLoadingCollections(false);
      }
    };

    loadCollections();
  }, [currentUserId, savePostId]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadFeed('more');
      },
      { rootMargin: '700px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadFeed]);

  const updatePost = (postId: string, updater: (post: FeedPostRow) => FeedPostRow) => {
    setPosts((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
  };

  const viewProfile = (creatorId: string) => {
    onViewProfile?.();
    navigate(`/profile/${creatorId}`);
  };

  const toggleLike = async (post: FeedPostRow) => {
    updatePost(post.id, (item) => ({
      ...item,
      likes_count: item.viewer.liked ? Math.max(0, item.likes_count - 1) : item.likes_count + 1,
      viewer: { ...item.viewer, liked: !item.viewer.liked },
    }));

    try {
      await FeedService.toggleLike(currentUserId, post.id, post.viewer.liked);
    } catch (likeError) {
      updatePost(post.id, () => post);
      toast.error(likeError instanceof Error ? likeError.message : 'Unable to update like.');
    }
  };

  const toggleSave = async (post: FeedPostRow, collectionId: string | null = null) => {
    updatePost(post.id, (item) => ({
      ...item,
      saves_count: item.viewer.saved ? Math.max(0, item.saves_count - 1) : item.saves_count + 1,
      viewer: { ...item.viewer, saved: !item.viewer.saved },
    }));

    try {
      await FeedService.toggleSave(currentUserId, post.id, post.viewer.saved, collectionId);
      setSavePostId(null);
      setCollectionName('');
    } catch (saveError) {
      updatePost(post.id, () => post);
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to update saved posts.');
    }
  };

  const toggleFollow = async (creatorId: string, following: boolean) => {
    setPosts((current) =>
      current.map((post) =>
        post.author_id === creatorId
          ? {
              ...post,
              author: {
                ...post.author,
                follower_count: following ? Math.max(0, post.author.follower_count - 1) : post.author.follower_count + 1,
              },
              viewer: { ...post.viewer, following_author: !following },
            }
          : post,
      ),
    );

    try {
      await FeedService.toggleFollow(currentUserId, creatorId, following);
      refreshSuggestions();
    } catch (followError) {
      toast.error(followError instanceof Error ? followError.message : 'Unable to update follow.');
      loadFeed('reset');
    }
  };

  const submitComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText('');

    try {
      await FeedService.addComment(currentUserId, postId, text, replyTo?.id ?? null);
      setReplyTo(null);
    } catch (commentError) {
      setCommentText(text);
      toast.error(commentError instanceof Error ? commentError.message : 'Unable to add comment.');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await FeedService.deleteComment(currentUserId, commentId);
    } catch (commentError) {
      toast.error(commentError instanceof Error ? commentError.message : 'Unable to delete comment.');
    }
  };

  const sharePost = async (postId: string, target: ShareTarget) => {
    const link = `${window.location.origin}/for-you?post=${postId}`;

    try {
      await FeedService.sharePost(currentUserId, postId, target);
      updatePost(postId, (post) => ({ ...post, shares_count: post.shares_count + 1 }));

      if (target === 'copy_link' || target === 'creativehub') {
        await navigator.clipboard.writeText(link);
        toast.success(target === 'copy_link' ? 'Link copied.' : 'CreativeHUB share link copied.');
      } else {
        const destination = shareTargets.find((item) => item.target === target)?.url?.(link);
        if (destination) window.open(destination, '_blank', 'noopener,noreferrer');
      }

      setSharePostId(null);
    } catch (shareError) {
      toast.error(shareError instanceof Error ? shareError.message : 'Unable to share post.');
    }
  };

  const createCollectionAndSave = async () => {
    if (!selectedPost || !collectionName.trim()) return;

    try {
      const collection = await FeedService.createCollection(currentUserId, collectionName);
      setCollections((current) => [...current, collection]);
      await toggleSave(selectedPost, collection.id);
    } catch (collectionError) {
      toast.error(collectionError instanceof Error ? collectionError.message : 'Unable to create collection.');
    }
  };

  const handleMediaTap = (post: FeedPostRow) => {
    const now = Date.now();
    const previous = lastTap.current[post.id] ?? 0;
    lastTap.current[post.id] = now;

    if (now - previous < 300) {
      setDoubleTapPostId(post.id);
      window.setTimeout(() => setDoubleTapPostId(null), 650);
      if (!post.viewer.liked) toggleLike(post);
    }
  };

  return (
    <div className="min-h-screen bg-white px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="mx-auto w-full max-w-2xl">
          <header className="mb-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-normal text-gray-950 md:text-4xl">For You</h1>
                <p className="mt-1 text-sm text-gray-600">Popular creatives ranked by real engagement across CreativeHUB.</p>
              </div>
              <div className="hidden rounded-full border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 sm:inline-flex">
                <TrendingUp className="mr-2 h-4 w-4" />
                Ranked live
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <span key={category} className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
                  {category}
                </span>
              ))}
            </div>
          </header>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-5">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <Sparkles className="mx-auto h-9 w-9 text-gray-400" />
              <h2 className="mt-3 text-lg font-semibold text-gray-950">No creative posts yet</h2>
              <p className="mt-1 text-sm text-gray-600">Once creators publish posts with media, the highest-engagement work will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => {
                const mediaIndex = activeMedia[post.id] ?? 0;
                const media = post.media[mediaIndex];
                const postComments = comments[post.id] ?? [];

                return (
                  <article key={post.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-3 p-4">
                      <button onClick={() => viewProfile(post.author_id)} className="flex min-w-0 items-center gap-3 text-left">
                        <Avatar src={post.author.avatar_url} name={post.author.full_name} />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-bold text-gray-950">{post.author.full_name}</span>
                            {(post.author.is_pro || post.author.is_verified) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-950 px-2 py-0.5 text-[11px] font-bold text-white">
                                <BadgeCheck className="h-3 w-3" />
                                PRO
                              </span>
                            )}
                            {post.is_trending && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                <TrendingUp className="h-3 w-3" />
                                Trending
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-gray-500">
                            @{post.author.username} · {post.author.profession} · {timeAgo(post.created_at)}
                          </span>
                        </span>
                      </button>
                      {post.author_id !== currentUserId && (
                        <button
                          onClick={() => toggleFollow(post.author_id, post.viewer.following_author)}
                          className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                            post.viewer.following_author ? 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50' : 'bg-gray-950 text-white hover:bg-gray-800'
                          }`}
                        >
                          <UserPlus className="h-4 w-4" />
                          {post.viewer.following_author ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>

                    <div onClick={() => handleMediaTap(post)} className="relative aspect-[4/5] bg-gray-100">
                      {media?.media_type === 'video' ? (
                        <video
                          src={media.url}
                          poster={media.thumbnail_url ?? undefined}
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : media ? (
                        <ImageWithFallback src={media.url} alt={media.alt_text ?? post.caption} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">Media unavailable</div>
                      )}

                      {media?.media_type === 'video' && (
                        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                          <PlayCircle className="mr-1 inline h-3.5 w-3.5" />
                          Reel
                        </div>
                      )}

                      {doubleTapPostId === post.id && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <Heart className="h-24 w-24 animate-ping fill-white text-white drop-shadow-lg" />
                        </div>
                      )}

                      {post.media.length > 1 && (
                        <>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMedia((current) => ({ ...current, [post.id]: Math.max(0, mediaIndex - 1) }));
                            }}
                            disabled={mediaIndex === 0}
                            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-950 shadow-sm disabled:opacity-40"
                            aria-label="Previous media"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMedia((current) => ({ ...current, [post.id]: Math.min(post.media.length - 1, mediaIndex + 1) }));
                            }}
                            disabled={mediaIndex === post.media.length - 1}
                            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-950 shadow-sm disabled:opacity-40"
                            aria-label="Next media"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                          <div className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                            {mediaIndex + 1}/{post.media.length}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button onClick={() => toggleLike(post)} className="group inline-flex items-center gap-2 font-semibold text-gray-950">
                            <Heart className={`h-6 w-6 transition-transform group-hover:scale-110 ${post.viewer.liked ? 'fill-red-500 text-red-500' : 'text-gray-800'}`} />
                            {post.likes_count}
                          </button>
                          <button onClick={() => setCommentsPostId(commentsPostId === post.id ? null : post.id)} className="group inline-flex items-center gap-2 font-semibold text-gray-950">
                            <MessageCircle className="h-6 w-6 text-gray-800 transition-transform group-hover:scale-110" />
                            {post.comments_count}
                          </button>
                          <button onClick={() => setSharePostId(post.id)} className="group inline-flex items-center gap-2 font-semibold text-gray-950">
                            <Share2 className="h-6 w-6 text-gray-800 transition-transform group-hover:scale-110" />
                            {post.shares_count}
                          </button>
                        </div>
                        <button onClick={() => (post.viewer.saved ? toggleSave(post) : setSavePostId(post.id))} className="group inline-flex items-center gap-2 font-semibold text-gray-950">
                          <Bookmark className={`h-6 w-6 transition-transform group-hover:scale-110 ${post.viewer.saved ? 'fill-gray-950 text-gray-950' : 'text-gray-800'}`} />
                          {post.saves_count}
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="break-words text-sm leading-6 text-gray-800">
                          <button onClick={() => viewProfile(post.author_id)} className="font-bold text-gray-950 hover:underline">
                            @{post.author.username}
                          </button>{' '}
                          {post.caption}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {post.profile_views_snapshot.toLocaleString()} profile views
                          </span>
                          <span>{Number(post.engagement_score).toLocaleString()} engagement score</span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button onClick={() => toggleFollow(post.author_id, post.viewer.following_author)} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                          {post.viewer.following_author ? 'Unfollow' : 'Follow'}
                        </button>
                        <button onClick={() => navigate(`/requests?freelancer=${post.author_id}`)} className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                          <BriefcaseBusiness className="h-4 w-4" />
                          Hire
                        </button>
                        <button onClick={() => viewProfile(post.author_id)} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                          View Profile
                        </button>
                      </div>

                      {commentsPostId === post.id && (
                        <div className="mt-5 border-t border-gray-100 pt-4">
                          {postComments.length > 0 ? (
                            <CommentThread comments={postComments} userId={currentUserId} onReply={setReplyTo} onDelete={deleteComment} />
                          ) : (
                            <p className="text-sm text-gray-500">No comments yet.</p>
                          )}
                          {replyTo && (
                            <div className="mt-3 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                              <span>Replying to @{replyTo.author.username}</span>
                              <button onClick={() => setReplyTo(null)} className="font-semibold text-gray-900">
                                Cancel
                              </button>
                            </div>
                          )}
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              value={commentText}
                              onChange={(event) => setCommentText(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) submitComment(post.id);
                              }}
                              placeholder="Add a comment or mention @username"
                              className="h-11 min-w-0 flex-1 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-900"
                            />
                            <button
                              onClick={() => submitComment(post.id)}
                              disabled={!commentText.trim()}
                              className="grid h-11 w-11 place-items-center rounded-md bg-gray-950 text-white disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Post comment"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div ref={observerTarget} className="h-16">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm font-medium text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more posts
              </div>
            )}
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-5">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-gray-950">Suggested creators</h2>
                <Sparkles className="h-4 w-4 text-gray-500" />
              </div>
              <div className="space-y-4">
                {suggestedCreators.map((creator) => (
                  <div key={creator.id} className="flex items-center gap-3">
                    <Avatar src={creator.avatar_url} name={creator.full_name} size="h-10 w-10" />
                    <button onClick={() => viewProfile(creator.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-gray-950">{creator.full_name}</p>
                      <p className="truncate text-xs text-gray-500">{creator.profession}</p>
                    </button>
                    <button onClick={() => toggleFollow(creator.id, false)} className="rounded-md bg-gray-950 px-3 py-1.5 text-xs font-semibold text-white">
                      Follow
                    </button>
                  </div>
                ))}
                {suggestedCreators.length === 0 && <p className="text-sm text-gray-500">No suggestions available yet.</p>}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 font-bold text-gray-950">Ranking formula</h2>
              <p className="text-sm leading-6 text-gray-600">Likes + comments x3 + shares x5 + saves x4 + profile views x0.2.</p>
            </section>
          </div>
        </aside>
      </div>

      {sharePostId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4">
          <div className="w-full max-w-md rounded-t-lg bg-white shadow-xl md:rounded-lg">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="text-lg font-bold text-gray-950">Share post</h2>
              <button onClick={() => setSharePostId(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {shareTargets.map((item) => (
                <button key={item.target} onClick={() => sharePost(sharePostId, item.target)} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
                  {item.target === 'copy_link' ? <Copy className="h-5 w-5" /> : item.target === 'creativehub' ? <Send className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {savePostId && selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4">
          <div className="w-full max-w-md rounded-t-lg bg-white shadow-xl md:rounded-lg">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="text-lg font-bold text-gray-950">Save post</h2>
              <button onClick={() => setSavePostId(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <button onClick={() => toggleSave(selectedPost)} className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
                <Check className="h-5 w-5" />
                <span className="text-sm font-semibold">Save for later</span>
              </button>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Collections</p>
                {loadingCollections ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading collections
                  </div>
                ) : collections.length > 0 ? (
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={() => toggleSave(selectedPost, collection.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
                      >
                        <span className="truncate text-sm font-semibold">{collection.name}</span>
                        <Bookmark className="h-4 w-4 text-gray-500" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500">No collections yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  placeholder="New collection name"
                  className="h-11 min-w-0 flex-1 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-900"
                />
                <button onClick={createCollectionAndSave} disabled={!collectionName.trim()} className="rounded-md bg-gray-950 px-4 text-sm font-semibold text-white disabled:opacity-40">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
