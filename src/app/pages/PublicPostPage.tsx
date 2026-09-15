import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Heart, MessageCircle } from 'lucide-react';
import logoImage from '../../imports/logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { PostShareMenu } from '../../components/PostShareMenu';

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

// A post's image_url is sometimes a transient `blob:` URL from the composer
// (never uploaded to storage — a pre-existing limitation, see the
// implementation report) which only ever resolves in the browser tab that
// created it. Anywhere else — another device, another session, a social
// crawler — it's simply broken, so it's treated the same as "no image."
function isUsableImageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.length > 0 && !url.startsWith('blob:');
}

export function PublicPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [post, setPost] = useState<any>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [isLiking, setIsLiking] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!postId) {
        setState('not_found');
        return;
      }
      setState('loading');
      const response = await DataService.getClientPostById(postId, user?.id);
      if (!isMounted) return;

      if (response.error) {
        setState('error');
      } else if (!response.data) {
        // Covers "doesn't exist," "unpublished," and "author blocked the
        // viewer" identically — the RLS policy already returns no row for
        // any of these, and none of them should tell an unauthorized
        // visitor which reason applies.
        setState('not_found');
      } else {
        setPost(response.data);
        setState('ready');
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [postId, user?.id]);

  const requireLogin = (message: string) => {
    setActionNotice(message);
    window.setTimeout(() => {
      navigate('/login', { state: { redirectTo: `/post/${postId}` } });
    }, 900);
  };

  const handleToggleLike = async () => {
    if (!isAuthenticated || !user?.id) {
      requireLogin('Log in to like this post.');
      return;
    }
    if (!post) return;
    setIsLiking(true);
    const wasLiked = Boolean(post.liked_by_me);
    const response = await DataService.toggleClientPostLike(user.id, post.id, wasLiked);
    setIsLiking(false);
    if (!response.error) {
      setPost((current: any) => ({
        ...current,
        liked_by_me: !wasLiked,
        likes_count: Math.max(0, Number(current.likes_count || 0) + (wasLiked ? -1 : 1)),
      }));
    }
  };

  const authorName = post?.client?.full_name || 'CreativeHUB Member';
  const authorRole = post?.client?.role === 'freelancer' ? 'Freelancer' : 'Client';
  const shareTitle = `CreativeHUB post by @${(post?.client?.email || 'creativehub').split('@')[0]}`;

  return (
    <div className="relative min-h-screen pb-16">
      <PageBackdrop />
      <div className="relative z-10">
      <header className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[600px] items-center justify-between px-4 py-3">
          <button onClick={() => navigate(isAuthenticated ? '/explore' : '/signup')} className="flex items-center gap-2">
            <img src={logoImage} alt="CreativeHUB" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-bold text-gray-900">CreativeHUB</span>
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/explore')}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg"
            >
              Open CreativeHUB
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50"
            >
              Log In
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[600px] px-4 py-6">
        {state === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
            <p className="text-lg font-bold text-gray-900">Something went wrong</p>
            <p className="mt-2 text-sm text-gray-600">We couldn't load this post right now. Please try again.</p>
          </div>
        )}

        {state === 'not_found' && (
          <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <p className="text-lg font-bold text-gray-900">This post is no longer available</p>
            <p className="mt-2 text-sm text-gray-600">
              It may have been removed, made private, or the link may be incorrect.
            </p>
            <button
              onClick={() => navigate(isAuthenticated ? '/explore' : '/signup')}
              className="mt-5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
            >
              Explore CreativeHUB
            </button>
          </div>
        )}

        {state === 'ready' && post && (
          <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
            <button
              onClick={() => navigate(`/profile/${post.client_id}`)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-sky-50"
            >
              <Avatar src={post.client?.avatar_url || DEFAULT_AVATAR_URL} alt={authorName} gender={post.client?.gender} sizeClassName="h-12 w-12 ring-2 ring-sky-100 rounded-full" />
              <div className="min-w-0">
                <p className="truncate font-bold text-gray-900">{authorName}</p>
                <p className="text-xs text-gray-500">{authorRole} on CreativeHUB</p>
              </div>
            </button>

            {isUsableImageUrl(post.image_url) && (
              <div className="aspect-square w-full bg-sky-50">
                <ImageWithFallback src={post.image_url} alt="" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-gray-900">{post.caption}</p>
              <p className="mt-2 text-xs text-gray-500">{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleLike()}
                  disabled={isLiking}
                  aria-label={post.liked_by_me ? 'Unlike post' : 'Like post'}
                  className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-2 text-gray-600 transition-all hover:bg-sky-100 disabled:opacity-60"
                >
                  <Heart className={`h-5 w-5 ${post.liked_by_me ? 'fill-red-500 text-red-500' : ''}`} />
                  <span className="text-sm font-semibold">{Math.max(0, Number(post.likes_count || 0))}</span>
                </button>
                <div className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-2 text-gray-600">
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-sm font-semibold">{Math.max(0, Number(post.comments_count || 0))}</span>
                </div>
              </div>
              <PostShareMenu
                postId={post.id}
                title={shareTitle}
                description={post.caption}
                onShared={(method) => {
                  if (user?.id) void DataService.recordClientPostShare(user.id, post.id, method);
                }}
              />
            </div>

            {actionNotice && (
              <p className="border-t border-gray-100 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800">{actionNotice}</p>
            )}

            <div className="border-t border-sky-100 bg-sky-50/60 px-5 py-4">
              <button
                onClick={() => navigate(`/profile/${post.client_id}`)}
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-semibold text-white hover:shadow-lg"
              >
                View {authorName}'s Profile
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
