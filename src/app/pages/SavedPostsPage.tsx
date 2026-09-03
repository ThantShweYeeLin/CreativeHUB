import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { PostDetailModal } from '../../components/posts/PostDetailModal';
import { PhotoViewerModal } from '../../components/posts/PhotoViewerModal';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { dispatchClientPostUpdated } from '../../lib/clientPostSync';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { buildCommentThreads, buildMentionPrefill, getReplyKey, hasReplyContent } from '../../lib/commentThreads';

interface SavedPostsPageProps {
  onBack: () => void;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;

export function SavedPostsPage({ onBack }: SavedPostsPageProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postEngagement, setPostEngagement] = useState<Record<string, { likes: number; comments: number; shares: number; saved: boolean; liked: boolean }>>({});

  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, any[]>>({});
  const [loadingCommentsByPostId, setLoadingCommentsByPostId] = useState<Record<string, boolean>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<string, boolean>>({});
  const [replyTargetByPostId, setReplyTargetByPostId] = useState<Record<string, string | null>>({});
  const [replyDraftByCommentKey, setReplyDraftByCommentKey] = useState<Record<string, string>>({});
  const [isSubmittingReplyByCommentKey, setIsSubmittingReplyByCommentKey] = useState<Record<string, boolean>>({});
  const [expandedReplyThreadsByKey, setExpandedReplyThreadsByKey] = useState<Record<string, boolean>>({});
  const [commentFocusToken, setCommentFocusToken] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; alt?: string } | null>(null);
  const savedScrollYRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedPosts() {
      if (!user?.id) {
        if (isMounted) {
          setPosts([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      const response = await DataService.getSavedClientPostsByUserId(user.id);
      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load saved posts.');
        setPosts([]);
      } else {
        const data = response.data || [];
        setPosts(data);
        const seed: Record<string, { likes: number; comments: number; shares: number; saved: boolean; liked: boolean }> = {};
        data.forEach((post: any) => {
          seed[post.id] = {
            likes: Math.max(0, Number(post.likes_count || 0)),
            comments: Math.max(0, Number(post.comments_count || 0)),
            shares: Math.max(0, Number(post.shares_count || 0)),
            liked: !!post.liked_by_me,
            saved: !!post.saved_by_me,
          };
        });
        setPostEngagement(seed);
      }

      setIsLoading(false);
    }

    loadSavedPosts();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const focusedPost = useMemo(() => posts.find((post) => String(post.id) === focusedPostId) || null, [posts, focusedPostId]);

  const focusedCommentThreads = useMemo(
    () => buildCommentThreads(focusedPostId ? commentsByPostId[focusedPostId] || [] : []),
    [commentsByPostId, focusedPostId]
  );

  const openPostFocus = async (postId: string) => {
    const stateKey = String(postId);
    if (savedScrollYRef.current === null) {
      savedScrollYRef.current = window.scrollY;
    }
    setFocusedPostId(stateKey);
    setCommentFocusToken((token) => token + 1);

    if (commentsByPostId[stateKey]) {
      return;
    }

    setLoadingCommentsByPostId((current) => ({ ...current, [stateKey]: true }));
    const response = await DataService.getClientPostComments(stateKey, 100);
    if (response.error) {
      setError((response.error as any).message || 'Unable to load comments.');
      setCommentsByPostId((current) => ({ ...current, [stateKey]: [] }));
    } else {
      setCommentsByPostId((current) => ({ ...current, [stateKey]: response.data || [] }));
    }
    setLoadingCommentsByPostId((current) => ({ ...current, [stateKey]: false }));
  };

  const closePostFocus = () => {
    setFocusedPostId(null);
    if (savedScrollYRef.current !== null) {
      const y = savedScrollYRef.current;
      savedScrollYRef.current = null;
      window.scrollTo(0, y);
    }
  };

  const togglePostLike = async (postId: string) => {
    const stateKey = String(postId);
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, liked: false, saved: false };
      return {
        ...current,
        [stateKey]: {
          ...existing,
          liked: !existing.liked,
          likes: existing.liked ? Math.max(0, existing.likes - 1) : existing.likes + 1,
        },
      };
    });

    if (!user?.id) {
      return;
    }

    const engagement = postEngagement[stateKey] || { likes: 0, comments: 0, shares: 0, liked: false, saved: false };
    const response = await DataService.toggleClientPostLike(user.id, stateKey, engagement.liked);
    if (response.error) {
      setError((response.error as any).message || 'Unable to update like status.');
      setPostEngagement((current) => {
        const existing = current[stateKey] || engagement;
        return {
          ...current,
          [stateKey]: {
            ...existing,
            liked: engagement.liked,
            likes: engagement.liked ? existing.likes + 1 : Math.max(0, existing.likes - 1),
          },
        };
      });
      return;
    }

    dispatchClientPostUpdated(stateKey);
  };

  // Unsaving here removes the post from this list entirely — that's the point
  // of a "Saved Posts" collection, unlike the like/save toggle on other pages
  // where the post stays put either way.
  const togglePostSave = async (postId: string) => {
    const stateKey = String(postId);
    if (!user?.id) {
      return;
    }

    const response = await DataService.toggleClientPostSave(user.id, stateKey, true);
    if (response.error) {
      setError((response.error as any).message || 'Unable to unsave this post.');
      return;
    }

    setPosts((current) => current.filter((post) => String(post.id) !== stateKey));
    if (focusedPostId === stateKey) {
      closePostFocus();
    }
    dispatchClientPostUpdated(stateKey);
  };

  const sharePost = async (postId: string) => {
    const stateKey = String(postId);
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, liked: false, saved: false };
      return { ...current, [stateKey]: { ...existing, shares: existing.shares + 1 } };
    });

    if (user?.id) {
      await DataService.recordClientPostShare(user.id, stateKey);
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/for-you`);
    } catch {
      // ignore clipboard failures
    }
  };

  const submitComment = async (postId: string) => {
    const stateKey = String(postId);
    const draft = (commentDraftByPostId[stateKey] || '').trim();
    if (!draft || !user?.id) {
      return;
    }

    setIsSubmittingCommentByPostId((current) => ({ ...current, [stateKey]: true }));
    const response = await DataService.addClientPostComment(user.id, stateKey, draft);
    if (response.error) {
      setError((response.error as any).message || 'Unable to add comment.');
      setIsSubmittingCommentByPostId((current) => ({ ...current, [stateKey]: false }));
      return;
    }

    setCommentsByPostId((current) => ({
      ...current,
      [stateKey]: [...(current[stateKey] || []), response.data],
    }));
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, liked: false, saved: false };
      return { ...current, [stateKey]: { ...existing, comments: existing.comments + 1 } };
    });
    setCommentDraftByPostId((current) => ({ ...current, [stateKey]: '' }));
    setIsSubmittingCommentByPostId((current) => ({ ...current, [stateKey]: false }));
    dispatchClientPostUpdated(stateKey);
  };

  const replyToComment = (postId: string, rootComment: any, mentionAuthor?: any) => {
    const targetCommentId = String(rootComment.id);
    const threadKey = getReplyKey(postId, targetCommentId);
    const isRootReplyClick = !mentionAuthor;
    const alreadyOpenForThisRoot = replyTargetByPostId[postId] === targetCommentId;

    if (isRootReplyClick && alreadyOpenForThisRoot) {
      setReplyTargetByPostId((current) => ({ ...current, [postId]: null }));
      return;
    }

    const mentionSource = mentionAuthor || rootComment;
    setReplyTargetByPostId((current) => ({ ...current, [postId]: targetCommentId }));
    setReplyDraftByCommentKey((current) => ({
      ...current,
      [threadKey]: buildMentionPrefill(mentionSource.user?.full_name),
    }));
  };

  const submitReply = async (postId: string, comment: any) => {
    const stateKey = String(postId);
    if (!user?.id) {
      return;
    }

    const commentId = String(comment.id);
    const threadKey = getReplyKey(stateKey, commentId);
    const draft = replyDraftByCommentKey[threadKey] || '';
    if (!hasReplyContent(draft)) {
      return;
    }

    const content = draft.trim();
    setIsSubmittingReplyByCommentKey((current) => ({ ...current, [threadKey]: true }));

    const response = await DataService.addClientPostComment(user.id, stateKey, content);
    if (response.error) {
      setError((response.error as any).message || 'Unable to add reply.');
      setIsSubmittingReplyByCommentKey((current) => ({ ...current, [threadKey]: false }));
      return;
    }

    setCommentsByPostId((current) => ({
      ...current,
      [stateKey]: [...(current[stateKey] || []), response.data],
    }));
    setPostEngagement((current) => {
      const existing = current[stateKey] || { likes: 0, comments: 0, shares: 0, liked: false, saved: false };
      return { ...current, [stateKey]: { ...existing, comments: existing.comments + 1 } };
    });
    setReplyDraftByCommentKey((current) => ({ ...current, [threadKey]: '' }));
    setReplyTargetByPostId((current) => ({ ...current, [stateKey]: null }));
    setIsSubmittingReplyByCommentKey((current) => ({ ...current, [threadKey]: false }));
    dispatchClientPostUpdated(stateKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 mb-6 md:mb-8">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            Back to Home
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
              <Bookmark className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Saved Posts</h1>
              <p className="text-sm md:text-base text-gray-600">{posts.length} saved post{posts.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
            <Bookmark className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <h2 className="mb-1 text-lg font-bold text-gray-900">No saved posts yet</h2>
            <p className="text-sm text-gray-600">Tap the bookmark icon on any post to save it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {posts.map((post) => {
              const engagement = postEngagement[post.id] || { likes: 0, comments: 0, shares: 0, liked: false, saved: true };
              return (
                <article key={post.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <ImageWithFallback
                      src={post.client?.avatar_url || fallbackProfileImage}
                      alt={post.client?.full_name || 'User'}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{post.client?.full_name || 'User'}</p>
                    </div>
                  </div>

                  {post.image_url && (
                    <button
                      type="button"
                      onClick={() => setViewingPhoto({ url: post.image_url, alt: post.caption || 'Post image' })}
                      className="aspect-[4/3] w-full bg-gray-100 text-left"
                    >
                      <ImageWithFallback src={post.image_url} alt={post.caption || 'Post image'} className="h-full w-full object-cover" />
                    </button>
                  )}

                  <div className="p-4">
                    <p className="text-sm text-gray-700">{post.caption || 'No caption'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
                      <button type="button" onClick={() => void togglePostLike(post.id)} className="inline-flex items-center gap-1">
                        <Heart className={`h-4 w-4 ${engagement.liked ? 'fill-red-500 text-red-500' : ''}`} />
                        {engagement.likes}
                      </button>
                      <button type="button" onClick={() => void openPostFocus(post.id)} className="inline-flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        {engagement.comments}
                      </button>
                      <button type="button" onClick={() => void sharePost(post.id)} className="inline-flex items-center gap-1">
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                      <button type="button" onClick={() => void togglePostSave(post.id)} className="ml-auto inline-flex items-center gap-1">
                        <Bookmark className="h-4 w-4 fill-gray-900 text-gray-900" />
                        Unsave
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {focusedPost && (
        <PostDetailModal
          onClose={closePostFocus}
          commentsCount={postEngagement[focusedPost.id]?.comments || 0}
          comments={focusedCommentThreads.roots}
          loadingComments={!!loadingCommentsByPostId[focusedPost.id]}
          canComment
          fallbackAvatarUrl={fallbackProfileImage}
          threadedComments
          postId={focusedPost.id}
          repliesByParent={focusedCommentThreads.repliesByParent}
          expandedReplyThreadsByKey={expandedReplyThreadsByKey}
          onToggleReplyThread={(threadKey) =>
            setExpandedReplyThreadsByKey((current) => ({
              ...current,
              [threadKey]: !current[threadKey],
            }))
          }
          replyTarget={replyTargetByPostId[focusedPost.id] || null}
          onReply={(comment, mentionAuthor) => replyToComment(focusedPost.id, comment, mentionAuthor)}
          replyDraft={(threadKey) => replyDraftByCommentKey[threadKey] || ''}
          onReplyDraftChange={(threadKey, value) =>
            setReplyDraftByCommentKey((current) => ({
              ...current,
              [threadKey]: value,
            }))
          }
          onSubmitReply={(comment) => void submitReply(focusedPost.id, comment)}
          isSubmittingReply={(threadKey) => !!isSubmittingReplyByCommentKey[threadKey]}
          getReplyKey={getReplyKey}
          currentUserAvatarUrl={user?.avatar_url || fallbackProfileImage}
          commentDraft={commentDraftByPostId[focusedPost.id] || ''}
          onCommentDraftChange={(value) =>
            setCommentDraftByPostId((current) => ({
              ...current,
              [focusedPost.id]: value,
            }))
          }
          onSubmitComment={() => void submitComment(focusedPost.id)}
          isSubmittingComment={!!isSubmittingCommentByPostId[focusedPost.id]}
          commentFocusToken={commentFocusToken}
        />
      )}

      {viewingPhoto && (
        <PhotoViewerModal url={viewingPhoto.url} alt={viewingPhoto.alt} onClose={() => setViewingPhoto(null)} />
      )}
    </div>
  );
}

export default SavedPostsPage;
