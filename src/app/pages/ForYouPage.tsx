import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AtSign,
  Bookmark,
  BriefcaseBusiness,
  Check,
  FileText,
  Gift,
  Globe2,
  Hash,
  Heart,
  ImagePlus,
  LocateFixed,
  MapPin,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  Smile,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { DataService } from '../../lib/dataService';
import { normalizeFreelancer } from '../../lib/freelanceMapper';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

interface ForYouPageProps {
  onViewProfile?: (freelancerId: string) => void;
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
  mentions: string;
  taggedPeople: string;
  category: string;
  visibility: Visibility;
  labels: string[];
  pollQuestion: string;
  pollOptions: string;
  gifUrl: string;
  attachments: ComposerAttachment[];
}

interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  username: string;
  avatar: string;
  specialty: string;
  image: string | null;
  caption: string;
  likes: number;
  commentsCount: number;
  timeAgo: string;
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

interface PlaceSuggestion {
  name: string;
  detail: string;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;
const MAX_POST_LENGTH = 1200;

const composerPlaceholders = [
  'Share an update with the community...',
  'What would you like to share today?',
  'Post a project, idea, or achievement...',
  'Looking to hire or showcase your work?',
  'Start a conversation...',
  'Showcase your latest work...',
  'Looking for a freelancer?',
  'Hiring for a new project?',
  'Share your creative journey...',
  'Celebrate your achievement...',
  'Need help with your next project?',
  'Ask the community...',
  'Share tips or inspiration...',
];

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

const labelOptions = [
  'Job Opportunity',
  'Service Promotion',
  'Looking for Freelancer',
  'Looking for Client',
];

const emojiOptions = ['✨', '👏', '🔥', '💡', '🎉', '📸', '🎨', '🤝'];

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
  mentions: '',
  taggedPeople: '',
  category: '',
  visibility: 'Public',
  labels: [],
  pollQuestion: '',
  pollOptions: '',
  gifUrl: '',
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

function splitList(value: string, prefix = '') {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `${prefix}${item.replace(/^[@#]/, '')}`);
}

function buildCaption(state: ComposerState) {
  const details = [
    state.location ? `Location: ${state.location}` : '',
    state.category ? `Category: ${state.category}` : '',
    state.visibility ? `Visibility: ${state.visibility}` : '',
    state.labels.length ? `Tags: ${state.labels.join(', ')}` : '',
    state.taggedPeople ? `With: ${state.taggedPeople}` : '',
    state.hashtags ? `Hashtags: ${splitList(state.hashtags, '#').join(' ')}` : '',
    state.mentions ? `Mentions: ${splitList(state.mentions, '@').join(' ')}` : '',
    state.pollQuestion ? `Poll: ${state.pollQuestion} (${splitList(state.pollOptions).join(' / ')})` : '',
  ].filter(Boolean);

  return [state.text.trim(), ...details].filter(Boolean).join('\n\n');
}

function isMissingClientPostsTable(error: unknown) {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() || '';
  return message.includes('client_posts') && (message.includes('schema cache') || message.includes('does not exist'));
}

function ComposerLauncher({
  avatar,
  name,
  placeholder,
  onOpen,
}: {
  avatar: string;
  name: string;
  placeholder: string;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="mx-4 mb-5 w-[calc(100%-2rem)] rounded-3xl border border-gray-200 bg-white p-4 text-left shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-xl md:mb-6 md:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-gray-100">
          <ImageWithFallback src={avatar} alt={name} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 transition-colors group-hover:bg-white md:text-base">
          {placeholder}
        </div>
        <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-md md:flex">
          <Plus className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold text-gray-600 md:text-sm">
        <span className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-2">
          <ImagePlus className="h-4 w-4" />
          Media
        </span>
        <span className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-2">
          <BriefcaseBusiness className="h-4 w-4" />
          Opportunity
        </span>
        <span className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-2">
          <Hash className="h-4 w-4" />
          Tags
        </span>
      </div>
    </button>
  );
}

