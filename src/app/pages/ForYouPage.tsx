import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { DataService } from '../../lib/dataService';
import { normalizeFreelancer } from '../../lib/freelanceMapper';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

interface ForYouPageProps {
  onViewProfile?: (freelancerId: string) => void;
}

interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  username: string;
  avatar: string;
  specialty: string;
  image: string;
  caption: string;
  likes: number;
  commentsCount: number;
  timeAgo: string;
  isLiked: boolean;
  isSaved: boolean;
  isClientPost?: boolean;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;

function toTimeAgo(timestamp: string | undefined) {
  if (!timestamp) {
    return 'Recently';
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ForYouPage({ onViewProfile }: ForYouPageProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [expandedCommentsForPost, setExpandedCommentsForPost] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostImageUrl, setNewPostImageUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      setIsLoading(true);
      setError(null);

      const [freelancersResponse, clientPostsResponse] = await Promise.all([
        DataService.getAllFreelancers(40),
        DataService.getClientPosts(30),
      ]);

      if (freelancersResponse.error && clientPostsResponse.error) {
        if (isMounted) {
          setError((freelancersResponse.error as any)?.message || (clientPostsResponse.error as any)?.message || 'Unable to load feed.');
          setPosts([]);
          setIsLoading(false);
        }
        return;
      }

      const normalizedFreelancers = (freelancersResponse.data || []).map(normalizeFreelancer);

      const generatedPosts: FeedPost[] = normalizedFreelancers.flatMap((freelancer) => {
        const authorId = freelancer.userId || freelancer.id;
        const username = freelancer.username || freelancer.fullName.toLowerCase().replace(/\s+/g, '_');
        const specialty = freelancer.profession || freelancer.skills[0] || 'Creative Freelancer';
        const projectItems = freelancer.portfolio;

        return projectItems.map((project, index) => ({
          id: `${authorId}-${project.id}`,
          authorId,
          authorName: freelancer.fullName,
          username,
          avatar: freelancer.profileImage || fallbackProfileImage,
          specialty,
          image: project.imageUrl,
          caption: project.description || `${project.title} by ${freelancer.fullName}.`,
          likes: project.likes ?? Math.max(5, Math.round(freelancer.rating * 30) + index * 3),
          commentsCount: project.comments ?? Math.max(1, Math.round(freelancer.totalReviews / 4) + index),
          timeAgo: toTimeAgo(project.createdAt),
          isLiked: false,
          isSaved: false,
        }));
      }).slice(0, 30);

      const clientPosts: FeedPost[] = (clientPostsResponse.data || []).map((post: any) => {
        const authorName = post.client?.full_name || 'Client';
        const username = (post.client?.email || 'client').split('@')[0];

        return {
          id: `client-post-${post.id}`,
          authorId: post.client_id,
          authorName,
          username,
          avatar: post.client?.avatar_url || fallbackProfileImage,
          specialty: 'Client Brief',
          image: post.image_url || fallbackProfileImage,
          caption: post.caption,
          likes: 0,
          commentsCount: 0,
          timeAgo: toTimeAgo(post.created_at),
          isLiked: false,
          isSaved: false,
          isClientPost: true,
        };
      });

      if (!isMounted) {
        return;
      }

      const combined = [...clientPosts, ...generatedPosts].sort((a, b) => {
        const aTime = a.timeAgo === 'Just now' ? Date.now() : 0;
        const bTime = b.timeAgo === 'Just now' ? Date.now() : 0;
        return bTime - aTime;
      });

      const clientPostIds = clientPosts.map((post) => post.id.replace('client-post-', ''));
      if (clientPostIds.length > 0) {
        const statsResponse = await DataService.getClientPostLikeStats(clientPostIds, user?.id);
        if (!statsResponse.error && statsResponse.data) {
          const statsMap = new Map(statsResponse.data.map((item: any) => [item.post_id, item]));
          combined.forEach((post) => {
            if (!post.isClientPost) return;
            const postId = post.id.replace('client-post-', '');
            const stat = statsMap.get(postId);
            if (!stat) return;
            post.likes = Number(stat.likes || 0);
            post.commentsCount = Number(stat.comments || 0);
            post.isLiked = !!stat.liked_by_me;
          });
        }
      }

      setPosts(combined);
      setIsLoading(false);
    }

    loadFeed();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedPosts = useMemo(() => posts, [posts]);

  const handleLike = (postId: string) => {
    const target = posts.find((item) => item.id === postId);
    if (!target) return;

    if (target.isClientPost && user?.id) {
      void (async () => {
        const dbPostId = postId.replace('client-post-', '');
        const result = await DataService.toggleClientPostLike(user.id, dbPostId, target.isLiked);
        if (result.error) {
          setError((result.error as any)?.message || 'Unable to update like.');
          return;
        }
      })();
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
          : post
      )
    );
  };

  const loadCommentsForPost = async (postId: string) => {
    const target = posts.find((item) => item.id === postId);
    if (!target?.isClientPost) {
      return;
    }

    const dbPostId = postId.replace('client-post-', '');
    const response = await DataService.getClientPostComments(dbPostId, 40);
    if (response.error) {
      setError((response.error as any)?.message || 'Unable to load comments.');
      return;
    }

    setCommentsByPost((current) => ({
      ...current,
      [postId]: response.data || [],
    }));
  };

  const handleAddComment = async (postId: string) => {
    if (!user?.id) return;
    const target = posts.find((item) => item.id === postId);
    if (!target?.isClientPost) return;

    const content = (commentDraftByPost[postId] || '').trim();
    if (!content) {
      return;
    }

    const response = await DataService.addClientPostComment(
      user.id,
      postId.replace('client-post-', ''),
      content
    );

    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Unable to add comment.');
      return;
    }

    setCommentsByPost((current) => ({
      ...current,
      [postId]: [...(current[postId] || []), response.data],
    }));
    setCommentDraftByPost((current) => ({ ...current, [postId]: '' }));
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post
      )
    );
  };

  const handleSave = (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, isSaved: !post.isSaved } : post
      )
    );
  };

  const handleShare = async (postId: string) => {
    const targetPost = posts.find((item) => item.id === postId);
    const shareUrl = `${window.location.origin}/profile/${targetPost?.authorId || ''}`;
    await navigator.clipboard.writeText(shareUrl);
  };

  const handlePublishClientPost = async () => {
    if (!user?.id || user.role !== 'client') {
      setError('Only client accounts can publish For You posts.');
      return;
    }

    if (!newPostCaption.trim()) {
      setError('Please add a caption before publishing.');
      return;
    }

    setIsPublishing(true);
    setError(null);

    const response = await DataService.createClientPost({
      client_id: user.id,
      caption: newPostCaption.trim(),
      image_url: newPostImageUrl.trim() || null,
    });

    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Unable to publish post.');
      setIsPublishing(false);
      return;
    }

    const created = response.data as any;
    const newFeedPost: FeedPost = {
      id: `client-post-${created.id}`,
      authorId: created.client_id,
      authorName: created.client?.full_name || user.fullName || 'Client',
      username: ((created.client?.email || user.email || 'client').split('@')[0] || 'client').toLowerCase(),
      avatar: created.client?.avatar_url || fallbackProfileImage,
      specialty: 'Client Brief',
      image: created.image_url || fallbackProfileImage,
      caption: created.caption,
      likes: 0,
      commentsCount: 0,
      timeAgo: 'Just now',
      isLiked: false,
      isSaved: false,
      isClientPost: true,
    };

    setPosts((current) => [newFeedPost, ...current]);
    setNewPostCaption('');
    setNewPostImageUrl('');
    setIsPublishing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 py-4 md:py-8 -mx-4 md:mx-0">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 md:mb-8 px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">For You</h1>
          <p className="text-sm md:text-base text-gray-600">Live creative feed from freelancer portfolios</p>
        </div>

        {user?.role === 'client' && (
          <div className="mb-6 mx-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-5">
            <h2 className="mb-3 text-lg font-bold text-gray-900">Publish Client Post</h2>
            <textarea
              value={newPostCaption}
              onChange={(event) => setNewPostCaption(event.target.value)}
              placeholder="Share your project brief, inspiration, or hiring needs"
              className="mb-3 min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              value={newPostImageUrl}
              onChange={(event) => setNewPostImageUrl(event.target.value)}
              placeholder="Optional image URL"
              className="mb-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              onClick={() => void handlePublishClientPost()}
              disabled={isPublishing}
              className="rounded-lg bg-gradient-to-r from-gray-900 to-black px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
            >
              {isPublishing ? 'Publishing...' : 'Publish to For You'}
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 mx-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
          </div>
        )}

        {!isLoading && sortedPosts.length === 0 && (
          <div className="mx-4 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-lg">
            <h2 className="mb-2 text-xl font-bold text-gray-900">No feed posts yet</h2>
            <p className="text-gray-600">Freelancer portfolio posts will appear here as soon as data is available.</p>
          </div>
        )}

        <div className="space-y-4 md:space-y-6">
          {sortedPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl md:rounded-3xl shadow-lg overflow-hidden border border-gray-200">
              <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (post.authorId) {
                      onViewProfile?.(post.authorId);
                    }
                  }}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                    <ImageWithFallback src={post.avatar} alt={post.authorName} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-900">{post.authorName}</h3>
                    <p className="text-sm text-gray-600">@{post.username} • {post.specialty}</p>
                  </div>
                </button>
                <span className="text-sm text-gray-500">{post.timeAgo}</span>
              </div>

              <div className="relative aspect-square bg-gray-100">
                <ImageWithFallback src={post.image} alt={post.caption} className="w-full h-full object-cover" />
              </div>

              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLike(post.id)} className="group flex items-center gap-2 transition-all">
                      <Heart className={`w-7 h-7 transition-all ${post.isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-700 group-hover:scale-110'}`} />
                      <span className="font-semibold text-gray-900">{post.likes}</span>
                    </button>
                    <button
                      onClick={() => {
                        const nextId = expandedCommentsForPost === post.id ? null : post.id;
                        setExpandedCommentsForPost(nextId);
                        if (nextId && post.isClientPost) {
                          void loadCommentsForPost(nextId);
                        }
                      }}
                      className="group flex items-center gap-2 transition-all"
                    >
                      <MessageCircle className="w-7 h-7 text-gray-700 group-hover:scale-110 transition-transform" />
                      <span className="font-semibold text-gray-900">{post.commentsCount}</span>
                    </button>
                    <button onClick={() => void handleShare(post.id)} className="group flex items-center gap-2 transition-all">
                      <Share2 className="w-6 h-6 text-gray-700 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                  <button onClick={() => handleSave(post.id)} className="transition-all">
                    <Bookmark className={`w-6 h-6 transition-all ${post.isSaved ? 'fill-gray-900 text-gray-900 scale-110' : 'text-gray-700 hover:scale-110'}`} />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-gray-900">
                    <button onClick={() => onViewProfile?.(post.authorId)} className="font-bold hover:text-gray-900 transition-colors">
                      @{post.username}
                    </button>{' '}
                    <span>{post.caption}</span>
                  </p>
                </div>

                {expandedCommentsForPost === post.id && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-3">
                    {post.isClientPost ? (
                      <>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {(commentsByPost[post.id] || []).length === 0 ? (
                            <p className="text-xs text-gray-500">No comments yet.</p>
                          ) : (
                            (commentsByPost[post.id] || []).map((comment: any) => (
                              <div key={comment.id} className="rounded-lg bg-white p-2 text-xs text-gray-700">
                                <span className="font-semibold text-gray-900">{comment.user?.full_name || 'User'}:</span>{' '}
                                {comment.content}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={commentDraftByPost[post.id] || ''}
                            onChange={(event) =>
                              setCommentDraftByPost((current) => ({
                                ...current,
                                [post.id]: event.target.value,
                              }))
                            }
                            placeholder="Write a comment"
                            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void handleAddComment(post.id)}
                            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Send
                          </button>
                        </div>
                      </>
                    ) : (
                      <div>Comment threads are not enabled for generated portfolio posts yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
