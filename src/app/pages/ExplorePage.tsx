import { PremiumBanner } from '../../components/PremiumBanner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, Star, Sparkles, Heart, Bookmark } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { SiteFooter } from '../../components/common/SiteFooter';
import { DataService, type ExploreHeroData, type AuthShowcaseSpotlight } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import type { Gender } from '../../lib/database.types';
import { SearchFilterPanel, type FilterState } from '../components/SearchFilterPanel';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { useAuth } from '../../contexts/AuthContext';
import { convertAmount, normalizeCurrencyCode } from '../../lib/currency';
import { FREELANCER_CATEGORIES, isFreelancerCategory } from '../../lib/categories';
import { interpretSearchQuery, scoreFreelancerMatch } from '../../lib/freelancerSearch';
import { haversineDistanceKm } from '../../lib/geo';
import { useIsMobile } from '../components/ui/use-mobile';
import { useHeaderExtras } from '../../contexts/HeaderExtrasContext';

interface ProfileCardProps {
  id: string;
  name: string;
  specialty: string;
  minorSkills?: string[];
  rating: number;
  reviews: number;
  image: string;
  gender?: Gender | null;
  location?: string;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
}

function ProfileCard({ id, name, specialty, minorSkills, rating, reviews, image, location, isFavorited, onToggleFavorite }: ProfileCardProps) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  const handleMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: py * -10, ry: px * 12 });
  };

  return (
    <div className="flex-shrink-0 w-[240px] sm:w-[280px] explore-card-perspective">
      <button
        type="button"
        ref={cardRef}
        onClick={() => navigate(`/profile/${id}`)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 120ms ease-out',
        }}
        className="group relative block w-full overflow-hidden rounded-[28px] text-left shadow-[0_25px_60px_-15px_rgba(56,189,248,0.45)]"
      >
        <div className="relative h-[320px] sm:h-[360px] w-full">
          <ImageWithFallback
            src={image}
            alt={name}
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
        </div>

        {onToggleFavorite && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation();
                event.preventDefault();
                onToggleFavorite(id);
              }
            }}
            aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110"
          >
            <Heart className={`h-4 w-4 ${isFavorited ? 'fill-blue-500 text-blue-500' : 'text-gray-700'}`} />

          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 text-left text-white">
          <p className="text-lg font-bold">{name}</p>
          <p className="text-sm text-white/80">
            {specialty}
            {location ? ` · ${location}` : ''}
          </p>
          {minorSkills && minorSkills.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-white/70">
              Also: {minorSkills.slice(0, 2).join(' • ')}
              {minorSkills.length > 2 ? ` +${minorSkills.length - 2} more` : ''}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            {rating > 0 ? rating.toFixed(1) : 'New'}
            <span className="font-normal text-white/70">({reviews})</span>
          </p>
        </div>
      </button>
    </div>
  );
}

interface CarouselSectionProps {
  title: string;
  profiles: ProfileCardProps[];
  favoritedIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
}

// Per-category font size for the hero's rotating word, keyed by the raw
// label (before pluralizeCategory() runs) — hand-picked per label rather
// than measured at runtime, so a short word like "Musician" renders
// noticeably bigger and a long one like "Cake/Dessert Maker" noticeably
// smaller, while every one has already been checked (see the Playwright
// pass in the commit this came from) to still fit inside the reserved
// two-line-tall box below without changing its size. Falls back to the
// "normal" tier for any category added later without an entry here.
const HERO_WORD_SIZE: Record<string, string> = {
  Musician: 'text-6xl sm:text-7xl md:text-8xl',
  Decorator: 'text-6xl sm:text-7xl md:text-8xl',
  Photographer: 'text-5xl sm:text-6xl md:text-7xl',
  Videographer: 'text-5xl sm:text-6xl md:text-7xl',
  'Hair Stylist': 'text-5xl sm:text-6xl md:text-7xl',
  'Makeup Artist': 'text-4xl sm:text-6xl md:text-7xl',
  'Fashion Designer': 'text-3xl sm:text-5xl md:text-6xl',
  'Cake/Dessert Maker': 'text-3xl sm:text-5xl md:text-5xl',
};
const HERO_WORD_DEFAULT_SIZE = 'text-4xl sm:text-5xl md:text-6xl';

// Module-level (not component state) so it survives ExplorePage unmounting
// entirely when a user opens a profile — a plain useState/ref would reset
// to 0 the moment this remounts on Back, losing exactly the scroll position
// this exists to restore. Keyed by section title since each row's content
// (and therefore its scrollable width) differs. Session-lifetime only, same
// as everything else in React Router's in-memory history — a hard refresh
// starting the carousels back at the left edge is expected, not a bug.
const carouselScrollPositions = new Map<string, number>();

// Same reasoning as carouselScrollPositions above, but for the page's own
// vertical scroll — the whole ExplorePage unmounts when a user opens a
// profile, so this can't live in component state either.
let explorePageScrollY = 0;

// Cache of the last successful freelancer fetch — without this, remounting
// after Back always starts from an empty list + isLoading:true, so the page
// is briefly its shortest possible height (just a spinner) before content
// (and then the restored scroll position) appears; that's the visible
// "flash to the top, then jump down" this exists to remove. Seeding state
// from this cache lets the page render at (roughly) its real height on the
// very first paint, so the scroll restore effect never has to fight a
// too-short page.
let cachedFreelancers: any[] | null = null;