function CreatePostSheet({
  isOpen,
  userName,
  userAvatar,
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
  const canPost = composer.text.trim().length > 0 || composer.attachments.length > 0 || composer.gifUrl.trim().length > 0;

  if (!isOpen) {
    return null;
  }

  const toggleLabel = (label: string) => {
    const labels = composer.labels.includes(label)
      ? composer.labels.filter((item) => item !== label)
      : [...composer.labels, label];
    onChange({ labels });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0">
      <div className="fixed inset-x-0 bottom-0 max-h-[96vh] overflow-hidden rounded-t-[2rem] bg-white shadow-2xl animate-in slide-in-from-bottom-8 md:inset-y-6 md:left-1/2 md:w-[760px] md:-translate-x-1/2 md:rounded-3xl">
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
              <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-gray-100">
                <ImageWithFallback src={userAvatar} alt={userName} className="h-full w-full object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-gray-950">{userName}</h3>
                <p className="text-sm text-gray-500">Share with the CreativeHUB community</p>
              </div>
            </div>

            <textarea
              value={composer.text}
              maxLength={MAX_POST_LENGTH}
              onChange={(event) => onChange({ text: event.target.value })}
              placeholder="What’s happening in your work today?"
              className="min-h-40 w-full resize-none rounded-3xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-950 outline-none transition-all placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:ring-4 focus:ring-gray-100"
            />
            <div className="mt-2 text-right text-xs font-medium text-gray-500">
              {composer.text.length}/{MAX_POST_LENGTH}
            </div>

            {(composer.attachments.length > 0 || composer.gifUrl.trim()) && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {composer.gifUrl.trim() && (
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                    <ImageWithFallback src={composer.gifUrl.trim()} alt="GIF preview" className="h-44 w-full object-cover" />
                    <button
                      onClick={() => onChange({ gifUrl: '' })}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
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

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><MapPin className="h-4 w-4" /> Add Location</span>
                <button
                  onClick={onOpenLocationPicker}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 outline-none transition-all hover:bg-white hover:shadow-sm focus:ring-4 focus:ring-gray-100"
                >
                  <span className={composer.location ? 'text-gray-900' : 'text-gray-400'}>
                    {composer.location || 'Search or choose a location'}
                  </span>
                  <MapPin className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Users className="h-4 w-4" /> Tag People</span>
                <input value={composer.taggedPeople} onChange={(event) => onChange({ taggedPeople: event.target.value })} placeholder="Names or collaborators" className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100" />
              </label>
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Hash className="h-4 w-4" /> Add Hashtags</span>
                <input value={composer.hashtags} onChange={(event) => onChange({ hashtags: event.target.value })} placeholder="#branding #photoshoot" className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100" />
              </label>
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><AtSign className="h-4 w-4" /> Mention Users</span>
                <input value={composer.mentions} onChange={(event) => onChange({ mentions: event.target.value })} placeholder="@creativehub @studio" className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100" />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Tag className="h-4 w-4" /> Project Category</span>
                <select value={composer.category} onChange={(event) => onChange({ category: event.target.value })} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100">
                  <option value="">Choose a category</option>
                  {categoryOptions.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Globe2 className="h-4 w-4" /> Visibility</span>
                <select value={composer.visibility} onChange={(event) => onChange({ visibility: event.target.value as Visibility })} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100">
                  {visibilityOptions.map((visibility) => <option key={visibility}>{visibility}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-bold text-gray-800">Post tools</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <button onClick={() => mediaInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100">
                  <ImagePlus className="h-4 w-4" /> Photos/Videos
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100">
                  <Paperclip className="h-4 w-4" /> Files
                </button>
                <button onClick={() => onChange({ pollQuestion: composer.pollQuestion ? '' : 'Which direction should I choose?' })} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100">
                  <MessageCircle className="h-4 w-4" /> Poll
                </button>
                <button onClick={() => onChange({ gifUrl: composer.gifUrl || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3FvdHRoYm51M3ZodXVtc2k4NGF0b3hhbDYwb2dzOHkxN2JmNDRmayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0MYt5jPR6QX5pnqM/giphy.gif' })} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100">
                  <Gift className="h-4 w-4" /> GIF
                </button>
              </div>
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(event) => onAddFiles(event.target.files)} />
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip" multiple className="hidden" onChange={(event) => onAddFiles(event.target.files)} />
            </div>

            {composer.pollQuestion && (
              <div className="mt-4 grid gap-3 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                <input value={composer.pollQuestion} onChange={(event) => onChange({ pollQuestion: event.target.value })} placeholder="Poll question" className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100" />
                <input value={composer.pollOptions} onChange={(event) => onChange({ pollOptions: event.target.value })} placeholder="Options separated by commas" className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-100" />
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700"><Smile className="h-4 w-4" /> Emoji picker</p>
                <div className="flex flex-wrap gap-2">
                  {emojiOptions.map((emoji) => (
                    <button key={emoji} onClick={() => onChange({ text: `${composer.text}${emoji}` })} className="h-10 w-10 rounded-2xl bg-gray-50 text-lg transition-transform hover:scale-110">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700"><Sparkles className="h-4 w-4" /> Intent tags</p>
                <div className="flex flex-wrap gap-2">
                  {labelOptions.map((label) => (
                    <button
                      key={label}
                      onClick={() => toggleLabel(label)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${composer.labels.includes(label) ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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

export function ForYouPage({ onViewProfile }: ForYouPageProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [expandedCommentsForPost, setExpandedCommentsForPost] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(emptyComposerState);
  const [composerPlaceholder] = useState(() => composerPlaceholders[Math.floor(Math.random() * composerPlaceholders.length)]);

  const userName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Creative member');
  const userAvatar = user?.avatar_url || fallbackProfileImage;

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      setIsLoading(true);
      setError(null);

      const [freelancersResponse, clientPostsResponse] = await Promise.all([
        DataService.getAllFreelancers(40),
        DataService.getClientPosts(30),
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

      const clientPosts: FeedPost[] = (clientPostsTableMissing ? [] : clientPostsResponse.data || []).map((post: any) => {
        const authorName = post.client?.full_name || 'Client';
        const username = (post.client?.email || 'client').split('@')[0];

        return {
          id: `client-post-${post.id}`,
          authorId: post.client_id,
          authorName,
          username,
          avatar: post.client?.avatar_url || fallbackProfileImage,
          specialty: 'Client Brief',
          image: post.image_url || null,
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

      setPosts([...clientPosts, ...generatedPosts]);
      setIsLoading(false);
    }

    loadFeed();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedPosts = useMemo(() => posts, [posts]);

  const handleLike = (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
          : post
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
    const shareUrl = `${window.location.origin}/profile/${postId.split('-')[0]}`;
    await navigator.clipboard.writeText(shareUrl);
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
    if (!caption && composer.attachments.length === 0 && !composer.gifUrl.trim()) {
      setError('Please add text, media, or a file before posting.');
      return;
    }

    setIsPublishing(true);
    setError(null);

    const firstMedia = composer.attachments.find((attachment) => attachment.previewUrl)?.previewUrl || composer.gifUrl.trim() || null;
    let createdId = `local-post-${Date.now()}`;
    let createdAt = 'Just now';

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
      }
    }

    const hashtags = splitList(composer.hashtags, '#');
    const mentions = splitList(composer.mentions, '@');
    const pollOptions = splitList(composer.pollOptions);
    const newFeedPost: FeedPost = {
      id: createdId,
      authorId: user.id,
      authorName: userName,
      username: ((user.email || userName).split('@')[0] || userName).toLowerCase().replace(/\s+/g, '_'),
      avatar: userAvatar,
      specialty: user.role === 'client' ? 'Client Brief' : 'Creative Update',
      image: firstMedia,
      caption: composer.text.trim() || caption,
      likes: 0,
      commentsCount: 0,
      timeAgo: createdAt,
      isLiked: false,
      isSaved: false,
      isClientPost: user.role === 'client',
      location: composer.location.trim() || undefined,
      hashtags,
      mentions,
      category: composer.category || undefined,
      visibility: composer.visibility,
      labels: composer.labels,
      attachments: composer.attachments,
      poll: composer.pollQuestion.trim() ? { question: composer.pollQuestion.trim(), options: pollOptions } : null,
    };

    setPosts((current) => [newFeedPost, ...current]);
    setIsPublishing(false);
    setIsComposerOpen(false);
    setComposer(emptyComposerState);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 py-4 md:py-8 -mx-4 md:mx-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 px-4 md:mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 md:text-4xl">For You</h1>
          <p className="text-sm text-gray-600 md:text-base">Live creative feed from the CreativeHUB community</p>
        </div>

        <ComposerLauncher
          avatar={userAvatar}
          name={userName}
          placeholder={composerPlaceholder}
          onOpen={() => setIsComposerOpen(true)}
        />

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
            <p className="text-gray-600">Client requests, freelancer showcases, and community updates will appear here.</p>
          </div>
        )}

        <div className="space-y-4 md:space-y-6">
          {sortedPosts.map((post) => (
            <div key={post.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg md:rounded-3xl">
              <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
                <button
                  onClick={() => {
                    if (!post.isClientPost) {
                      onViewProfile?.(post.authorId);
                    }
                  }}
                  className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-80"
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-white">
                    <ImageWithFallback src={post.avatar} alt={post.authorName} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-gray-900">{post.authorName}</h3>
                    <p className="truncate text-sm text-gray-600">@{post.username} • {post.specialty}</p>
                  </div>
                </button>
                <span className="ml-3 flex-shrink-0 text-sm text-gray-500">{post.timeAgo}</span>
              </div>

              {(post.location || post.category || post.visibility || (post.labels?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-6">
                  {post.location && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{post.location}</span>}
                  {post.category && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{post.category}</span>}
                  {post.visibility && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{post.visibility}</span>}
                  {post.labels?.map((label) => <span key={label} className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">{label}</span>)}
                </div>
              )}

              {post.image && (
                <div className="relative aspect-square bg-gray-100">
                  {post.image.startsWith('blob:') && post.attachments?.find((attachment) => attachment.previewUrl === post.image)?.type.startsWith('video/') ? (
                    <video src={post.image} className="h-full w-full object-cover" controls />
                  ) : (
                    <ImageWithFallback src={post.image} alt={post.caption} className="h-full w-full object-cover" />
                  )}
                </div>
              )}

              <div className="px-4 py-3 md:px-6 md:py-4">
                <div className="mb-3 flex items-center justify-between md:mb-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLike(post.id)} className="group flex items-center gap-2 transition-all">
                      <Heart className={`h-7 w-7 transition-all ${post.isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-700 group-hover:scale-110'}`} />
                      <span className="font-semibold text-gray-900">{post.likes}</span>
                    </button>
                    <button
                      onClick={() => setExpandedCommentsForPost((current) => current === post.id ? null : post.id)}
                      className="group flex items-center gap-2 transition-all"
                    >
                      <MessageCircle className="h-7 w-7 text-gray-700 transition-transform group-hover:scale-110" />
                      <span className="font-semibold text-gray-900">{post.commentsCount}</span>
                    </button>
                    <button onClick={() => void handleShare(post.id)} className="group flex items-center gap-2 transition-all">
                      <Share2 className="h-6 w-6 text-gray-700 transition-transform group-hover:scale-110" />
                    </button>
                  </div>
                  <button onClick={() => handleSave(post.id)} className="transition-all">
                    <Bookmark className={`h-6 w-6 transition-all ${post.isSaved ? 'fill-gray-900 text-gray-900 scale-110' : 'text-gray-700 hover:scale-110'}`} />
                  </button>
                </div>

                <div className="mb-4 space-y-3">
                  <p className="whitespace-pre-line text-gray-900">
                    <button onClick={() => onViewProfile?.(post.authorId)} className="font-bold transition-colors hover:text-gray-900">
                      @{post.username}
                    </button>{' '}
                    <span>{post.caption}</span>
                  </p>
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
                </div>

                {expandedCommentsForPost === post.id && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    Comment threads are not yet enabled for this feed item.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CreatePostSheet
        isOpen={isComposerOpen}
        userName={userName}
        userAvatar={userAvatar}
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
