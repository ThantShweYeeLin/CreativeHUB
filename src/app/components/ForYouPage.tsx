import { Heart, MessageCircle, Share2, Bookmark, Send, Smile, X, Copy, Check } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState } from 'react';

interface ForYouPageProps {
  onViewProfile?: () => void;
}

interface Post {
  id: number;
  author: {
    name: string;
    username: string;
    avatar: string;
    isFreelancer: boolean;
    specialty?: string;
  };
  image: string;
  caption: string;
  likes: number;
  commentsCount: number;
  timeAgo: string;
  isLiked: boolean;
  isSaved: boolean;
}

interface Comment {
  id: number;
  author: {
    name: string;
    avatar: string;
  };
  text: string;
  timeAgo: string;
  likes: number;
}

const mockPosts: Post[] = [
  {
    id: 1,
    author: {
      name: 'Darling Arias',
      username: 'darling_photo',
      avatar: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=200',
      isFreelancer: true,
      specialty: 'Fashion Photographer'
    },
    image: 'https://images.unsplash.com/photo-1758613653735-9d7e87996110?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    caption: 'Golden hour magic ✨ Amazing shoot with @model_lily in Bangkok. The lighting was absolutely perfect!',
    likes: 342,
    commentsCount: 28,
    timeAgo: '2h ago',
    isLiked: false,
    isSaved: false
  },
  {
    id: 2,
    author: {
      name: 'Simran Sood',
      username: 'makeup_simran',
      avatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200',
      isFreelancer: true,
      specialty: 'Makeup Artist'
    },
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800',
    caption: 'Bridal glam for today\'s beautiful bride 💄💕 Natural look with a hint of sparkle!',
    likes: 567,
    commentsCount: 45,
    timeAgo: '5h ago',
    isLiked: true,
    isSaved: false
  },
  {
    id: 3,
    author: {
      name: 'Marcus Chen',
      username: 'marcus_captures',
      avatar: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?w=200',
      isFreelancer: true,
      specialty: 'Photographer'
    },
    image: 'https://images.unsplash.com/photo-1758613653298-738e98658e31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    caption: 'Street photography vibes 📸 Love capturing the essence of Bangkok\'s urban beauty.',
    likes: 198,
    commentsCount: 15,
    timeAgo: '1d ago',
    isLiked: false,
    isSaved: true
  },
  {
    id: 4,
    author: {
      name: 'Daria Magazzu',
      username: 'daria_model',
      avatar: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=200',
      isFreelancer: true,
      specialty: 'Model'
    },
    image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
    caption: 'Behind the scenes from yesterday\'s editorial shoot 🌸 Such an amazing team!',
    likes: 892,
    commentsCount: 67,
    timeAgo: '1d ago',
    isLiked: true,
    isSaved: true
  }
];

const mockComments: { [key: number]: Comment[] } = {
  1: [
    {
      id: 1,
      author: {
        name: 'Laura Chouette',
        avatar: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?w=200'
      },
      text: 'This is absolutely stunning! 😍',
      timeAgo: '1h ago',
      likes: 12
    },
    {
      id: 2,
      author: {
        name: 'James Park',
        avatar: 'https://images.unsplash.com/photo-1643968612613-fd411aecd1fd?w=200'
      },
      text: 'Love the composition and colors!',
      timeAgo: '45m ago',
      likes: 8
    }
  ],
  2: [
    {
      id: 1,
      author: {
        name: 'Mihaela Claudia',
        avatar: 'https://images.unsplash.com/photo-1741544486129-956dec7c89ee?w=200'
      },
      text: 'You\'re so talented! Can I book you for my wedding?',
      timeAgo: '3h ago',
      likes: 5
    }
  ]
};