function CarouselSection({ title, profiles, favoritedIds, onToggleFavorite }: CarouselSectionProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = carouselScrollPositions.get(title);
    if (saved && scrollRef.current) {
      scrollRef.current.scrollLeft = saved;
    }
    // Only ever restore once, right after this row's cards exist — not on
    // every profiles/title change while the row stays mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-12 md:mb-16">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl md:text-3xl font-bold text-gray-900">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-sky-400 explore-twinkle" />
            {title}
          </h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 explore-underline-glow" />
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => carouselScrollPositions.set(title, event.currentTarget.scrollLeft)}
        className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide"
      >
        {profiles.map((profile, index) => (
          <ProfileCard
            key={profile.id || index}
            {...profile}
            isFavorited={favoritedIds?.has(profile.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

// Card-shuffle deck for the hero's "Featured" spot — two cards visible
// side by side up front, with up to two more peeking out behind them at
// reduced scale/opacity. Every rotation (interval or a manual prev/next
// click), each visible freelancer's SLOT shifts by one (front-right becomes
// the new front-left, the nearer back card becomes the new front-right,
// etc.) while a new candidate enters at the back and whichever one fell off
// the front exits — since every card is keyed by its own freelancer id
// rather than by slot, framer-motion's layout animation naturally
// interpolates each persisting card from its old slot's position to its
// new one, which is what actually produces the "shuffling from back to
// front" motion rather than a plain crossfade between two static images.
interface FeaturedShuffleProps {
  candidates: AuthShowcaseSpotlight[];
  index: number;
  direction: 'next' | 'prev';
  onOpenProfile: (id: string) => void;
  favoritedIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  /** Swiping the front card on mobile navigates the deck the same as the
   * prev/next arrows do — those arrows only ever reveal on hover, which
   * never fires on a touchscreen, so swipe is mobile's only way to control
   * the deck manually today. */
  onSwipe: (direction: 'next' | 'prev') => void;
}

// One constant size per layout, not recomputed off window width — each card
// (name/rating text included) stays the exact same size regardless of small
// viewport changes, rather than visibly snapping whenever the window
// crosses a breakpoint. The two layouts below (desktop pair vs. mobile
// single-with-peek) only switch at the useIsMobile() boolean flipping, not
// on every resize pixel.
const FEATURED_CARD_WIDTH = 330;
// Two 330px cards side by side (≈690px) is wider than any phone screen —
// the previous fixed-width deck simply got clipped by the hero section's
// overflow-hidden edge, cutting the second card in half. Rather than
// shrinking both cards until the same side-by-side layout barely fits (and
// crowding their fixed-size text/badges), mobile shows one full card at a
// time with the next ones peeking out behind it, a stack pattern sized to
// comfortably fit a phone width with room to spare either side.
const FEATURED_CARD_WIDTH_MOBILE = 210;

function FeaturedShuffle({ candidates, index, direction, onOpenProfile, favoritedIds, onToggleFavorite, onSwipe }: FeaturedShuffleProps) {
  const isMobile = useIsMobile();
  const cardWidth = isMobile ? FEATURED_CARD_WIDTH_MOBILE : FEATURED_CARD_WIDTH;
  const gap = Math.round(cardWidth * 0.09);
  const cardHeight = Math.round(cardWidth * 1.35);
  const slotCount = Math.min(4, candidates.length);

  // Each slot's target transform. Desktop: 0/1 are the clickable front
  // pair side by side, 2/3 peek out behind them. Mobile: only slot 0 is
  // the clickable front card, centered; 1/2/3 peek out directly behind it
  // (offset only vertically, never sideways, so nothing extends past the
  // front card's own width).
  const SLOT_STYLE = isMobile
    ? [
        { x: 0, y: 0, scale: 1, rotate: 0, zIndex: 40, opacity: 1 },
        { x: 0, y: gap * 0.7, scale: 0.93, rotate: -3, zIndex: 30, opacity: 0.55 },
        { x: 0, y: gap * 1.4, scale: 0.87, rotate: 3, zIndex: 20, opacity: 0.3 },
        { x: 0, y: gap * 2.1, scale: 0.81, rotate: 0, zIndex: 10, opacity: 0.15 },
      ]
    : [
        { x: 0, y: gap, scale: 1, rotate: -3, zIndex: 40, opacity: 1 },
        { x: cardWidth + gap, y: gap, scale: 1, rotate: 3, zIndex: 30, opacity: 1 },
        { x: (cardWidth + gap) / 2, y: 0, scale: 0.88, rotate: 0, zIndex: 20, opacity: 0.55 },
        { x: (cardWidth + gap) / 2, y: -gap, scale: 0.78, rotate: 0, zIndex: 10, opacity: 0.3 },
      ];

  // A card entering (rotating 'next': appears fresh at the back; 'prev':
  // appears fresh at the front-left, sliding in from off-canvas) and a card
  // leaving (the reverse of whichever end it entered from) — direction-aware
  // so the shuffle reads as moving forward or backward, not just a generic
  // fade either way.
  const enterFrom = isMobile
    ? (direction === 'next'
        ? { x: 0, y: -gap * 2.5, scale: 0.6, opacity: 0 }
        : { x: 0, y: gap * 2.5, scale: 0.6, opacity: 0 })
    : (direction === 'next'
        ? { x: (cardWidth + gap) / 2, y: -gap * 2, scale: 0.6, opacity: 0 }
        : { x: -cardWidth * 0.6, y: gap, scale: 0.9, rotate: -10, opacity: 0 });
  const exitTo = isMobile
    ? (direction === 'next'
        ? { x: 0, y: gap * 2.5, scale: 0.6, opacity: 0 }
        : { x: 0, y: -gap * 2.5, scale: 0.6, opacity: 0 })
    : (direction === 'next'
        ? { x: -cardWidth * 0.7, y: gap * 0.5, scale: 0.85, rotate: -12, opacity: 0 }
        : { x: (cardWidth + gap) / 2, y: -gap * 2.5, scale: 0.55, opacity: 0 });

  const slots = Array.from({ length: slotCount }, (_, offset) => ({
    candidate: candidates[(index + offset) % candidates.length],
    slot: offset,
  }));

  const deckWidth = isMobile ? cardWidth + gap * 4 : cardWidth * 2 + gap;
  // Distinguishes an actual swipe from a tap that also nudges the pointer a
  // few pixels — onDragStart only fires once framer-motion's own movement
  // threshold is crossed, so a clean tap never sets this at all; a real
  // drag sets it just long enough to suppress the click that would
  // otherwise also fire and navigate to the profile.
  const isDraggingRef = useRef(false);
  const swipeThreshold = cardWidth * 0.25;

  return (
    <div
      className="relative mx-auto"
      style={{ width: deckWidth, height: cardHeight + gap * 2 }}
    >
      <AnimatePresence initial={false}>
        {slots.map(({ candidate, slot }) => {
          const isFront = isMobile ? slot < 1 : slot < 2;
          const style = SLOT_STYLE[slot];
          return (
            <motion.button
              key={candidate.id}
              type="button"
              initial={enterFrom}
              animate={style}
              exit={exitTo}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              drag={isMobile && isFront ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragStart={() => {
                isDraggingRef.current = true;
              }}
              onDragEnd={(_event, info) => {
                if (info.offset.x < -swipeThreshold) {
                  onSwipe('next');
                } else if (info.offset.x > swipeThreshold) {
                  onSwipe('prev');
                }
                setTimeout(() => {
                  isDraggingRef.current = false;
                }, 0);
              }}
              onClick={
                isFront
                  ? () => {
                      if (isDraggingRef.current) return;
                      onOpenProfile(candidate.id);
                    }
                  : undefined
              }
              style={{ width: cardWidth, height: cardHeight }}
              className={`group absolute left-0 top-0 overflow-hidden rounded-[24px] text-left shadow-[0_25px_60px_-15px_rgba(56,189,248,0.45)] ${
                isFront ? 'cursor-pointer' : 'pointer-events-none'
              }`}
            >
              <ImageWithFallback
                src={candidate.avatarUrl || DEFAULT_AVATAR_URL}
                alt={candidate.name}
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
              {isFront && (
                <>
                  {slot === 0 && (
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-sky-700 shadow-sm backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-sky-500 text-sky-500" />
                      Featured
                    </span>
                  )}
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(candidate.id);
                    }}
                    role="button"
                    aria-label={favoritedIds.has(candidate.id) ? 'Remove from favorites' : 'Save to favorites'}
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110"
                  >
                    <Heart className={`h-3.5 w-3.5 ${favoritedIds.has(candidate.id) ? 'fill-blue-500 text-blue-500' : 'text-gray-700'}`} />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3 text-left text-white">
                    <p className="truncate text-sm font-bold">{candidate.name}</p>
                    <p className="truncate text-xs text-white/80">{candidate.title}</p>
                    {candidate.rating > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {candidate.rating.toFixed(1)}
                        <span className="font-normal text-white/70">({candidate.totalReviews})</span>
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function normalizeText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

/** "Photographer" -> "Photographers", "Decorator" -> "Decorators", "Cake/Dessert Maker" -> "Cakes/Dessert Makers" — pluralizes the last word of each "/"-joined segment. */
function pluralizeCategory(label: string) {
  return label
    .split('/')
    .map((segment) => {
      const words = segment.trim().split(' ');
      const lastWord = words[words.length - 1];
      // Already plural (e.g. "Decorators") — don't double it into "Decoratorss".
      if (!lastWord.toLowerCase().endsWith('s')) {
        words[words.length - 1] = `${lastWord}s`;
      }
      return words.join(' ');
    })
    .join('/');
}

// Rounds down to a truthful "N+" (e.g. an actual count of 63 becomes "60+",
// never inflated) rather than always dressing real counts up to look like
// marketing copy - small/dev datasets show their real number plainly.
function formatHeroStat(count: number) {
  if (count >= 1000) {
    const thousands = count / 1000;
    return `${thousands >= 10 ? Math.floor(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}k+`;
  }
  if (count >= 20) {
    return `${Math.floor(count / 10) * 10}+`;
  }
  return `${count}`;
}

export function ExplorePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [freelancers, setFreelancers] = useState<any[]>(() => cachedFreelancers || []);
  const [minorSkillsByFreelancerId, setMinorSkillsByFreelancerId] = useState<Map<string, string[]>>(new Map());
  // Both searchQuery and selectedCategory below are kept in the URL (not
  // just component state) so the exact search a user was looking at
  // survives visiting a freelancer's profile and hitting Back — otherwise
  // that route unmounts this page and its plain useState would reset on
  // remount, which is exactly the bug this was reported as.
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQueryState] = useState(() => searchParams.get('q') || '');
  const setSearchQuery = (value: string) => {
    setSearchQueryState(value);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value) {
          params.set('q', value);
        } else {
          params.delete('q');
        }
        return params;
      },
      { replace: true }
    );
  };
  const [selectedCategory, setSelectedCategoryState] = useState(() => {
    const fromUrl = searchParams.get('category');
    return fromUrl && isFreelancerCategory(fromUrl) ? fromUrl : 'All';
  });
  const setSelectedCategory = (next: string | ((current: string) => string)) => {
    setSelectedCategoryState((current) => {
      const resolved = typeof next === 'function' ? (next as (c: string) => string)(current) : next;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (resolved === 'All') {
            params.delete('category');
          } else {
            params.set('category', resolved);
          }
          return params;
        },
        { replace: true }
      );
      return resolved;
    });
  };
  const [clientInterests, setClientInterests] = useState<string[]>([]);
  const [clientPreferences, setClientPreferences] = useState<string[]>([]);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [heroData, setHeroData] = useState<ExploreHeroData | null>(null);
  const [heroFeaturedIndex, setHeroFeaturedIndex] = useState(0);
  const [heroFeaturedDirection, setHeroFeaturedDirection] = useState<'next' | 'prev'>('next');
  // Bumped on every manual prev/next click so the auto-rotate effect below
  // (which depends on it) tears down and restarts its interval — otherwise
  // a manual click could get silently overwritten by the timer firing again
  // a moment later, making the click feel like it didn't do anything.
  const [heroAutoRotateResetKey, setHeroAutoRotateResetKey] = useState(0);
  const [heroCategoryIndex, setHeroCategoryIndex] = useState(0);
  const heroCategoryLabels = useMemo(() => FREELANCER_CATEGORIES.map((category) => category.label), []);
  // "Popular X in Thailand" used to be hardcoded regardless of who was
  // looking, even for viewers whose own country (from signup/onboarding) is
  // known and available right here. `userLocation` is a geocoded
  // "City, Country" string, so the country is its last comma-separated
  // segment; when it's not known yet, drop the suffix rather than guessing
  // a country for someone who may not be anywhere near Thailand.
  const popularSectionSuffix = useMemo(() => {
    if (!userLocation) return '';
    const segments = userLocation.split(',').map((segment) => segment.trim()).filter(Boolean);
    const country = segments[segments.length - 1];
    return country ? ` in ${country}` : '';
  }, [userLocation]);
  const [filters, setFilters] = useState<FilterState>({
    services: [],
    priceRange: [0, 10000],
    locations: [],
    currency: 'THB',
    nearMe: null,
    minRating: null,
  });
  const [isLoading, setIsLoading] = useState(cachedFreelancers === null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // There used to be a second, condensed search input living in the
  // header once scrolled past this section, bound to the same
  // searchQuery/suggestions state as this one but needing its own
  // dropdown anchored to itself - hence tracking which of the two was
  // active. Both the desktop and mobile condensed versions are now just
  // icon buttons that jump back to this one (see scrollToMainSearch),
  // so there's only ever this single input/dropdown pair, but the flag
  // stays in case a second one ever comes back.
  const [activeSearchInput, setActiveSearchInput] = useState<'main' | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);
  const [isPastSearchSection, setIsPastSearchSection] = useState(false);
  const hasRestoredScrollRef = useRef(false);
  // Snapshot at mount, BEFORE the live-tracking listener below can touch it —
  // otherwise a stray 'scroll' event firing while the page is still short
  // (spinner-only, pre-content) sets the module-level value to ~0 and
  // clobbers the real target before the restore effect ever gets to read it.
  // Restoring always from this frozen snapshot instead of the live variable
  // closes that race entirely.
  const scrollYToRestoreRef = useRef(explorePageScrollY);

  // Continuously track the page's own scroll position (not just at unmount)
  // since React Router can swap this whole page out for a profile route at
  // any moment via a plain navigate() call, with no unmount cleanup step of
  // our own to hook into beforehand.
  useEffect(() => {
    const handleScroll = () => {
      explorePageScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Drives the condensed search/filter/Event Assistant bar that replaces
  // the header's nav links once the user scrolls past the full-size search
  // section below the hero - triggers as soon as that section's bottom
  // edge passes under the sticky header (h-16 = 64px on mobile, h-20 = 80px
  // at md+), reverts the moment it's scrolled back into view. Also drives
  // the phone equivalent (mobileActions, icons beside Get Started, and
  // mobileSearch below — a plain icon button there, not its own input, so
  // there's no focus to lose to a stray flicker in this measurement the
  // way an actual mobile condensed search input once was).
  useEffect(() => {
    const headerHeightPx = isMobile ? 64 : 80;
    const handleScroll = () => {
      const section = searchSectionRef.current;
      if (!section) return;
      setIsPastSearchSection(section.getBoundingClientRect().bottom <= headerHeightPx);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // Restore it exactly once, right after the first load finishes — the page
  // needs to actually be tall enough (profiles rendered) before scrolling
  // this far down does anything, and doing it on every isLoading flip (e.g.
  // a later filter refetch) would fight the user's own scrolling from then on.
  // Double rAF: wait for the just-rendered cards to actually be painted
  // (and the page to be its full height) before scrolling, not just for
  // React to have committed the DOM update.
  useEffect(() => {
    if (!isLoading && !hasRestoredScrollRef.current) {
      hasRestoredScrollRef.current = true;
      const target = scrollYToRestoreRef.current;
      if (target > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, target);
          });
        });
      }
    }
  }, [isLoading]);

  useEffect(() => {
    let isMounted = true;
    DataService.getExploreHeroData().then(({ data }) => {
      if (isMounted && data) setHeroData(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroCategoryIndex((current) => (current + 1) % heroCategoryLabels.length);
    }, 2600);
    return () => clearInterval(timer);
  }, [heroCategoryLabels.length]);

  // Rotates the hero's "Featured" card through the same pool of well-reviewed
  // freelancers getExploreHeroData() picked one from at random — otherwise it
  // stays on whichever single freelancer that initial fetch happened to land
  // on for the whole time the page is open. Restarts (via
  // heroAutoRotateResetKey) whenever the user manually navigates with the
  // prev/next arrows, so the next automatic swap is a full 3s away from
  // that click, not whatever was left of the previous countdown.
  useEffect(() => {
    const candidateCount = heroData?.featuredCandidates.length || 0;
    if (candidateCount <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setHeroFeaturedDirection('next');
      setHeroFeaturedIndex((current) => (current + 1) % candidateCount);
    }, 3000);
    return () => clearInterval(timer);
  }, [heroData?.featuredCandidates.length, heroAutoRotateResetKey]);

  const navigateHeroFeatured = (direction: 'next' | 'prev') => {
    const candidateCount = heroData?.featuredCandidates.length || 0;
    if (candidateCount <= 1) {
      return;
    }
    setHeroFeaturedDirection(direction);
    setHeroFeaturedIndex((current) => {
      const delta = direction === 'next' ? 1 : -1;
      return (current + delta + candidateCount) % candidateCount;
    });
    setHeroAutoRotateResetKey((current) => current + 1);
  };

  useEffect(() => {
    let isMounted = true;
    // Only show the loading spinner on a genuine cold start — a remount
    // that already has cached data from a previous visit this session
    // refetches quietly in the background instead, so the page never
    // collapses back down to spinner-height and the restored scroll
    // position (see the effect above) has real content under it the whole
    // time, not just after this finishes.
    const isColdStart = cachedFreelancers === null;

    async function loadFreelancers() {
      if (isColdStart) {
        setIsLoading(true);
      }
      setError(null);

      const response = await DataService.getAllFreelancers(200);

      // Debugging: log raw response to inspect why some names are not returned
      // Use console.log so it's visible in all browser consoles
      // eslint-disable-next-line no-console
      console.log('[ExplorePage] searchQuery=', searchQuery, 'response=', response);

      if (!isMounted) {
        return;
      }

      if (response.error) {
        if (isColdStart) {
          setError((response.error as any).message || 'Unable to load freelancers.');
          setFreelancers([]);
        }
        // A background refresh failing silently leaves the cached list on
        // screen rather than wiping out a perfectly good previous view.
      } else {
        // Merge direct freelancer search and user fallback concurrently for more complete results
        const data = response.data || [];
        if (searchQuery.trim()) {
          try {
            const [fallback] = await Promise.all([DataService.searchUsersFallback(searchQuery.trim())]);
            // eslint-disable-next-line no-console
            console.log('[ExplorePage] fallback=', fallback);
            const fallbackData = (fallback.data || []) as any[];

            const combined = [...data];
            for (const f of fallbackData) {
              const exists = combined.find((c) => (c.user_id && f.user_id && c.user_id === f.user_id) || c.id === f.id);
              if (!exists) combined.push(f);
            }

            // eslint-disable-next-line no-console
            console.log('[ExplorePage] mergedResultsCount=', combined.length);
            cachedFreelancers = combined;
            setFreelancers(combined);
          } catch (err) {
            cachedFreelancers = data;
            setFreelancers(data);
          }
        } else {
          cachedFreelancers = data;
          setFreelancers(data);
        }
      }

      setIsLoading(false);
    }

    void loadFreelancers();

    return () => {
      isMounted = false;
    };
  }, []);

  // One batched lookup for the whole loaded page's minor skills, rather
  // than a query per card.
  useEffect(() => {
    let isMounted = true;
    const ids = freelancers.map((f) => f.id).filter(Boolean);
    if (ids.length === 0) {
      setMinorSkillsByFreelancerId(new Map());
      return;
    }
    DataService.getMinorSkillsForFreelancers(ids).then((map) => {
      if (isMounted) setMinorSkillsByFreelancerId(map);
    });
    return () => {
      isMounted = false;
    };
  }, [freelancers]);

  // Personalization: the categories this client said they're interested in
  // during onboarding, used to nudge default ordering (not filter). Also
  // pull which freelancers are already favorited so hearts render correctly.
  useEffect(() => {
    if (!user?.id) {
      setClientInterests([]);
      setClientPreferences([]);
      setClientCoords(null);
      setFavoritedIds(new Set());
      return;
    }

    let isMounted = true;

    DataService.getUser(user.id).then(({ data }) => {
      if (!isMounted) return;
      if (Array.isArray((data as any)?.client_interests)) {
        setClientInterests((data as any).client_interests);
      }
      if (Array.isArray((data as any)?.client_preferences)) {
        setClientPreferences((data as any).client_preferences);
      }
      setUserLocation((data as any)?.location || null);
      const lat = Number((data as any)?.location_latitude);
      const lng = Number((data as any)?.location_longitude);
      setClientCoords(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
    });

    DataService.getUserFavorites(user.id).then(({ data }) => {
      if (!isMounted || !data) return;
      setFavoritedIds(new Set(data.map((favorite: any) => favorite.freelancer_id).filter(Boolean)));
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleToggleFavorite = async (freelancerId: string) => {
    if (!user?.id) {
      setAuthPromptMessage('Create an account to save your favorite freelancers.');
      return;
    }

    const alreadyFavorited = favoritedIds.has(freelancerId);

    // Optimistic update, reverted on failure.
    setFavoritedIds((current) => {
      const next = new Set(current);
      if (alreadyFavorited) next.delete(freelancerId);
      else next.add(freelancerId);
      return next;
    });

    const { error: toggleError } = alreadyFavorited
      ? await DataService.removeFavorite(user.id, freelancerId)
      : await DataService.addFavorite(user.id, freelancerId);

    if (toggleError) {
      setFavoritedIds((current) => {
        const next = new Set(current);
        if (alreadyFavorited) next.add(freelancerId);
        else next.delete(freelancerId);
        return next;
      });
    }
  };

  // Autocomplete: fetch suggestions (debounced) from both searchUsers and fallback
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let mounted = true;
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      try {
        const [usersRes, fallbackRes] = await Promise.allSettled([
          DataService.searchUsers(q, { limit: 6 }),
          DataService.searchUsersFallback(q),
        ]);

        const combined: any[] = [];
        if (usersRes.status === 'fulfilled' && usersRes.value?.data) combined.push(...usersRes.value.data);
        if (fallbackRes.status === 'fulfilled' && fallbackRes.value?.data) combined.push(...fallbackRes.value.data);

        const dedupe = new Map<string, any>();
        for (const r of combined) {
          const key = r.user_id || r.users?.id || r.id;
          if (!key) continue;
          if (!dedupe.has(key)) dedupe.set(key, r);
        }

        const list = Array.from(dedupe.values()).slice(0, 6);
        if (mounted) {
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        }

        // Merge freelancer matches into the searchable pool too, not just the
        // suggestions dropdown — otherwise someone findable by name here
        // (e.g. an is_available:false freelancer, excluded from the initial
        // browse-only fetch) still wouldn't appear in the actual search
        // results section below.
        if (mounted && fallbackRes.status === 'fulfilled' && fallbackRes.value?.data) {
          const newFreelancerMatches = (fallbackRes.value.data as any[]).filter((row) => isFreelancerCategory(row.title));
          if (newFreelancerMatches.length > 0) {
            setFreelancers((current) => {
              const existingIds = new Set(current.map((item) => item.user_id || item.users?.id || item.id));
              const toAdd = newFreelancerMatches.filter((row) => !existingIds.has(row.user_id));
              return toAdd.length > 0 ? [...current, ...toAdd] : current;
            });
          }
        }
      } catch (e) {
        if (mounted) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    }, 180);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Click outside the main search input/suggestions dropdown to close it.
  // The condensed header search (both the desktop and mobile versions) is
  // now just an icon button that jumps back to this one, so there's only
  // ever this single input/dropdown pair to worry about.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        suggestionsRef.current &&
        inputRef.current &&
        !suggestionsRef.current.contains(target) &&
        !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Freelancers whose category isn't one of the five supported labels
  // (legacy data, or a profile mid-way through picking a valid category)
  // are excluded from Explore entirely — they still have an account, they
  // just don't surface here until they pick a supported category.
  const profiles = useMemo<ProfileCardProps[]>(() => {
    return freelancers
      .filter((profile) => isFreelancerCategory(profile.title))
      .map((profile) => ({
        id: profile.user_id || profile.users?.id || profile.id,
        name: profile.users?.full_name || profile.title || 'Creative Freelancer',
        specialty: profile.title || profile.skills?.[0] || 'Creative Professional',
        minorSkills: minorSkillsByFreelancerId.get(profile.id) || [],
        rating: Number(profile.users?.rating || 0),
        reviews: Number(profile.users?.total_reviews || 0),
        image: profile.users?.avatar_url || DEFAULT_AVATAR_URL,
        gender: profile.users?.gender || null,
        location: profile.users?.location || undefined,
      }));
  }, [freelancers, minorSkillsByFreelancerId]);

  // Unifies the category pill (a hard category filter) with whatever the
  // free-text search implies (service/style/location) into one query the
  // scorer below can rank every freelancer against.
  const interpretedQuery = useMemo(() => {
    const base = interpretSearchQuery(searchQuery);
    return selectedCategory !== 'All' ? { ...base, category: selectedCategory } : base;
  }, [searchQuery, selectedCategory]);

  const filteredProfiles = useMemo(() => {
    const mapById = new Map(
      freelancers.map((item) => [item.user_id || item.users?.id || item.id, item])
    );

    const scored = profiles
      .map((profile) => {
        const source = mapById.get(profile.id);

        const score = scoreFreelancerMatch(
          {
            title: source?.title || null,
            skills: source?.skills || [],
            styles: source?.styles || [],
            performerType: source?.performer_type || [],
            minorSkills: profile.minorSkills || [],
            description: source?.description || null,
            location: profile.location || null,
            fullName: profile.name || null,
            rating: profile.rating,
            totalReviews: profile.reviews,
          },
          interpretedQuery,
          clientInterests
        );

        // Advanced Filter's category checkboxes are now the exact five
        // canonical labels, so this is a straight equality check against
        // title — no more fuzzy keyword matching that could cross-match
        // unrelated categories.
        const serviceMatch = filters.services.length === 0 || (!!source?.title && filters.services.includes(source.title));

        const normalizedLocation = normalizeText(profile.location);

        const textLocationMatch =
          filters.locations.length > 0 &&
          filters.locations.some((location) => normalizedLocation.includes(normalizeText(location)));

        const freelancerLat = Number(source?.users?.location_latitude);
        const freelancerLng = Number(source?.users?.location_longitude);
        const nearMeMatch =
          !!filters.nearMe &&
          Number.isFinite(freelancerLat) &&
          Number.isFinite(freelancerLng) &&
          haversineDistanceKm(filters.nearMe.latitude, filters.nearMe.longitude, freelancerLat, freelancerLng) <= filters.nearMe.radiusKm;

        const locationMatch = (filters.locations.length === 0 && !filters.nearMe) || textLocationMatch || nearMeMatch;

        const hourlyRate = Number(source?.hourly_rate);
        const sourceCurrency = normalizeCurrencyCode(source?.users?.preferred_currency || source?.preferred_currency || 'THB', 'THB');
        const [minPrice, maxPrice] = filters.priceRange;
        const defaultMaxForCurrency = Math.round(convertAmount(10000, 'THB', filters.currency));
        const isDefaultPriceFilter = minPrice === 0 && maxPrice === defaultMaxForCurrency;
        const hourlyRateInSelectedCurrency = convertAmount(hourlyRate, sourceCurrency, filters.currency);
        const priceMatch = Number.isFinite(hourlyRate)
          ? hourlyRateInSelectedCurrency >= minPrice && hourlyRateInSelectedCurrency <= maxPrice
          : isDefaultPriceFilter;

        const ratingMatch = filters.minRating === null || profile.rating >= filters.minRating;

        const passes = score > 0 && serviceMatch && locationMatch && priceMatch && ratingMatch;
        return { profile, score, passes };
      })
      .filter((item) => item.passes)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.profile);
  }, [profiles, freelancers, filters, interpretedQuery, clientInterests]);

  // Group by the freelancer's actual category (freelancer_profiles.title,
  // which is always one of the five FREELANCER_CATEGORIES labels — profiles
  // is already filtered to drop anything else, so every entry here has a
  // recognized category and there's no "uncategorized" fallback bucket.
  const categorySections = useMemo(() => {
    const sourceById = new Map(freelancers.map((item) => [item.user_id || item.users?.id || item.id, item]));
    const categoryLabels = FREELANCER_CATEGORIES.map((category) => category.label);
    const labelSet = new Set(categoryLabels);

    const grouped = new Map<string, ProfileCardProps[]>();

    for (const profile of filteredProfiles) {
      const title = sourceById.get(profile.id)?.title;
      if (title && labelSet.has(title)) {
        if (!grouped.has(title)) grouped.set(title, []);
        grouped.get(title)!.push(profile);
      }
    }

    // Categories the client chose as interests at sign-up float to the top,
    // in the order they picked them; the rest of the catalog follows in its
    // canonical order.
    const orderedLabels = [
      ...clientInterests.filter((label) => labelSet.has(label)),
      ...categoryLabels.filter((label) => !clientInterests.includes(label)),
    ];

    return orderedLabels
      .map((label) => ({ title: `Popular ${pluralizeCategory(label)}${popularSectionSuffix}`, profiles: grouped.get(label) || [] }))
      .filter((section) => section.profiles.length > 0);
  }, [filteredProfiles, freelancers, clientInterests, popularSectionSuffix]);

  // "Recommended for you" ranks freelancers against what this client told us
  // during onboarding — category interests (a strong, directly-comparable
  // signal: client_interests is drawn from the same FREELANCER_CATEGORIES
  // labels as freelancer_profiles.title) and the softer client_preferences
  // checkboxes (experienced, high quality, affordable, nearby). A freelancer
  // only appears here if at least one of those signals actually matched —
  // this is deliberately not "everyone, sorted somehow," so the section is
  // hidden entirely for a client with no onboarding preferences set.
  const recommendedProfiles = useMemo(() => {
    if (clientInterests.length === 0 && clientPreferences.length === 0) return [];

    const sourceById = new Map(freelancers.map((item) => [item.user_id || item.users?.id || item.id, item]));

    const scored = profiles
      .map((profile) => {
        const source = sourceById.get(profile.id);
        if (!source) return null;

        let score = 0;
        let matched = false;

        if (source.title && clientInterests.includes(source.title)) {
          score += 10;
          matched = true;
        }

        if (clientPreferences.includes('high_quality')) {
          const rating = Number(source.users?.rating);
          if (rating > 0) {
            score += rating * 2;
            matched = true;
          }
        }

        if (clientPreferences.includes('experienced_freelancers')) {
          const years = Number(source.experience_years);
          if (years > 0) {
            score += Math.min(years, 15);
            matched = true;
          }
        }

        if (clientPreferences.includes('affordable_pricing')) {
          const rate = Number(source.hourly_rate);
          if (Number.isFinite(rate) && rate > 0) {
            score += Math.max(0, 20 - rate / 50);
            matched = true;
          }
        }

        if (clientPreferences.includes('nearby') && clientCoords) {
          const freelancerLat = Number(source.users?.location_latitude);
          const freelancerLng = Number(source.users?.location_longitude);
          if (Number.isFinite(freelancerLat) && Number.isFinite(freelancerLng)) {
            const distanceKm = haversineDistanceKm(clientCoords.lat, clientCoords.lng, freelancerLat, freelancerLng);
            score += Math.max(0, 20 - distanceKm / 5);
            matched = true;
          }
        }

        if (!matched) return null;

        // Small tie-break nudge among already-matched profiles only — never
        // enough on its own to pull in a freelancer with no real match.
        score += (Number(source.users?.rating) || 0) * 0.1;

        return { profile, score };
      })
      .filter((item): item is { profile: ProfileCardProps; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 12).map((item) => item.profile);
  }, [profiles, freelancers, clientInterests, clientPreferences, clientCoords]);

  const hasActiveSearch = searchQuery.trim().length > 0 || selectedCategory !== 'All';

  const activeAdvancedFilterCount = useMemo(() => {
    const defaultMaxForCurrency = Math.round(convertAmount(10000, 'THB', filters.currency));
    const isDefaultPrice = filters.priceRange[0] === 0 && filters.priceRange[1] === defaultMaxForCurrency;
    return filters.services.length + filters.locations.length + (filters.nearMe ? 1 : 0) + (isDefaultPrice ? 0 : 1) + (filters.minRating !== null ? 1 : 0);
  }, [filters]);

  // Shared by both the full-size search box's dropdown and the condensed
  // header search box's own copy of it, so a suggestion looks and behaves
  // identically in either place.
  const renderSearchSuggestion = (s: any, idx: number) => {
    // DataService.searchUsers returns flat rows (full_name/email directly
    // on the row); DataService.searchUsersFallback returns
    // freelancer_profiles-shaped rows (name/email nested under `.users`) —
    // a suggestion can be either shape, so every field needs both a flat
    // and a nested fallback.
    const id = s.user_id || s.users?.id || s.id;
    const name = s.users?.full_name || s.full_name || s.title || s.users?.email || s.email || 'Unknown';
    const subtitle = s.users?.email || s.email || s.users?.username || s.title || '';
    const avatar = s.users?.avatar_url || s.avatar_url || DEFAULT_AVATAR_URL;
    const suggestionGender = s.users?.gender || s.gender || null;
    return (
      <button
        key={id || idx}
        onClick={() => {
          setShowSuggestions(false);
          navigate(`/profile/${id}`);
        }}
        className="w-full text-left px-3 py-2 hover:bg-sky-50 flex items-center gap-3"
      >
        <Avatar src={avatar} alt={name} gender={suggestionGender} sizeClassName="w-8 h-8" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{name}</span>
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        </div>
      </button>
    );
  };

  // Condensed header content, mounted in MainLayout's header at all times
  // (not just once scrolled past the full-size search section) so its
  // reserved width never changes — only `isPastSearchSection` toggles
  // whether it's actually visible/interactive, via `invisible` (which
  // still occupies its layout box). That's what keeps the nav links next
  // to it from ever shifting as the page scrolls: nothing is ever added to
  // or removed from the header row, only shown or hidden in place. Reuses
  // the exact same state/handlers as the full search bar, Advanced Filter
  // card, and Event Assistant card below (setSearchQuery,
  // setShowSearchFilter, navigate('/event-matcher')) so it behaves
  // identically rather than being a second, separate implementation.
  // Icon-only until the actions slot itself (a @container, see MainLayout)
  // has room for text — a container query rather than a viewport
  // breakpoint, since this slot's actual width depends on the logo/nav/
  // account controls around it, not on how wide the window is.
  const condensedVisibilityClass = isPastSearchSection ? '' : 'invisible';
  // Jumps back up to the main search bar and focuses it - shared by the
  // desktop condensed icon below and mobileSearch's mobile version, so
  // scrolling past the hero never leaves a second, separate search input
  // anywhere, just one way back to the one real search field.
  const scrollToMainSearch = () => {
    searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focused after the smooth scroll has had time to land, not
    // immediately — focusing the main input while it's still off past the
    // top of the viewport would fight that animation with the browser's
    // own "scroll the focused element into view" behavior.
    window.setTimeout(() => inputRef.current?.focus(), 450);
  };
  useHeaderExtras({
    search: (
      <div className={condensedVisibilityClass}>
        <button
          type="button"
          onClick={scrollToMainSearch}
          tabIndex={isPastSearchSection ? 0 : -1}
          aria-label="Search freelancers"
          title="Search freelancers"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-100 bg-white/80 text-sky-500 shadow-sm transition-colors hover:bg-sky-50"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    ),
    // A previous version scaled this gap up at wider breakpoints (up to
    // 64px) to spread the two buttons toward opposite ends of the header's
    // actions slot on a maximized window - but that slot's actual width
    // depends on how much space is left over after the logo/nav/account
    // controls, not on viewport width alone, so at plenty of ordinary
    // desktop widths (e.g. 1280-1400px) that gap alone nearly filled the
    // whole slot, leaving no margin on either side and crowding Advanced
    // Filter against the nav links / Event Assistant against the account
    // controls. A small, constant gap can't do that at any width.
    actions: (
      <div className={`flex flex-shrink-0 items-center gap-3 ${condensedVisibilityClass}`}>
        <button
          type="button"
          onClick={() => setShowSearchFilter(true)}
          title="Advanced Filter"
          tabIndex={isPastSearchSection ? 0 : -1}
          className="relative flex flex-shrink-0 items-center gap-1.5 rounded-full border border-sky-100 bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-sky-50 @sm:px-3"
        >
          <SlidersHorizontal className="h-4 w-4 text-sky-500" />
          <span className="hidden @sm:inline">Advanced Filter</span>
          {activeAdvancedFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 px-1 text-[10px] font-bold text-white">
              {activeAdvancedFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/event-matcher')}
          title="Event Assistant"
          tabIndex={isPastSearchSection ? 0 : -1}
          className="relative flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/30 transition-transform hover:scale-105 @sm:px-3"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden @sm:inline">Event Assistant</span>
        </button>
      </div>
    ),
    // Phone equivalent of `actions` above - there's no separate nav row to
    // inject into on a narrow screen (that whole row is md+ only), so this
    // renders inline beside the Get Started/account-controls cluster
    // instead, icon-only since there's no room for labels there either way.
    // Search sits in this same row (rather than a separate row below the
    // header) so all three icons stay on one line on a narrow screen.
    mobileActions: (
      <div className={`flex items-center gap-[clamp(3px,1vw,6px)] ${condensedVisibilityClass}`}>
        <button
          type="button"
          onClick={scrollToMainSearch}
          title="Search freelancers"
          aria-label="Search freelancers"
          tabIndex={isPastSearchSection ? 0 : -1}
          className="flex h-[clamp(24px,7.5vw,36px)] w-[clamp(24px,7.5vw,36px)] items-center justify-center rounded-full border border-sky-100 bg-white/80 text-sky-500 transition-colors hover:bg-sky-50"
        >
          <Search className="h-[clamp(12px,4vw,18px)] w-[clamp(12px,4vw,18px)]" />
        </button>
        <button
          type="button"
          onClick={() => setShowSearchFilter(true)}
          title="Advanced Filter"
          aria-label="Advanced Filter"
          tabIndex={isPastSearchSection ? 0 : -1}
          className="relative flex h-[clamp(24px,7.5vw,36px)] w-[clamp(24px,7.5vw,36px)] items-center justify-center rounded-full border border-sky-100 bg-white/80 text-sky-600 transition-colors hover:bg-sky-50"
        >
          <SlidersHorizontal className="h-[clamp(12px,4vw,18px)] w-[clamp(12px,4vw,18px)]" />
          {activeAdvancedFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 px-0.5 text-[9px] font-bold text-white">
              {activeAdvancedFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/event-matcher')}
          title="Event Assistant"
          aria-label="Event Assistant"
          tabIndex={isPastSearchSection ? 0 : -1}
          className="relative flex h-[clamp(24px,7.5vw,36px)] w-[clamp(24px,7.5vw,36px)] items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/30 transition-transform hover:scale-105"
        >
          <Sparkles className="h-[clamp(12px,4vw,18px)] w-[clamp(12px,4vw,18px)]" />
        </button>
      </div>
    ),
  });

  return (
    <div className="relative">
      {/* Decorative light-blue backdrop: absolutely positioned to span the
          whole scrollable page (not just one viewport), so it reads as
          "surface at the top, deeper water further down" rather than a
          band that follows the viewport as you scroll. Purely decorative —
          inert to clicks and screen readers. */}
      <div
        className="absolute inset-y-0 left-0 z-0 w-screen overflow-hidden"
        style={{
          // Breaks out of MainLayout's max-w/padded <main> to bleed the full
          // viewport width, instead of being confined to the padded content
          // column (which showed as a white margin down both sides).
          marginLeft: 'calc(50% - 50vw)',
          // Pixel-based stops (not %) so the color arrives at the same
          // physical spot regardless of how tall the page ends up being -
          // reaches its deepest, still-pale tone by ~1800px (shortly after
          // the wave) and holds there. Kept deliberately subtle/light the
          // whole way down (never past a soft periwinkle) so cards, icons
          // and buttons that lean on blue accents keep contrast against it
          // instead of blending into a saturated backdrop.
          background: 'linear-gradient(to bottom, #ffffff 0px, #ffffff 320px, #f0f9ff 560px, #e0f2fe 820px, #dbeafe 1100px, #dce6fb 1500px, #dfe1fa 1800px, #dfe1fa 100%)',
        }}
        aria-hidden="true"
      >
        {/* Soft spotlight glow behind the header */}
        <div
          className="absolute inset-x-0 top-0 h-[32rem]"
          style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(125,211,252,0.35), transparent 70%)' }}
        />
        <div className="explore-orb absolute top-0 -left-28 h-[26rem] w-[26rem] rounded-full bg-gradient-to-br from-sky-300/45 to-cyan-200/30 blur-3xl" />
        <div className="explore-orb explore-orb-delay-1 absolute top-[20%] -right-36 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-indigo-300/35 to-blue-200/25 blur-3xl" />
        <div className="explore-orb explore-orb-delay-2 absolute top-[45%] left-[15%] h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/40 to-sky-300/25 blur-3xl" />
        <div className="explore-orb explore-orb-delay-1 absolute top-[65%] right-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-cyan-200/35 to-white/10 blur-3xl" />
        <div className="explore-orb explore-orb-delay-2 absolute top-[85%] left-[8%] h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/40 to-violet-200/25 blur-3xl" />
        <div className="explore-orb explore-orb-delay-1 absolute top-[105%] right-[10%] h-80 w-80 rounded-full bg-gradient-to-br from-violet-300/35 to-blue-300/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Sparkle stars, echoing the logo's paint-splash accents - spread
            down the full page so they keep drifting by as you scroll, like
            light/bubbles the deeper you go. */}
        {[
          { top: '4%', left: '8%', size: 14, delay: '0s' },
          { top: '10%', left: '70%', size: 10, delay: '-1.8s' },
          { top: '22%', left: '92%', size: 10, delay: '-1.2s' },
          { top: '30%', left: '5%', size: 12, delay: '-2.6s' },
          { top: '40%', left: '55%', size: 16, delay: '-2.4s' },
          { top: '50%', left: '85%', size: 11, delay: '-0.6s' },
          { top: '58%', left: '12%', size: 13, delay: '-3.2s' },
          { top: '68%', left: '45%', size: 10, delay: '-1.5s' },
          { top: '78%', left: '90%', size: 14, delay: '-2.1s' },
          { top: '88%', left: '20%', size: 12, delay: '-0.9s' },
          { top: '98%', left: '65%', size: 15, delay: '-3.5s' },
        ].map((star, index) => (
          <Sparkles
            key={index}
            className="explore-bg-sparkle absolute text-sky-300"
            style={{ top: star.top, left: star.left, width: star.size, height: star.size, animationDelay: star.delay }}
          />
        ))}
      </div>
      <style>{`
        @keyframes exploreOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.08); }
          66% { transform: translate(-15px, 15px) scale(0.95); }
        }
        .explore-orb { animation: exploreOrbFloat 14s ease-in-out infinite; }
        .explore-orb-delay-1 { animation-delay: -4s; }
        .explore-orb-delay-2 { animation-delay: -9s; }

        @keyframes exploreTwinkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.5; transform: scale(1.25) rotate(15deg); }
        }
        .explore-twinkle { animation: exploreTwinkle 2.4s ease-in-out infinite; }

        @keyframes exploreUnderlineGlow {
          0%, 100% { box-shadow: 0 0 6px 0 rgba(56,189,248,0.6); }
          50% { box-shadow: 0 0 14px 2px rgba(56,189,248,0.9); }
        }
        .explore-underline-glow { animation: exploreUnderlineGlow 2.6s ease-in-out infinite; }

        .explore-card-perspective { perspective: 1200px; }

        @keyframes exploreWaveDrift {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .explore-wave-drift-slow { animation: exploreWaveDrift 22s linear infinite; }
        .explore-wave-drift-fast { animation: exploreWaveDrift 14s linear infinite reverse; }

        @keyframes exploreBgSparkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85) rotate(0deg); }
          50% { opacity: 0.9; transform: scale(1.15) rotate(20deg); }
        }
        .explore-bg-sparkle { animation: exploreBgSparkle 3.5s ease-in-out infinite; }

        @keyframes heroHeartFloat {
          0%, 100% { transform: translateY(0) rotate(-8deg); opacity: 0.35; }
          50% { transform: translateY(-14px) rotate(4deg); opacity: 0.6; }
        }
        .hero-heart-float { animation: heroHeartFloat 6s ease-in-out infinite; }
        .hero-heart-float-delay { animation-delay: -3s; }

        @keyframes heroWordIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-word-in { animation: heroWordIn 0.5s ease-out; }

        @keyframes heroRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hero-ring-spin { animation: heroRingSpin 18s linear infinite; }

        @media (prefers-reduced-motion: reduce) {
          .explore-orb, .explore-twinkle, .explore-underline-glow,
          .hero-heart-float, .hero-word-in, .hero-ring-spin,
          .explore-wave-drift-slow, .explore-wave-drift-fast, .explore-bg-sparkle {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative z-10">
      {/* Hero */}
      <PremiumBanner />

      <section className="relative mb-12 overflow-hidden rounded-[32px] border border-sky-100 bg-white/50 px-6 py-10 backdrop-blur-sm sm:px-10 md:mb-16 md:py-14">
        <Heart className="hero-heart-float pointer-events-none absolute left-6 top-8 h-6 w-6 fill-sky-200 text-sky-300" aria-hidden="true" />
        <Heart className="hero-heart-float hero-heart-float-delay pointer-events-none absolute left-16 top-24 h-4 w-4 fill-sky-200 text-sky-300" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full border border-sky-200/60" aria-hidden="true" />

        {/* minmax(680px, ...) on the card column — not a stylistic choice,
            a correctness floor: the shuffle deck's fixed pixel width
            (currently 2*FEATURED_CARD_WIDTH + gap ≈ 669px) would otherwise
            shrink below what it needs on common laptop widths (a plain
            0.9fr share can go well under 669px around 1280-1440px
            viewports), overflowing into the section's own overflow-hidden
            edge and getting visibly clipped. This guarantees the column
            never shrinks past what the deck actually requires; on screens
            too narrow for that plus a reasonable text column, the text
            side gives up the space instead. */}
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_minmax(680px,0.9fr)] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              Thailand's Creative Marketplace
            </span>

            <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.1] text-gray-900 sm:text-5xl md:text-6xl">
              Discover
              {/* Reserves a constant 2-line-tall box (in em, at THIS h1's own
                  base font-size — the rotating word's own font-size below
                  doesn't affect it, so resizing that word never overflows
                  this reservation) - each category renders at its own
                  HERO_WORD_SIZE (shorter labels bigger, longer ones
                  smaller), so the box's height never shifts between
                  rotations even though every label is a different length. */}
              <div className="flex min-h-[2.2em] items-center">
                <span
                  key={heroCategoryIndex}
                  className={`hero-word-in inline-block bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text leading-[1.25] text-transparent ${
                    // leading-[1.25] (looser than the h1's own leading-[1.1])
                    // is required here, not cosmetic — at these larger
                    // sizes, 1.1 doesn't leave enough room below the
                    // baseline and was clipping descenders (the tails on
                    // g/y/p).
                    HERO_WORD_SIZE[heroCategoryLabels[heroCategoryIndex]] || HERO_WORD_DEFAULT_SIZE
                  }`}
                >
                  {pluralizeCategory(heroCategoryLabels[heroCategoryIndex])}
                </span>
              </div>
              That Move You
            </h1>

            <p className="mt-5 max-w-md text-base text-gray-600 sm:text-lg">
              Book top-tier photographers, makeup artists, videographers and more from around the world — in minutes.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {heroData ? formatHeroStat(heroData.freelancerCount) : '—'}
                </div>
                <div className="text-xs font-medium text-gray-500">Freelancers</div>
              </div>
              {heroData?.bookingCount != null && (
                <div>
                  <div className="text-2xl font-bold text-gray-900">{formatHeroStat(heroData.bookingCount)}</div>
                  <div className="text-xs font-medium text-gray-500">Bookings</div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1 text-2xl font-bold text-gray-900">
                  {heroData && heroData.avgRating > 0 ? heroData.avgRating.toFixed(1) : '—'}
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="text-xs font-medium text-gray-500">Rating</div>
              </div>
            </div>
          </div>

          {/* Featured freelancers — a shuffling deck (FeaturedShuffle) that
              cycles through featuredCandidates (the same pool
              getExploreHeroData() randomly picked `featured` from) every 3s
              via the interval effect above, instead of staying on whichever
              single freelancer the initial fetch happened to land on for
              the page's whole lifetime. Hovering reveals prev/next arrows
              (navigateHeroFeatured) so the rotation isn't only ever
              automatic — a manual click also resets that 3s timer so it
              doesn't fight the person who just navigated. */}
          <div className="group/hero relative mx-auto w-full max-w-2xl">
            <div className="hero-ring-spin pointer-events-none absolute -inset-4 rounded-[36px] border-2 border-dashed border-sky-200/70" aria-hidden="true" />
            {(() => {
              const candidates = heroData?.featuredCandidates;

              if (!candidates || candidates.length === 0) {
                return <div className="h-[420px] w-full max-w-md mx-auto animate-pulse rounded-[24px] bg-sky-100/70" />;
              }

              return (
                <>
                  <FeaturedShuffle
                    candidates={candidates}
                    index={heroFeaturedIndex}
                    direction={heroFeaturedDirection}
                    onOpenProfile={(id) => navigate(`/profile/${id}`)}
                    favoritedIds={favoritedIds}
                    onToggleFavorite={handleToggleFavorite}
                    onSwipe={navigateHeroFeatured}
                  />

                  {candidates.length > 1 && (
                    <>
                      {/* Visible by default on mobile (no hover state to reveal
                          them on a touchscreen — swiping the card itself is the
                          other way to navigate there), hover-revealed on desktop
                          as before. */}
                      <button
                        type="button"
                        onClick={() => navigateHeroFeatured('prev')}
                        aria-label="Previous featured freelancer"
                        className="absolute left-0 top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-100 shadow-sm backdrop-blur-sm transition-all hover:scale-110 hover:bg-white md:opacity-0 md:group-hover/hero:opacity-100"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateHeroFeatured('next')}
                        aria-label="Next featured freelancer"
                        className="absolute right-0 top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-100 shadow-sm backdrop-blur-sm transition-all hover:scale-110 hover:bg-white md:opacity-0 md:group-hover/hero:opacity-100"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Wave divider — in the logo's cyan -> blue -> purple paint-splash
          gradient. Sits once, right under the hero, like the surface of
          water — its own fill fades out toward the bottom (mask) so it
          blends into the page backdrop's colors below (which pick up the
          same blue/violet family right around here) instead of ending in a
          hard-edged box. Scrolling further down is just that deepening
          gradient + sparkles, not a repeating wave. */}
      <div
        className="relative -mt-20 mb-6 h-48 w-screen overflow-hidden sm:-mt-24 sm:h-64 md:mb-10"
        style={{
          // Same full-bleed breakout as the backdrop above, so the wave
          // spans edge-to-edge instead of stopping at the padded content
          // column's width.
          marginLeft: 'calc(50% - 50vw)',
          maskImage: 'linear-gradient(to bottom, black 45%, transparent 92%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent 92%)',
        }}
      >
        <svg className="explore-wave-drift-slow absolute bottom-0 left-0 h-full w-[200%]" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="exploreWaveGradA" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <path
            d="M0,90 C240,150 480,30 720,90 C960,150 1200,30 1440,90 L1440,200 L0,200 Z M1440,90 C1680,150 1920,30 2160,90 C2400,150 2640,30 2880,90 L2880,200 L1440,200 Z"
            fill="url(#exploreWaveGradA)"
            opacity="0.6"
          />
        </svg>
        <svg className="explore-wave-drift-fast absolute bottom-0 left-0 h-full w-[200%]" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="exploreWaveGradB" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
          </defs>
          <path
            d="M0,120 C260,60 500,170 760,120 C1020,70 1200,150 1440,120 L1440,200 L0,200 Z M1440,120 C1700,60 1940,170 2200,120 C2460,70 2640,150 2880,120 L2880,200 L1440,200 Z"
            fill="url(#exploreWaveGradB)"
            opacity="0.7"
          />
        </svg>
      </div>

      {/* Search and AI Matcher */}
      <div ref={searchSectionRef} className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 mb-8 md:mb-12">
        <div data-tour="search" className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
          <input
            type="text"
            ref={inputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              setActiveSearchInput('main');
              setShowSuggestions(suggestions.length > 0);
            }}
            // Results already filter live as you type — Enter has nothing
            // left to submit, so this only exists to swallow the keypress
            // itself (see the header search input's identical handler).
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
              }
            }}
            placeholder="Search by name, email, or specialty — e.g. photographer, makeup, wedding"
            className="w-full pl-12 pr-4 py-3 md:py-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(56,189,248,0.18)] border border-sky-100 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all"
          />
          {showSuggestions && activeSearchInput === 'main' && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-sky-100 rounded-2xl shadow-[0_12px_40px_rgba(56,189,248,0.2)] z-50 overflow-hidden"
            >
              {suggestions.map((s, idx) => renderSearchSuggestion(s, idx))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            data-tour="filter"
            onClick={() => setShowSearchFilter(true)}
            className="relative flex-1 md:flex-none flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_24px_rgba(56,189,248,0.18)] hover:shadow-[0_12px_32px_rgba(56,189,248,0.3)] hover:-translate-y-0.5 transition-all group border border-sky-100"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-sky-400 to-blue-500 shadow-lg shadow-sky-500/40 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition-transform">
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm md:text-base text-gray-900">Advanced Filter</div>
              <div className="text-xs text-gray-500 hidden md:block">Refine Your Search</div>
            </div>
            {activeAdvancedFilterCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 px-1.5 text-xs font-bold text-white shadow-md shadow-sky-500/50">
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            data-tour="event-assistant"
            onClick={() => navigate('/event-matcher')}
            className={`relative flex-1 md:flex-none flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_24px_rgba(56,189,248,0.18)] hover:shadow-[0_12px_32px_rgba(56,189,248,0.3)] hover:-translate-y-0.5 transition-all group border border-sky-100`}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/40">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 font-semibold text-sm md:text-base text-gray-900">
                Event Assistant
              </div>
              <div className="text-xs text-gray-500 hidden md:block">Plan your event, get matched</div>
            </div>
          </button>
        </div>
      </div>

      {/* Category navigation */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-hide md:mb-12">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
            selectedCategory === 'All'
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40'
              : 'bg-white/70 backdrop-blur-md text-gray-700 border border-sky-100 hover:border-sky-300 shadow-sm'
          }`}
        >
          All
        </button>
        {FREELANCER_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory((current) => (current === category.label ? 'All' : category.label))}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
              selectedCategory === category.label
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40'
                : 'bg-white/70 backdrop-blur-md text-gray-700 border border-sky-100 hover:border-sky-300 shadow-sm'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin shadow-lg shadow-sky-500/20" />
        </div>
      )}

      {!isLoading && profiles.length === 0 && (
        <div className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-10 text-center shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <h2 className="mb-2 text-xl font-bold text-gray-900">No freelancers found</h2>
          <p className="text-gray-600">Available freelancer profiles from the database will appear here.</p>
        </div>
      )}

      {!isLoading && !hasActiveSearch && recommendedProfiles.length > 0 && (
        <CarouselSection
          title="Recommended for you"
          profiles={recommendedProfiles}
          favoritedIds={favoritedIds}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {!isLoading && profiles.length > 0 && filteredProfiles.length === 0 && (
        <div className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-xl p-10 text-center shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <h2 className="mb-2 text-xl font-bold text-gray-900">
            {hasActiveSearch ? 'No matching freelancers' : 'No freelancers match these filters'}
          </h2>
          <p className="text-gray-600">
            {hasActiveSearch
              ? 'Try a different search, or choose another category.'
              : 'Adjust service, location, or price range in Advanced Filter.'}
          </p>
        </div>
      )}

      {!isLoading && hasActiveSearch && filteredProfiles.length > 0 && (
        <CarouselSection
          title={
            searchQuery.trim()
              ? `Search results for "${searchQuery.trim()}"`
              : `Popular ${pluralizeCategory(selectedCategory)}${popularSectionSuffix}`
          }
          profiles={filteredProfiles}
          favoritedIds={favoritedIds}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Carousel Sections — one per real category, client's chosen interests first */}
      {!isLoading && !hasActiveSearch && categorySections.map((section) => (
        <CarouselSection
          key={section.title}
          title={section.title}
          profiles={section.profiles}
          favoritedIds={favoritedIds}
          onToggleFavorite={handleToggleFavorite}
        />
      ))}

      <SiteFooter />

      {showSearchFilter && (
        <SearchFilterPanel
          initialFilters={filters}
          userLocation={userLocation}
          onClose={() => setShowSearchFilter(false)}
          onSearch={(nextFilters) => setFilters(nextFilters)}
          onClearAll={() => setSelectedCategory('All')}
        />
      )}

      {authPromptMessage && (
        <AuthPromptModal message={authPromptMessage} onClose={() => setAuthPromptMessage(null)} />
      )}
      </div>
    </div>
  );
}
