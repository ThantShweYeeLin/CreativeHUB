import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  Check,
  ChevronDown,
  FileText,
  Globe2,
  Hash,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { DataService } from '../../lib/dataService';
import { dispatchClientPostUpdated, subscribeClientPostUpdated } from '../../lib/clientPostSync';
import { normalizeFreelancer } from '../../lib/freelanceMapper';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import type { Gender } from '../../lib/database.types';
import { PostCard } from '../../components/posts/PostCard';
import { PostDetailModal } from '../../components/posts/PostDetailModal';
import { PhotoViewerModal } from '../../components/posts/PhotoViewerModal';
import { buildCommentThreads, buildMentionPrefill, extractMentionToken, getReplyKey, hasReplyContent } from '../../lib/commentThreads';
import type { CommentItem } from '../../components/posts/CommentsList';

interface ForYouPageProps {
  onViewProfile?: (freelancerId: string) => void;
  onOpenMessages?: (recipientId?: string) => void;
}

type Visibility = 'Public' | 'Followers' | 'Connections';

interface ComposerAttachment {
  id: string;
  name: string;
  type: string;
  previewUrl: string | null;
}

interface ComposerState {
  text: string;
  location: string;
  hashtags: string;
  taggedPeople: string;
  category: string;
  visibility: Visibility;
  attachments: ComposerAttachment[];
}

interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorGender?: Gender | null;
  username: string;
  avatar: string;
  specialty: string;
  image: string | null;
  caption: string;
  likes: number;
  commentsCount: number;
  timeAgo: string;
  createdAtRaw?: string;
  isLiked: boolean;
  isSaved: boolean;
  isClientPost?: boolean;
  location?: string;
  hashtags?: string[];
  mentions?: string[];
  category?: string;
  visibility?: Visibility;
  labels?: string[];
  attachments?: ComposerAttachment[];
  poll?: {
    question: string;
    options: string[];
  } | null;
}

interface FeedComment {
  id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface PlaceSuggestion {
  name: string;
  detail: string;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;
const MAX_POST_LENGTH = 1200;

const categoryOptions = [
  'Photography',
  'Makeup',
  'Fashion',
  'Modeling',
  'Design',
  'Video',
  'Branding',
  'Events',
];

const visibilityOptions: Visibility[] = ['Public', 'Followers', 'Connections'];

const suggestedLocations: PlaceSuggestion[] = [
  { name: 'Bangkok, Thailand', detail: 'Popular city · Thailand' },
  { name: 'Siam Paragon', detail: 'Shopping center · Pathum Wan, Bangkok' },
  { name: 'CentralWorld', detail: 'Shopping center · Ratchaprasong, Bangkok' },
  { name: 'Assumption University Suvarnabhumi Campus', detail: 'University · Bang Bo District' },
  { name: 'Chiang Mai, Thailand', detail: 'Popular city · Northern Thailand' },
  { name: 'Phuket, Thailand', detail: 'Island province · Southern Thailand' },
  { name: 'Hua Hin Beach', detail: 'Beach · Prachuap Khiri Khan' },
  { name: 'CreativeHUB Studio', detail: 'Workspace · Bangkok' },
  { name: 'Remote / Online', detail: 'Available anywhere' },
];

const emptyComposerState: ComposerState = {
  text: '',
  location: '',
  hashtags: '',
  taggedPeople: '',
  category: '',
  visibility: 'Public',
  attachments: [],
};

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

function mapClientPostRowToFeedPost(post: any): FeedPost {
  const authorName = post.client?.full_name || 'Client';
  const username = (post.client?.email || 'client').split('@')[0];
  // client_posts.client_id can belong to a client OR a freelancer —
  // the table name is legacy, not a role guarantee — so the actual
  // poster's role decides the label/behavior, same as a freshly
  // composed post does further down in this file.
  const isFromClient = post.client?.role !== 'freelancer';

  return {
    id: `client-post-${post.id}`,
    authorId: post.client_id,
    authorName,
    authorGender: post.client?.gender || null,
    username,
    avatar: post.client?.avatar_url || fallbackProfileImage,
    specialty: isFromClient ? 'Client Brief' : 'Creative Update',
    image: post.image_url || null,
    caption: post.caption,
    likes: Math.max(0, Number(post.likes_count || 0)),
    commentsCount: Math.max(0, Number(post.comments_count || 0)),
    timeAgo: toTimeAgo(post.created_at),
    createdAtRaw: post.created_at,
    isLiked: !!post.liked_by_me,
    isSaved: !!post.saved_by_me,
    // isClientPost gates whether like/save/share/comment actions have a real
    // row to persist against — true for every entry here regardless of the
    // poster's role, since they all come from an actual client_posts row.
    isClientPost: true,
  };
}

function splitList(value: string, prefix = '') {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `${prefix}${item.replace(/^[@#]/, '')}`);
}

/** Finds the "@word" the caret is currently inside of while typing, or null if none. */
function findActiveMentionToken(text: string, cursor: number): { start: number; query: string } | null {
  const upToCursor = text.slice(0, cursor);
  const match = upToCursor.match(/(?:^|\s)@([a-zA-Z0-9_.]*)$/);
  if (!match) {
    return null;
  }
  const query = match[1];
  return { start: cursor - query.length - 1, query };
}

function buildCaption(state: ComposerState) {
  const details = [
    state.location ? `Location: ${state.location}` : '',
    state.category ? `Category: ${state.category}` : '',
    state.visibility ? `Visibility: ${state.visibility}` : '',
    state.taggedPeople ? `With: ${state.taggedPeople}` : '',
    state.hashtags ? `Hashtags: ${splitList(state.hashtags, '#').join(' ')}` : '',
  ].filter(Boolean);

  return [state.text.trim(), ...details].filter(Boolean).join('\n\n');
}

function isMissingClientPostsTable(error: unknown) {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() || '';
  return message.includes('client_posts') && (message.includes('schema cache') || message.includes('does not exist'));
}

function ComposerLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mx-4 mb-5 flex items-center gap-3 md:mb-6">
      <button
        onClick={onOpen}
        className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-500 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-xl md:text-base"
      >
        Write A Post
      </button>
      <button
        onClick={onOpen}
        aria-label="Create post"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

type ComposerPanel = 'tag' | 'visibility' | 'category' | 'hashtags' | null;

function CreatePostSheet({
  isOpen,
  userName,
  userAvatar,
  userGender,
  currentUserId,
  composer,
  isPublishing,
  onClose,
  onChange,
  onAddFiles,
  onRemoveAttachment,
  onOpenLocationPicker,
  onPublish,
}: {
  isOpen: boolean;
  userName: string;
  userAvatar: string;
  userGender?: Gender | null;
  currentUserId?: string;
  composer: ComposerState;
  isPublishing: boolean;
  onClose: () => void;
  onChange: (updates: Partial<ComposerState>) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  onOpenLocationPicker: () => void;
  onPublish: () => void;
}) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canPost = composer.text.trim().length > 0 || composer.attachments.length > 0;

  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<any[]>([]);
  const [isTagSearching, setIsTagSearching] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [isMentionSearching, setIsMentionSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActivePanel(null);
      setTagQuery('');
      setTagResults([]);
      setMention(null);
      setMentionResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    let isMounted = true;
    const query = tagQuery.trim();
    if (query.length < 2) {
      setTagResults([]);
      setIsTagSearching(false);
      return;
    }
    setIsTagSearching(true);
    const timeoutId = window.setTimeout(async () => {
      const response = await DataService.searchUsers(query, { excludeUserId: currentUserId, limit: 6 });
      if (!isMounted) return;
      setTagResults(response.error ? [] : response.data || []);
      setIsTagSearching(false);
    }, 250);
    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [tagQuery, currentUserId]);