export function ForYouPage({ onViewProfile }: ForYouPageProps) {
  const [posts, setPosts] = useState(mockPosts);
  const [showComments, setShowComments] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleLike = (postId: number) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const handleSave = (postId: number) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, isSaved: !post.isSaved }
        : post
    ));
  };

  const handleShare = (postId: number) => {
    const shareUrl = `https://creativehub.com/post/${postId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComment = (postId: number) => {
    if (commentText.trim()) {
      // TODO: Add comment logic
      console.log('Adding comment:', commentText, 'to post:', postId);
      setCommentText('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 py-4 md:py-8 -mx-4 md:mx-0">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8 px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">For You</h1>
          <p className="text-sm md:text-base text-gray-600">Discover amazing work from creative freelancers</p>
        </div>

        {/* Feed */}
        <div className="space-y-4 md:space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl md:rounded-3xl shadow-lg overflow-hidden border border-gray-200">
              {/* Post Header */}
              <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                <button
                  onClick={onViewProfile}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                    <ImageWithFallback
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{post.author.name}</h3>
                      {post.author.isFreelancer && (
                        <div className="px-2 py-0.5 bg-gradient-to-r from-gray-900 to-black text-white text-xs font-bold rounded-full">
                          PRO
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      @{post.author.username}
                      {post.author.specialty && ` • ${post.author.specialty}`}
                    </p>
                  </div>
                </button>
                <span className="text-sm text-gray-500">{post.timeAgo}</span>
              </div>

              {/* Post Image */}
              <div className="relative aspect-square bg-gray-100">
                <ImageWithFallback
                  src={post.image}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Post Actions */}
              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLike(post.id)}
                      className="group flex items-center gap-2 transition-all"
                    >
                      <Heart
                        className={`w-7 h-7 transition-all ${
                          post.isLiked
                            ? 'fill-red-500 text-red-500 scale-110'
                            : 'text-gray-700 group-hover:scale-110'
                        }`}
                      />
                      <span className="font-semibold text-gray-900">{post.likes}</span>
                    </button>
                    <button
                      onClick={() => setShowComments(showComments === post.id ? null : post.id)}
                      className="group flex items-center gap-2 transition-all"
                    >
                      <MessageCircle className="w-7 h-7 text-gray-700 group-hover:scale-110 transition-transform" />
                      <span className="font-semibold text-gray-900">{post.commentsCount}</span>
                    </button>
                    <button
                      onClick={() => setShowShareModal(post.id)}
                      className="group flex items-center gap-2 transition-all"
                    >
                      <Share2 className="w-6 h-6 text-gray-700 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(post.id)}
                    className="transition-all"
                  >
                    <Bookmark
                      className={`w-6 h-6 transition-all ${
                        post.isSaved
                          ? 'fill-gray-900 text-gray-900 scale-110'
                          : 'text-gray-700 hover:scale-110'
                      }`}
                    />
                  </button>
                </div>

                {/* Caption */}
                <div className="mb-4">
                  <p className="text-gray-900">
                    <button
                      onClick={onViewProfile}
                      className="font-bold hover:text-gray-900 transition-colors"
                    >
                      @{post.author.username}
                    </button>{' '}
                    <span>{post.caption}</span>
                  </p>
                </div>

                {/* View Comments */}
                {post.commentsCount > 0 && showComments !== post.id && (
                  <button
                    onClick={() => setShowComments(post.id)}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    View all {post.commentsCount} comments
                  </button>
                )}

                {/* Comments Section */}
                {showComments === post.id && (
                  <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                    {mockComments[post.id]?.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                          <ImageWithFallback
                            src={comment.author.avatar}
                            alt={comment.author.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
                          <p className="text-sm">
                            <span className="font-bold text-gray-900">{comment.author.name}</span>{' '}
                            <span className="text-gray-700">{comment.text}</span>
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{comment.timeAgo}</span>
                            <button className="hover:text-gray-700 transition-colors">
                              {comment.likes} likes
                            </button>
                            <button className="hover:text-gray-700 transition-colors font-semibold">
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment */}
                {showComments === post.id && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                      <span className="text-white font-semibold">JD</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full px-4 py-3">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleComment(post.id)}
                        placeholder="Add a comment..."
                        className="flex-1 bg-transparent outline-none text-sm"
                      />
                      <button className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <Smile className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleComment(post.id)}
                        disabled={!commentText.trim()}
                        className="text-gray-900 font-semibold text-sm hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-6 md:mt-8 text-center px-4">
          <button className="px-8 py-3 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg border border-gray-200">
            Load More Posts
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowShareModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-w-md w-full animate-fadeIn">
              <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-gray-900">Share Post</h3>
                  <button
                    onClick={() => setShowShareModal(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-3">
                <button
                  onClick={() => handleShare(showShareModal)}
                  className="w-full flex items-center gap-4 px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    {copied ? (
                      <Check className="w-6 h-6 text-green-600" />
                    ) : (
                      <Copy className="w-6 h-6 text-gray-900" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900">
                      {copied ? 'Link Copied!' : 'Copy Link'}
                    </p>
                    <p className="text-sm text-gray-600">Share via link</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-4 px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Send className="w-6 h-6 text-gray-900" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900">Send Message</p>
                    <p className="text-sm text-gray-600">Share in chat</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