  useEffect(() => {
    let isMounted = true;
    const query = mention?.query.trim() || '';
    if (!mention || query.length < 2) {
      setMentionResults([]);
      setIsMentionSearching(false);
      return;
    }
    setIsMentionSearching(true);
    const timeoutId = window.setTimeout(async () => {
      const response = await DataService.searchUsers(query, { excludeUserId: currentUserId, limit: 6 });
      if (!isMounted) return;
      setMentionResults(response.error ? [] : response.data || []);
      setIsMentionSearching(false);
    }, 250);
    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [mention?.query, currentUserId]);

  if (!isOpen) {
    return null;
  }

  const taggedList = composer.taggedPeople
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const toggleTaggedPerson = (name: string) => {
    const next = taggedList.includes(name)
      ? taggedList.filter((item) => item !== name)
      : [...taggedList, name];
    onChange({ taggedPeople: next.join(', ') });
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    onChange({ text: value });
    const cursor = event.target.selectionStart ?? value.length;
    setMention(findActiveMentionToken(value, cursor));
  };

  const handleTextSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.target as HTMLTextAreaElement;
    setMention(findActiveMentionToken(target.value, target.selectionStart ?? target.value.length));
  };

  const applyMention = (result: any) => {
    if (!mention) return;
    const name = String(result.full_name || result.email || 'user').trim();
    const handle = name.replace(/\s+/g, '');
    const cursor = textareaRef.current?.selectionStart ?? composer.text.length;
    const before = composer.text.slice(0, mention.start);
    const after = composer.text.slice(cursor);
    const inserted = `@${handle} `;
    onChange({ text: `${before}${inserted}${after}` });
    setMention(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const pillButtonClass = (active: boolean) =>
    `flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
      active ? 'border-gray-900 bg-gray-900 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0">
      <div className="fixed inset-x-0 bottom-0 max-h-[96vh] overflow-hidden rounded-t-[2rem] bg-white shadow-2xl animate-in slide-in-from-bottom-8 md:bottom-auto md:left-1/2 md:top-1/2 md:w-[760px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        <div className="flex h-full max-h-[96vh] flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-950">Create Post</h2>
              <p className="text-xs font-medium text-gray-500">{composer.visibility}</p>
            </div>
            <button
              onClick={onPublish}
              disabled={!canPost || isPublishing}
              className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPublishing ? 'Posting...' : 'Post'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-5 flex items-center gap-3">
              <Avatar src={userAvatar} alt={userName} gender={userGender} sizeClassName="h-12 w-12 ring-2 ring-gray-100 rounded-full" />
              <div>
                <h3 className="font-bold text-gray-950">{userName}</h3>
                <p className="text-sm text-gray-500">Share with the CreativeHUB community</p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={onOpenLocationPicker} className={pillButtonClass(!!composer.location)}>
                <MapPin className="h-4 w-4" />
                <span className="max-w-[10rem] truncate">{composer.location || 'Location'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'tag' ? null : 'tag')}
                className={pillButtonClass(taggedList.length > 0 || activePanel === 'tag')}
              >
                <Users className="h-4 w-4" />
                {taggedList.length > 0 ? `Tagged (${taggedList.length})` : 'Tag People'}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'visibility' ? null : 'visibility')}
                className={pillButtonClass(activePanel === 'visibility')}
              >
                <Globe2 className="h-4 w-4" />
                {composer.visibility}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'category' ? null : 'category')}
                className={pillButtonClass(!!composer.category || activePanel === 'category')}
              >
                <Tag className="h-4 w-4" />
                {composer.category || 'Category'}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'hashtags' ? null : 'hashtags')}
                className={pillButtonClass(!!composer.hashtags.trim() || activePanel === 'hashtags')}
              >
                <Hash className="h-4 w-4" />
                {composer.hashtags.trim() ? 'Hashtags added' : 'Hashtags'}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {activePanel && (
              <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                {activePanel === 'tag' && (
                  <div className="space-y-3">
                    {taggedList.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {taggedList.map((name) => (
                          <span key={name} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                            {name}
                            <button type="button" onClick={() => toggleTaggedPerson(name)} className="text-gray-400 hover:text-gray-700">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      value={tagQuery}
                      onChange={(event) => setTagQuery(event.target.value)}
                      placeholder="Search people to tag"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-4 focus:ring-gray-100"
                    />
                    {tagQuery.trim().length >= 2 && (
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                        {isTagSearching ? (
                          <p className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching...</p>
                        ) : tagResults.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-gray-500">No users found.</p>
                        ) : (
                          tagResults.map((result: any) => {
                            const name = result.full_name || result.email;
                            const isTagged = taggedList.includes(name);
                            return (
                              <button
                                key={String(result.id)}
                                type="button"
                                onClick={() => toggleTaggedPerson(name)}
                                className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 last:border-b-0"
                              >
                                <Avatar src={result.avatar_url || fallbackProfileImage} alt={name} gender={result.gender} sizeClassName="h-8 w-8 rounded-full" />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{name}</span>
                                {isTagged && <Check className="h-4 w-4 flex-shrink-0 text-gray-900" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activePanel === 'visibility' && (
                  <div className="grid gap-2">
                    {visibilityOptions.map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => {
                          onChange({ visibility });
                          setActivePanel(null);
                        }}
                        className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                          composer.visibility === visibility ? 'border-gray-900 bg-white text-gray-950' : 'border-transparent bg-white/60 text-gray-600 hover:bg-white'
                        }`}
                      >
                        {visibility}
                        {composer.visibility === visibility && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}

                {activePanel === 'category' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ category: '' });
                        setActivePanel(null);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${!composer.category ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                    >
                      None
                    </button>
                    {categoryOptions.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          onChange({ category });
                          setActivePanel(null);
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${composer.category === category ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                {activePanel === 'hashtags' && (
                  <input
                    autoFocus
                    value={composer.hashtags}
                    onChange={(event) => onChange({ hashtags: event.target.value })}
                    placeholder="#branding #photoshoot"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-4 focus:ring-gray-100"
                  />
                )}
              </div>
            )}

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={composer.text}
                maxLength={MAX_POST_LENGTH}
                onChange={handleTextChange}
                onSelect={handleTextSelect}
                placeholder="What’s happening in your work today? Type @ to mention someone"
                className="min-h-40 w-full resize-none rounded-3xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-950 outline-none transition-all placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:ring-4 focus:ring-gray-100"
              />
              {mention && (
                <div className="absolute left-4 right-4 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
                  {mention.query.trim().length < 2 ? (
                    <p className="px-3 py-3 text-sm text-gray-500">Keep typing to search people...</p>
                  ) : isMentionSearching ? (
                    <p className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching...</p>
                  ) : mentionResults.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-gray-500">No users found.</p>
                  ) : (
                    mentionResults.map((result: any) => (
                      <button
                        key={String(result.id)}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyMention(result);
                        }}
                        className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 last:border-b-0"
                      >
                        <Avatar src={result.avatar_url || fallbackProfileImage} alt={result.full_name || result.email} gender={result.gender} sizeClassName="h-8 w-8 rounded-full" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{result.full_name || result.email}</p>
                          <p className="truncate text-xs text-gray-500">{result.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="mt-2 text-right text-xs font-medium text-gray-500">
              {composer.text.length}/{MAX_POST_LENGTH}
            </div>

            {composer.attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {composer.attachments.map((attachment) => (
                  <div key={attachment.id} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    {attachment.previewUrl ? (
                      attachment.type.startsWith('video/') ? (
                        <video src={attachment.previewUrl} className="h-44 w-full object-cover" controls />
                      ) : (
                        <ImageWithFallback src={attachment.previewUrl} alt={attachment.name} className="h-44 w-full object-cover" />
                      )
                    ) : (
                      <div className="flex h-44 flex-col items-center justify-center gap-2 px-4 text-center text-sm font-semibold text-gray-600">
                        <FileText className="h-8 w-8" />
                        {attachment.name}
                      </div>
                    )}
                    <button
                      onClick={() => onRemoveAttachment(attachment.id)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
              <button type="button" onClick={() => mediaInputRef.current?.click()} title="Photos/Videos" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100">
                <ImagePlus className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} title="Files" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100">
                <Paperclip className="h-5 w-5" />
              </button>
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(event) => onAddFiles(event.target.files)} />
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip" multiple className="hidden" onChange={(event) => onAddFiles(event.target.files)} />
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
            <button onClick={onClose} className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={onPublish}
              disabled={!canPost || isPublishing}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {isPublishing ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationPickerSheet({
  isOpen,
  selectedLocation,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  selectedLocation: string;
  onClose: () => void;
  onSelect: (location: string) => void;
}) {
  const [query, setQuery] = useState(selectedLocation);
  const [geoStatus, setGeoStatus] = useState('');
  const [liveLocations, setLiveLocations] = useState<PlaceSuggestion[]>([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [locationSearchMessage, setLocationSearchMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery(selectedLocation);
      setGeoStatus('');
      setLiveLocations([]);
      setLocationSearchMessage('');
    }
  }, [isOpen, selectedLocation]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setLiveLocations([]);
      setIsSearchingLocations(false);
      setLocationSearchMessage('');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingLocations(true);
      setLocationSearchMessage('');

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=12&q=${encodeURIComponent(trimmedQuery)}`,
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('Location search failed');
        }

        const results = await response.json();
        const places: PlaceSuggestion[] = (Array.isArray(results) ? results : []).map((place: any) => {
          const address = place.address || {};
          const name =
            address.attraction ||
            address.amenity ||
            address.shop ||
            address.tourism ||
            address.building ||
            address.road ||
            address.suburb ||
            address.city ||
            address.town ||
            address.village ||
            place.name ||
            trimmedQuery;
          const detail = [address.road, address.suburb, address.city || address.town || address.village, address.state, address.country]
            .filter(Boolean)
            .join(', ');

          return {
            name,
            detail: detail || place.display_name || 'Search result',
          };
        });

        setLiveLocations(places);
        setLocationSearchMessage(places.length ? '' : 'No matching places found. You can still use your typed location.');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setLiveLocations([]);
          setLocationSearchMessage('Live place search is unavailable. You can still use your typed location.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingLocations(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isOpen, query]);

  if (!isOpen) {
    return null;
  }

  const filteredLocations = suggestedLocations.filter((location) =>
    `${location.name} ${location.detail}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const displayLocations = query.trim().length >= 2
    ? liveLocations.length
      ? liveLocations
      : filteredLocations
    : suggestedLocations;

  const selectLocation = (location: PlaceSuggestion) => {
    onSelect(location.name);
    onClose();
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Current location is not available in this browser.');
      return;
    }

    setGeoStatus('Finding your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(5);
        const longitude = position.coords.longitude.toFixed(5);
        selectLocation({ name: `Current location (${latitude}, ${longitude})`, detail: 'Using your device location' });
      },
      () => setGeoStatus('Could not access your location. Please search or select a place.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md animate-in fade-in-0">
      <div className="fixed inset-x-0 bottom-0 max-h-[94vh] overflow-hidden rounded-t-[2rem] bg-[#111619] text-white shadow-2xl animate-in slide-in-from-bottom-8 md:inset-y-8 md:left-1/2 md:w-[560px] md:-translate-x-1/2 md:rounded-[2rem]">
        <div className="flex max-h-[94vh] flex-col">
          <div className="px-5 pb-4 pt-7">
            <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-gray-500" />
            <div className="mb-7 flex items-center justify-between">
              <button
                onClick={useCurrentLocation}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-inner transition-colors hover:bg-white/10"
                aria-label="Use current location"
              >
                <LocateFixed className="h-7 w-7 fill-white" />
              </button>
              <h2 className="text-xl font-bold text-white">Add Place</h2>
              <button
                onClick={onClose}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                aria-label="Close locations"
              >
                <X className="h-8 w-8" />
              </button>
            </div>

            <div className="mb-6 text-center">
              <h3 className="text-lg font-bold text-white">Pick where this post belongs</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-gray-400">
                Your audience can see the place attached to this post and open it from the feed.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                autoFocus
                className="h-16 w-full rounded-2xl border border-transparent bg-[#293039] py-3 pl-14 pr-12 text-xl font-medium text-white outline-none placeholder:text-gray-400 focus:border-white/10 focus:bg-[#303842]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-gray-500/40 text-gray-200"
                  aria-label="Clear location search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {(geoStatus || isSearchingLocations || locationSearchMessage) && (
              <p className="mt-3 text-center text-xs font-medium text-gray-400">
                {geoStatus || (isSearchingLocations ? 'Searching places...' : locationSearchMessage)}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-7">
            <div className="space-y-1">
              {displayLocations.map((location, index) => (
                <button
                  key={`${location.name}-${index}`}
                  onClick={() => selectLocation(location)}
                  className="w-full rounded-2xl px-1 py-3 text-left transition-colors hover:bg-white/5"
                >
                  <span className="block text-[19px] font-medium leading-6 text-white">{location.name}</span>
                  {location.detail && (
                    <span className="mt-1 block text-[15px] font-medium leading-5 text-gray-400">{location.detail}</span>
                  )}
                </button>
              ))}
            </div>

            {query.trim() && !displayLocations.some((location) => location.name.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                onClick={() => selectLocation({ name: query.trim(), detail: 'Custom location' })}
                className="mt-3 flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-4 text-left"
              >
                <span>
                  <span className="block text-lg font-semibold text-white">{query.trim()}</span>
                  <span className="mt-1 block text-sm text-gray-400">Tag this typed place</span>
                </span>
                <Check className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForYouPage({ onViewProfile, onOpenMessages }: ForYouPageProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeFeedTab, setActiveFeedTab] = useState<'for-you' | 'following'>('for-you');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, FeedComment[]>>({});
  const [loadingCommentsByPostId, setLoadingCommentsByPostId] = useState<Record<string, boolean>>({});
  const [likedUsersByPostId, setLikedUsersByPostId] = useState<Record<string, any[]>>({});
  const [loadingLikesByPostId, setLoadingLikesByPostId] = useState<Record<string, boolean>>({});
  const [likingByPostId, setLikingByPostId] = useState<Record<string, boolean>>({});
  const [showLikesByPostId, setShowLikesByPostId] = useState<Record<string, boolean>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<string, boolean>>({});
  const [replyTargetByPostId, setReplyTargetByPostId] = useState<Record<string, string | null>>({});
  const [replyDraftByCommentKey, setReplyDraftByCommentKey] = useState<Record<string, string>>({});
  const [isSubmittingReplyByCommentKey, setIsSubmittingReplyByCommentKey] = useState<Record<string, boolean>>({});
  const [expandedReplyThreadsByKey, setExpandedReplyThreadsByKey] = useState<Record<string, boolean>>({});
  const [commentFocusToken, setCommentFocusToken] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; isVideo?: boolean } | null>(null);
  const savedScrollYRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [sharingPost, setSharingPost] = useState<FeedPost | null>(null);
  const [mutualUsers, setMutualUsers] = useState<Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null; gender: Gender | null }>>([]);
  const [selectedShareRecipientIds, setSelectedShareRecipientIds] = useState<string[]>([]);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isLoadingMutualUsers, setIsLoadingMutualUsers] = useState(false);
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(null);
  const [copyLinkError, setCopyLinkError] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState>(emptyComposerState);

  const userName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Creative member');
  const userAvatar = user?.avatar_url || fallbackProfileImage;

  useEffect(() => {
    let isMounted = true;

    async function loadFollowing() {
      if (!user?.id) {
        setFollowingIds(new Set());
        return;
      }

      const response = await DataService.getFollowingIds(user.id);
      if (!isMounted) {
        return;
      }

      if (response.error) {
        setFollowingIds(new Set());
        return;
      }

      setFollowingIds(new Set(response.data || []));
    }

    loadFollowing();

    return () => {
      isMounted = false;
    };
    // Also refetch whenever the user switches to the Following tab, so a follow
    // made elsewhere (e.g. on a profile page) shows up without a full reload.
  }, [user?.id, activeFeedTab]);

  useEffect(() => {
    let isMounted = true;

    async function loadFollowingPosts() {
      if (activeFeedTab !== 'following' || !user?.id || followingIds.size === 0) {
        return;
      }

      const response = await DataService.getClientPostsByAuthorIds([...followingIds], 60, user.id);
      if (!isMounted || response.error) {
        return;
      }

      const followingPosts = (response.data || []).map(mapClientPostRowToFeedPost);
      setPosts((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        const newPosts = followingPosts.filter((post) => !existingIds.has(post.id));
        return newPosts.length > 0 ? [...current, ...newPosts] : current;
      });
    }

    loadFollowingPosts();

    return () => {
      isMounted = false;
    };
    // Posts authored by people you follow aren't guaranteed to already be in the
    // general "for you" pool (that pool is capped to the newest 30 posts / top 40
    // discoverable freelancers), so fetch them directly by author instead of only
    // filtering whatever happened to load already.
  }, [activeFeedTab, followingIds, user?.id]);

  useEffect(() => {
    const state = location.state as { openPostId?: string } | null;
    const requestedPostId = state?.openPostId || null;
    if (!requestedPostId) {
      return;
    }

    setFocusedPostId(requestedPostId);
  }, [location.state]);

  useEffect(() => {
    if (!focusedPostId || commentsByPostId[focusedPostId]) {
      return;
    }

    loadCommentsForPost(focusedPostId).catch(() => {});
  }, [focusedPostId, commentsByPostId]);

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(async () => {
      const query = userSearchQuery.trim();
      if (query.length < 2) {
        setUserSearchResults([]);
        setIsUserSearchLoading(false);
        return;
      }

      setIsUserSearchLoading(true);
      const response = await DataService.searchUsers(query, { excludeUserId: user?.id, limit: 8 });

      if (!isMounted) {
        return;
      }

      setUserSearchResults(response.error ? [] : response.data || []);
      setIsUserSearchLoading(false);
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [userSearchQuery, user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      setIsLoading(true);
      setError(null);

      const [freelancersResponse, clientPostsResponse] = await Promise.all([
        DataService.getAllFreelancers(40),
        DataService.getClientPosts(30, user?.id),
      ]);

      const clientPostsTableMissing = isMissingClientPostsTable(clientPostsResponse.error);

      if (freelancersResponse.error && clientPostsResponse.error && !clientPostsTableMissing) {
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
          authorGender: freelancer.gender,
          username,
          avatar: freelancer.profileImage || fallbackProfileImage,
          specialty,
          image: project.imageUrl,
          caption: project.description || `${project.title} by ${freelancer.fullName}.`,
          likes: project.likes ?? Math.max(5, Math.round(freelancer.rating * 30) + index * 3),
          commentsCount: project.comments ?? Math.max(1, Math.round(freelancer.totalReviews / 4) + index),
          timeAgo: toTimeAgo(project.createdAt),
          createdAtRaw: project.createdAt,
          isLiked: false,
          isSaved: false,
        }));
      }).slice(0, 30);

      const clientPosts: FeedPost[] = (clientPostsTableMissing ? [] : clientPostsResponse.data || []).map(mapClientPostRowToFeedPost);

      const demoPosts: FeedPost[] = [
        {
          id: 'demo-client-post-1',
          authorId: 'demo-client-1',
          authorName: 'Demo Client',
          username: 'demo_client',
          avatar: fallbackProfileImage,
          specialty: 'Client Brief',
          image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
          caption: 'Demo post: Looking for a photographer for a street style campaign in Bangkok.',
          likes: 6,
          commentsCount: 2,
          timeAgo: 'Just now',
          createdAtRaw: new Date().toISOString(),
          isLiked: false,
          isSaved: false,
          isClientPost: true,
        },
        {
          id: 'demo-client-post-2',
          authorId: 'demo-client-2',
          authorName: 'Demo Brand Team',
          username: 'demo_brand_team',
          avatar: fallbackProfileImage,
          specialty: 'Client Brief',
          image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80',
          caption: 'Demo post: Seeking a motion designer for a short-form launch teaser next week.',
          likes: 4,
          commentsCount: 1,
          timeAgo: 'Just now',
          createdAtRaw: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          isLiked: false,
          isSaved: false,
          isClientPost: true,
        },
        {
          id: 'demo-client-post-3',
          authorId: 'demo-client-3',
          authorName: 'Demo Events Co.',
          username: 'demo_events',
          avatar: fallbackProfileImage,
          specialty: 'Client Brief',
          image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
          caption: 'Demo post: Need a makeup artist for an editorial shoot this Friday.',
          likes: 9,
          commentsCount: 3,
          timeAgo: '1h ago',
          createdAtRaw: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          isLiked: false,
          isSaved: false,
          isClientPost: true,
        },
      ];

      if (!isMounted) {
        return;
      }

      const combinedPosts = [...clientPosts, ...generatedPosts];
      setPosts(combinedPosts.length > 0 ? combinedPosts : demoPosts);
      setIsLoading(false);
    }

    loadFeed();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const sortedPosts = useMemo(() => {
    const source = activeFeedTab === 'following'
      ? posts.filter((post) => followingIds.has(post.authorId))
      : posts;

    return [...source].sort((a, b) => {
      const left = a.createdAtRaw ? new Date(a.createdAtRaw).getTime() : 0;
      const right = b.createdAtRaw ? new Date(b.createdAtRaw).getTime() : 0;
      return right - left;
    });
  }, [posts, activeFeedTab, followingIds]);

  const focusedPost = useMemo(
    () => posts.find((post) => post.id === focusedPostId) || null,
    [posts, focusedPostId]
  );

  const focusedCommentThreads = useMemo(
    () => buildCommentThreads(focusedPostId ? commentsByPostId[focusedPostId] || [] : []),
    [commentsByPostId, focusedPostId]
  );

  const handleLike = async (postId: string) => {
    if (likingByPostId[postId]) {
      return;
    }

    const targetPost = posts.find((post) => post.id === postId);
    if (!targetPost) {
      return;
    }

    setLikingByPostId((current) => ({ ...current, [postId]: true }));

    const nextLiked = !targetPost.isLiked;
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, isLiked: nextLiked, likes: nextLiked ? post.likes + 1 : Math.max(0, post.likes - 1) }
          : post
      )
    );

    if (!targetPost.isClientPost || !user?.id) {
      setLikingByPostId((current) => ({ ...current, [postId]: false }));
      return;
    }

    const clientPostId = postId.replace(/^client-post-/, '');
    const response = await DataService.toggleClientPostLike(user.id, clientPostId, targetPost.isLiked);
    if (response.error) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, isLiked: targetPost.isLiked, likes: targetPost.likes }
            : post
        )
      );
      setError((response.error as any).message || 'Unable to update like.');
      setLikingByPostId((current) => ({ ...current, [postId]: false }));
      return;
    }

    dispatchClientPostUpdated(postId);
    setLikingByPostId((current) => ({ ...current, [postId]: false }));
  };

  const handleSave = async (postId: string) => {
    const targetPost = posts.find((post) => post.id === postId);
    if (!targetPost) {
      return;
    }

    const nextSaved = !targetPost.isSaved;
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, isSaved: nextSaved } : post
      )
    );

    if (!targetPost.isClientPost || !user?.id) {
      return;
    }

    const clientPostId = postId.replace(/^client-post-/, '');
    const response = await DataService.toggleClientPostSave(user.id, clientPostId, targetPost.isSaved);
    if (response.error) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, isSaved: targetPost.isSaved } : post
        )
      );
      setError((response.error as any).message || 'Unable to update save.');
    }
  };

  const submitComment = async (postId: string) => {
    const draft = (commentDraftByPostId[postId] || '').trim();
    const post = posts.find((item) => item.id === postId);

    if (!draft || !user?.id || !post) {
      return;
    }

    setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: true }));

    let nextComment: FeedComment | null = null;

    if (post.isClientPost) {
      const clientPostId = postId.replace(/^client-post-/, '');
      const response = await DataService.addClientPostComment(user.id, clientPostId, draft);
      if (response.error) {
        setError((response.error as any).message || 'Unable to add comment.');
        setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: false }));
        return;
      }
      nextComment = response.data;
    } else {
      nextComment = {
        id: `local-comment-${Date.now()}`,
        content: draft,
        created_at: new Date().toISOString(),
        user: {
          id: user.id,
          full_name: user.fullName || user.email || 'You',
          avatar_url: user.avatar_url || null,
        },
      };
    }

    setCommentsByPostId((current) => ({
      ...current,
      [postId]: [...(current[postId] || []), ...(nextComment ? [nextComment as FeedComment] : [])],
    }));
    setPosts((current) =>
      current.map((item) =>
        item.id === postId ? { ...item, commentsCount: item.commentsCount + 1 } : item
      )
    );
    setCommentDraftByPostId((current) => ({ ...current, [postId]: '' }));
    setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: false }));
    dispatchClientPostUpdated(postId);
  };

  const renderCommentContent = (content: string) => {
    const mention = extractMentionToken(content);
    if (!mention) {
      return <span className="whitespace-pre-wrap">{content}</span>;
    }

    const mentionText = `@${mention}`;
    const rest = content.trim().slice(mentionText.length).trim();
    return (
      <span className="whitespace-pre-wrap">
        <span className="font-bold text-gray-900">{mentionText}</span>
        {rest ? ` ${rest}` : ''}
      </span>
    );
  };

  const replyToComment = (postId: string, rootComment: FeedComment | CommentItem, mentionAuthor?: FeedComment | CommentItem) => {
    const targetCommentId = String(rootComment.id);
    const replyKey = getReplyKey(postId, targetCommentId);
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
      [replyKey]: buildMentionPrefill(mentionSource.user?.full_name),
    }));
  };

  const submitReply = async (postId: string, comment: FeedComment | CommentItem) => {
    const post = posts.find((item) => item.id === postId);
    if (!post || !user?.id) {
      return;
    }

    const commentId = String(comment.id);
    const replyKey = getReplyKey(postId, commentId);
    const draft = replyDraftByCommentKey[replyKey] || '';
    if (!hasReplyContent(draft)) {
      return;
    }

    const content = draft.trim();

    setIsSubmittingReplyByCommentKey((current) => ({ ...current, [replyKey]: true }));

    let nextComment: FeedComment | null = null;
    if (post.isClientPost) {
      const clientPostId = postId.replace(/^client-post-/, '');
      const response = await DataService.addClientPostComment(user.id, clientPostId, content);
      if (response.error) {
        setError((response.error as any).message || 'Unable to add reply.');
        setIsSubmittingReplyByCommentKey((current) => ({ ...current, [replyKey]: false }));
        return;
      }
      nextComment = response.data;
    } else {
      nextComment = {
        id: `local-comment-${Date.now()}`,
        content,
        created_at: new Date().toISOString(),
        user: {
          id: user.id,
          full_name: user.fullName || user.email || 'You',
          avatar_url: user.avatar_url || null,
        },
      };
    }

    setCommentsByPostId((current) => ({
      ...current,
      [postId]: [...(current[postId] || []), ...(nextComment ? [nextComment as FeedComment] : [])],
    }));
    setPosts((current) =>
      current.map((item) =>
        item.id === postId ? { ...item, commentsCount: item.commentsCount + 1 } : item
      )
    );
    setReplyDraftByCommentKey((current) => ({ ...current, [replyKey]: '' }));
    setReplyTargetByPostId((current) => ({ ...current, [postId]: null }));
    setIsSubmittingReplyByCommentKey((current) => ({ ...current, [replyKey]: false }));
    dispatchClientPostUpdated(postId);
  };

  const openPostFocus = (postId: string, options?: { focusComment?: boolean }) => {
    if (savedScrollYRef.current === null) {
      savedScrollYRef.current = window.scrollY;
    }
    setFocusedPostId(postId);
    if (options?.focusComment) {
      setCommentFocusToken((token) => token + 1);
    }
    if (!commentsByPostId[postId]) {
      void loadCommentsForPost(postId);
    }
  };

  const closePostFocus = () => {
    setFocusedPostId(null);
    if (savedScrollYRef.current !== null) {
      const y = savedScrollYRef.current;
      savedScrollYRef.current = null;
      window.scrollTo(0, y);
    }
  };

  const loadCommentsForPost = async (postId: string) => {
    if (loadingCommentsByPostId[postId]) {
      return;
    }

    const post = posts.find((item) => item.id === postId);
    if (!post) {
      return;
    }

    if (!post.isClientPost) {
      setCommentsByPostId((current) => ({ ...current, [postId]: [] }));
      return;
    }

    const clientPostId = postId.replace(/^client-post-/, '');
    setLoadingCommentsByPostId((current) => ({ ...current, [postId]: true }));

    const response = await DataService.getClientPostComments(clientPostId, 100);
    if (response.error) {
      setError((response.error as any).message || 'Unable to load comments.');
      setCommentsByPostId((current) => ({ ...current, [postId]: [] }));
    } else {
      setCommentsByPostId((current) => ({ ...current, [postId]: response.data || [] }));
    }

    setLoadingCommentsByPostId((current) => ({ ...current, [postId]: false }));
  };

  useEffect(() => {
    const state = location.state as { openPostId?: string } | null;
    const requestedPostId = state?.openPostId || null;
    if (!requestedPostId) {
      return;
    }

    setFocusedPostId(requestedPostId);
    loadCommentsForPost(requestedPostId).catch(() => {});
  }, [location.state]);

  useEffect(() => {
    const unsubscribe = subscribeClientPostUpdated((postId) => {
      if (focusedPostId === postId) {
        void loadPostLikes(postId);
        void loadCommentsForPost(postId);
      }
    });

    return unsubscribe;
  }, [focusedPostId, commentsByPostId]);

  const loadPostLikes = async (postId: string) => {
    if (loadingLikesByPostId[postId]) {
      return;
    }

    setLoadingLikesByPostId((current) => ({ ...current, [postId]: true }));
    const clientPostId = postId.replace(/^client-post-/, '');
    const response = await DataService.getClientPostLikeUsers(clientPostId);

    if (response.error) {
      setError((response.error as any).message || 'Unable to load likes.');
      setLikedUsersByPostId((current) => ({ ...current, [postId]: [] }));
    } else {
      setLikedUsersByPostId((current) => ({ ...current, [postId]: response.data || [] }));
    }

    setLoadingLikesByPostId((current) => ({ ...current, [postId]: false }));
  };

  const openLikesForPost = async (postId: string) => {
    const targetPost = posts.find((item) => item.id === postId);
    setShowLikesByPostId((current) => ({ ...current, [postId]: !current[postId] }));

    if (!targetPost?.isClientPost) {
      setLikedUsersByPostId((current) => ({ ...current, [postId]: [] }));
      return;
    }

    await loadPostLikes(postId);
  };

  const handleShare = async (postId: string) => {
    if (!user?.id) {
      return;
    }

    const post = posts.find((item) => item.id === postId);
    if (!post) {
      return;
    }

    if (post.isClientPost) {
      const clientPostId = postId.replace(/^client-post-/, '');
      const shareRecord = await DataService.recordClientPostShare(user.id, clientPostId);
      if (shareRecord.error) {
        const message = String((shareRecord.error as any).message || '').toLowerCase();
        if (!message.includes('row-level security policy')) {
          setError((shareRecord.error as any).message || 'Unable to share this post.');
        }
      }
    }

    setSharingPost(post);
    setIsShareSheetOpen(true);
    setIsLoadingMutualUsers(true);
    setSelectedShareRecipientIds([]);
    setShareStatusMessage(null);
    setCopyLinkError(null);

    const response = await DataService.getMutualUsers(user.id);
    if (response.error) {
      setMutualUsers([]);
      setError((response.error as any).message || 'Unable to load mutuals for sharing.');
    } else {
      setMutualUsers(response.data || []);
    }

    setIsLoadingMutualUsers(false);
  };

  const copyShareLink = async () => {
    if (!sharingPost) {
      return;
    }

    // Copy just the URL, not the caption too — appending the caption after a
    // newline meant pasting it anywhere that collapses whitespace (an address
    // bar, a single-line field) turned it into one garbled, non-URL string.
    const text = `${window.location.origin}/profile/${sharingPost.authorId}`;
    setCopyLinkError(null);

    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(text);
      setShareStatusMessage('Post link copied to clipboard.');
      return;
    } catch {
      // Fall through to the legacy fallback below (older browsers, or a
      // non-HTTPS/non-localhost origin where the async Clipboard API doesn't exist).
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let fallbackWorked = false;
    try {
      fallbackWorked = document.execCommand('copy');
    } catch {
      fallbackWorked = false;
    }
    document.body.removeChild(textarea);

    if (fallbackWorked) {
      setShareStatusMessage('Post link copied to clipboard.');
    } else {
      setCopyLinkError('Could not copy automatically — select and copy the link below.');
    }
  };

  const sendShareToMutuals = async () => {
    if (!user?.id || !sharingPost || selectedShareRecipientIds.length === 0) {
      return;
    }

    setIsSendingShare(true);
    setError(null);

    const shareUrl = `${window.location.origin}/profile/${sharingPost.authorId}`;
    const sharedPostPayload = {
      postId: sharingPost.id,
      authorName: sharingPost.authorName,
      authorId: sharingPost.authorId,
      shareUrl,
      caption: sharingPost.caption,
      imageUrl: sharingPost.image || null,
    };
    const message = `SHARED_POST::${JSON.stringify(sharedPostPayload)}`;

    const recipients = mutualUsers.filter((mutual) => selectedShareRecipientIds.includes(mutual.id));

    for (const mutual of recipients) {
      const conversationResponse = await DataService.ensureConversation(user.id, mutual.id);
      if (conversationResponse.error || !conversationResponse.data) {
        continue;
      }

      await DataService.sendMessage({
        conversation_id: conversationResponse.data.id,
        sender_id: user.id,
        recipient_id: mutual.id,
        content: message,
        read: false,
      } as any);
    }

    setIsSendingShare(false);
    setIsShareSheetOpen(false);
    setSharingPost(null);
    setMutualUsers([]);
    setSelectedShareRecipientIds([]);
    setShareStatusMessage(
      recipients.length === 1
        ? `Shared with ${recipients[0].full_name || recipients[0].email}.`
        : `Shared with ${recipients.length} mutuals.`
    );
  };

  const handleAddFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const nextAttachments = Array.from(files).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type || 'application/octet-stream',
      previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null,
    }));

    setComposer((current) => ({
      ...current,
      attachments: [...current.attachments, ...nextAttachments],
    }));
  };

  const handleRemoveAttachment = (id: string) => {
    setComposer((current) => {
      const attachment = current.attachments.find((item) => item.id === id);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      return {
        ...current,
        attachments: current.attachments.filter((item) => item.id !== id),
      };
    });
  };

  const resetComposer = () => {
    composer.attachments.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
    setComposer(emptyComposerState);
  };

  const handlePublishPost = async () => {
    if (!user?.id) {
      setError('Please sign in before publishing a post.');
      setIsComposerOpen(false);
      return;
    }

    const caption = buildCaption(composer);
    if (!caption && composer.attachments.length === 0) {
      setError('Please add text, media, or a file before posting.');
      return;
    }

    setIsPublishing(true);
    setError(null);

    const firstMedia = composer.attachments.find((attachment) => attachment.previewUrl)?.previewUrl || null;
    let createdId = `local-post-${Date.now()}`;
    let createdAt = 'Just now';
    let createdAtRaw = new Date().toISOString();

    if (user.role === 'client') {
      const response = await DataService.createClientPost({
        client_id: user.id,
        caption,
        image_url: firstMedia,
      });

      if (response.error && !isMissingClientPostsTable(response.error)) {
        setError((response.error as any)?.message || 'Unable to publish post.');
        setIsPublishing(false);
        return;
      }

      if (response.data) {
        createdId = `client-post-${(response.data as any).id}`;
        createdAt = toTimeAgo((response.data as any).created_at);
        createdAtRaw = String((response.data as any).created_at || createdAtRaw);
      }
    }

    const hashtags = splitList(composer.hashtags, '#');
    const mentions = Array.from(new Set((composer.text.match(/@[a-zA-Z0-9_.]+/g) || []).map((token) => token.slice(1))));
    const newFeedPost: FeedPost = {
      id: createdId,
      authorId: user.id,
      authorName: userName,
      authorGender: user.gender,
      username: ((user.email || userName).split('@')[0] || userName).toLowerCase().replace(/\s+/g, '_'),
      avatar: userAvatar,
      specialty: user.role === 'client' ? 'Client Brief' : 'Creative Update',
      image: firstMedia,
      caption: composer.text.trim() || caption,
      likes: 0,
      commentsCount: 0,
      timeAgo: createdAt,
      createdAtRaw,
      isLiked: false,
      isSaved: false,
      isClientPost: user.role === 'client',
      location: composer.location.trim() || undefined,
      hashtags,
      mentions,
      category: composer.category || undefined,
      visibility: composer.visibility,
      attachments: composer.attachments,
    };

    setPosts((current) => [newFeedPost, ...current]);
    setIsPublishing(false);
    setIsComposerOpen(false);
    setComposer(emptyComposerState);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 py-4 md:py-8 -mx-4 md:mx-0">
      <div className="mx-auto max-w-2xl">
        {shareStatusMessage && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-sm">
            {shareStatusMessage}
          </div>
        )}

        <div className="mb-6 px-4 md:mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 md:text-4xl">For You</h1>
          <p className="text-sm text-gray-600 md:text-base">Live creative feed from the CreativeHUB community</p>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                placeholder="Search users by name or email"
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-gray-300 focus:bg-white"
              />
            </div>

            {(userSearchQuery.trim().length >= 2 || isUserSearchLoading) && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {isUserSearchLoading ? (
                  <p className="px-3 py-3 text-sm text-gray-500">Searching users...</p>
                ) : userSearchResults.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500">No users found.</p>
                ) : (
                  userSearchResults.map((result: any) => (
                    <button
                      key={String(result.id)}
                      onClick={() => {
                        setUserSearchQuery('');
                        setUserSearchResults([]);
                        onViewProfile?.(String(result.id));
                      }}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors hover:bg-gray-50 last:border-b-0"
                    >
                      <Avatar src={result.avatar_url || fallbackProfileImage} alt={result.full_name || result.email} gender={result.gender} sizeClassName="h-9 w-9 ring-1 ring-gray-200 rounded-full" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{result.full_name || result.email}</p>
                        <p className="truncate text-xs text-gray-500">{result.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="mt-4 inline-flex rounded-xl border border-gray-200 bg-white p-1">
            <button
              onClick={() => setActiveFeedTab('for-you')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeFeedTab === 'for-you' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              For You
            </button>
            <button
              onClick={() => setActiveFeedTab('following')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeFeedTab === 'following' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              Following
            </button>
          </div>
        </div>

        <ComposerLauncher onOpen={() => setIsComposerOpen(true)} />

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
            <p className="text-gray-600">
              {activeFeedTab === 'following'
                ? 'Follow creators from their profile to see posts here.'
                : 'Client requests, freelancer showcases, and community updates will appear here.'}
            </p>
          </div>
        )}

        <div className="space-y-4 md:space-y-6">
          {sortedPosts.map((post) => {
            const isVideoPost = !!(post.image?.startsWith('blob:') && post.attachments?.find((attachment) => attachment.previewUrl === post.image)?.type.startsWith('video/'));
            const hasBadges = post.location || post.category || post.visibility || (post.labels?.length ?? 0) > 0;
            const hasExtras =
              (post.hashtags?.length ?? 0) > 0 ||
              (post.mentions?.length ?? 0) > 0 ||
              !!post.poll ||
              (post.attachments?.filter((attachment) => !attachment.previewUrl).length ?? 0) > 0 ||
              !!showLikesByPostId[post.id];

            return (
              <PostCard
                key={post.id}
                authorName={post.authorName}
                authorAvatarUrl={post.avatar}
                authorSubtitle={`@${post.username} • ${post.specialty}`}
                onViewAuthor={() => onViewProfile?.(post.authorId)}
                createdAtLabel={post.timeAgo}
                badges={
                  hasBadges ? (
                    <>
                      {post.location && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{post.location}</span>}
                      {post.category && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{post.category}</span>}
                      {post.visibility && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{post.visibility}</span>}
                      {post.labels?.map((label) => <span key={label} className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">{label}</span>)}
                    </>
                  ) : undefined
                }
                imageUrl={post.image}
                isVideo={isVideoPost}
                onOpenPost={() => post.image && setViewingPhoto({ url: post.image, isVideo: isVideoPost })}
                caption={post.caption}
                afterCaption={
                  hasExtras ? (
                    <>
                      {((post.hashtags?.length ?? 0) > 0 || (post.mentions?.length ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-2 text-sm font-semibold">
                          {post.hashtags?.map((tag) => <span key={tag} className="text-gray-900">{tag}</span>)}
                          {post.mentions?.map((mention) => <span key={mention} className="text-gray-500">{mention}</span>)}
                        </div>
                      )}
                      {post.poll && (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="mb-3 font-bold text-gray-900">{post.poll.question}</p>
                          <div className="space-y-2">
                            {post.poll.options.map((option) => (
                              <div key={option} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                                {option}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(post.attachments?.filter((attachment) => !attachment.previewUrl).length ?? 0) > 0 && (
                        <div className="space-y-2">
                          {post.attachments?.filter((attachment) => !attachment.previewUrl).map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                              <FileText className="h-4 w-4" />
                              {attachment.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {showLikesByPostId[post.id] ? (
                        <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                          <p className="mb-2 font-semibold text-gray-900">Liked by</p>
                          {loadingLikesByPostId[post.id] ? (
                            <p className="text-sm text-gray-500">Loading likes...</p>
                          ) : (likedUsersByPostId[post.id] || []).length === 0 ? (
                            <p className="text-sm text-gray-500">No visible liker accounts for this post yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-3">
                              {(likedUsersByPostId[post.id] || []).map((likedUser) => (
                                <button
                                  key={likedUser.id}
                                  type="button"
                                  onClick={() => onViewProfile?.(String(likedUser.id))}
                                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm transition hover:bg-gray-100"
                                >
                                  <Avatar
                                    src={likedUser.avatar_url || fallbackProfileImage}
                                    alt={likedUser.full_name || likedUser.email || 'User'}
                                    gender={likedUser.gender}
                                    sizeClassName="h-8 w-8 rounded-full"
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{likedUser.full_name || likedUser.email || 'Unknown'}</p>
                                    <p className="text-xs text-gray-500">@{String(likedUser.email || '').split('@')[0]}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : undefined
                }
                likesCount={post.likes}
                liked={post.isLiked}
                onToggleLike={() => void handleLike(post.id)}
                onShowLikes={() => void openLikesForPost(post.id)}
                commentsCount={post.commentsCount}
                onOpenComment={() => openPostFocus(post.id, { focusComment: true })}
                onShare={() => void handleShare(post.id)}
                saved={post.isSaved}
                onToggleSave={() => void handleSave(post.id)}
              />
            );
          })}
        </div>
      </div>

      {focusedPost && (
        <PostDetailModal
          onClose={closePostFocus}
          showPostContent={false}
          authorName={focusedPost.authorName}
          authorAvatarUrl={focusedPost.avatar}
          authorSubtitle={`@${focusedPost.username} • ${focusedPost.specialty}`}
          onViewAuthor={() => onViewProfile?.(focusedPost.authorId)}
          createdAtLabel={focusedPost.timeAgo}
          caption={focusedPost.caption}
          imageUrl={focusedPost.image || undefined}
          isVideo={!!(focusedPost.image?.startsWith('blob:') && focusedPost.attachments?.find((attachment) => attachment.previewUrl === focusedPost.image)?.type.startsWith('video/'))}
          afterCaption={
            focusedPost.location ? (
              <div className="rounded-2xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{focusedPost.location}</div>
            ) : undefined
          }
          likesCount={focusedPost.likes}
          liked={focusedPost.isLiked}
          onToggleLike={() => void handleLike(focusedPost.id)}
          saved={focusedPost.isSaved}
          onToggleSave={() => void handleSave(focusedPost.id)}
          onShare={() => void handleShare(focusedPost.id)}
          likedUsers={likedUsersByPostId[focusedPost.id] || []}
          loadingLikedUsers={!!loadingLikesByPostId[focusedPost.id]}
          showLikedUsers={!!showLikesByPostId[focusedPost.id]}
          onToggleShowLikedUsers={() => void openLikesForPost(focusedPost.id)}
          onViewLikedUser={(userId) => onViewProfile?.(userId)}
          commentsCount={focusedPost.commentsCount}
          comments={focusedCommentThreads.roots}
          loadingComments={!!loadingCommentsByPostId[focusedPost.id]}
          canComment={!!focusedPost.isClientPost}
          fallbackAvatarUrl={fallbackProfileImage}
          renderCommentContent={renderCommentContent}
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
          currentUserAvatarUrl={userAvatar}
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
        <PhotoViewerModal url={viewingPhoto.url} isVideo={viewingPhoto.isVideo} onClose={() => setViewingPhoto(null)} />
      )}

      {isShareSheetOpen && sharingPost && (
        <div className="fixed inset-0 z-[70] animate-in fade-in-0 bg-black/50 backdrop-blur-sm">
          <div className="fixed inset-x-4 top-20 mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl md:top-24 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Share post</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">Send this post</h3>
                <p className="mt-1 text-sm text-gray-600">Choose specific mutuals, copy a link, or send to selected users in messages.</p>
              </div>
              <button onClick={() => setIsShareSheetOpen(false)} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0">
                  <div className="h-full w-full overflow-hidden rounded-xl">
                    <ImageWithFallback src={sharingPost.avatar} alt={sharingPost.authorName} className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{sharingPost.authorName}</p>
                  <p className="line-clamp-2 text-xs text-gray-600">{sharingPost.caption}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void copyShareLink()}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-gray-900">Copy link</p>
                <p className="mt-1 text-xs text-gray-500">Copies the post link so you can paste it anywhere.</p>
              </button>

              <button
                type="button"
                onClick={() => void sendShareToMutuals()}
                disabled={isLoadingMutualUsers || isSendingShare || selectedShareRecipientIds.length === 0}
                className="rounded-2xl bg-gray-900 px-4 py-3 text-left text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-semibold">Send in messages</p>
                <p className="mt-1 text-xs text-white/75">
                  {isLoadingMutualUsers
                    ? 'Loading mutuals...'
                    : selectedShareRecipientIds.length > 0
                      ? `Send to ${selectedShareRecipientIds.length} selected user${selectedShareRecipientIds.length === 1 ? '' : 's'}.`
                      : 'Pick recipients first.'}
                </p>
              </button>
            </div>

            {shareStatusMessage && (
              <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">{shareStatusMessage}</p>
            )}
            {copyLinkError && (
              <div className="mt-3 space-y-2">
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{copyLinkError}</p>
                <input
                  readOnly
                  value={`${window.location.origin}/profile/${sharingPost.authorId}`}
                  onFocus={(event) => event.target.select()}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                />
              </div>
            )}

            <div className="mt-4 max-h-56 overflow-y-auto rounded-2xl border border-gray-200 bg-white">
              {isLoadingMutualUsers ? (
                <p className="px-4 py-3 text-sm text-gray-500">Finding mutual connections...</p>
              ) : mutualUsers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">You do not have any mutual connections yet.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedShareRecipientIds(mutualUsers.map((mutual) => mutual.id))}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedShareRecipientIds([])}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Clear
                    </button>
                  </div>

                  {mutualUsers.map((mutual) => {
                    const isSelected = selectedShareRecipientIds.includes(mutual.id);
                    return (
                      <button
                        key={mutual.id}
                        type="button"
                        onClick={() =>
                          setSelectedShareRecipientIds((current) =>
                            current.includes(mutual.id)
                              ? current.filter((id) => id !== mutual.id)
                              : [...current, mutual.id]
                          )
                        }
                        className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                          <Check className="h-3 w-3" />
                        </div>
                        <Avatar src={mutual.avatar_url || fallbackProfileImage} alt={mutual.full_name || mutual.email} gender={mutual.gender} sizeClassName="h-9 w-9 ring-1 ring-gray-200 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{mutual.full_name || mutual.email}</p>
                          <p className="truncate text-xs text-gray-500">{mutual.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsShareSheetOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Close
              </button>
              <button
                type="button"
                onClick={() => void sendShareToMutuals()}
                disabled={isLoadingMutualUsers || isSendingShare || selectedShareRecipientIds.length === 0}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingShare ? 'Sending...' : 'Send to selected users'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreatePostSheet
        isOpen={isComposerOpen}
        userName={userName}
        userAvatar={userAvatar}
        userGender={user?.gender}
        currentUserId={user?.id}
        composer={composer}
        isPublishing={isPublishing}
        onClose={() => {
          setIsComposerOpen(false);
          resetComposer();
        }}
        onChange={(updates) => setComposer((current) => ({ ...current, ...updates }))}
        onAddFiles={handleAddFiles}
        onRemoveAttachment={handleRemoveAttachment}
        onOpenLocationPicker={() => setIsLocationPickerOpen(true)}
        onPublish={() => void handlePublishPost()}
      />
      <LocationPickerSheet
        isOpen={isLocationPickerOpen}
        selectedLocation={composer.location}
        onClose={() => setIsLocationPickerOpen(false)}
        onSelect={(location) => setComposer((current) => ({ ...current, location }))}
      />
    </div>
  );
}
