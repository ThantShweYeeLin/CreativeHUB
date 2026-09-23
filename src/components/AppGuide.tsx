import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import {
  Bell,
  Bot,
  Briefcase,
  Compass,
  Menu,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// First-run walkthrough of what each part of the app is for. Each step
// points at an element tagged `data-tour="<target>"` elsewhere in the app
// (header, bottom nav, Explore's search row, the chat assistant button).
// A step whose target isn't on screen right now - e.g. the desktop nav
// pills on a phone, or Explore's search row on another page - is skipped,
// so the same step list works on every screen size and page.
//
// Only for new users - accounts created on or after GUIDE_RELEASED_AT, so
// people who already know the app never see it - and only once per user.
// "Seen" is saved on the Supabase auth user's metadata (so it holds across
// every device they sign in on), with a localStorage copy that skips the
// network check on later visits from the same browser. It's marked seen
// the moment it opens, not when it's closed, so navigating away mid-tour
// doesn't bring it back. Anyone can still open it again by choice from the
// header menu's "App Guide" item, which fires OPEN_APP_GUIDE_EVENT.

export const OPEN_APP_GUIDE_EVENT = 'creativehub:open-app-guide';

const GUIDE_RELEASED_AT = new Date('2026-09-23T00:00:00Z');

interface GuideStep {
  target?: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: GuideStep[] = [
  {
    icon: Sparkles,
    title: 'Welcome to CreativeHUB',
    body: 'Here is a quick tour of what each part of the app does.',
  },
  {
    target: 'nav',
    icon: Compass,
    title: 'Explore, Map & For You',
    body: 'Explore lists freelancers to hire, Map shows who is near you, and For You is the community feed of posts. Profile opens your own page.',
  },
  {
    target: 'search',
    icon: Search,
    title: 'Search freelancers',
    body: 'Type a name, skill or what you need, like "wedding photographer", and results update as you type.',
  },
  {
    target: 'filter',
    icon: SlidersHorizontal,
    title: 'Advanced Filter',
    body: 'Narrow results by category, budget, rating and location.',
  },
  {
    target: 'event-assistant',
    icon: Sparkles,
    title: 'Event Assistant',
    body: 'Describe your event and get a matched team of freelancers suggested for you.',
  },
  {
    target: 'role-action',
    icon: Briefcase,
    title: 'Your dashboard',
    body: 'Become a freelancer, or open your freelancer dashboard to manage requests and bookings.',
  },
  {
    target: 'notifications',
    icon: Bell,
    title: 'Notifications',
    body: 'New requests, messages, comments and booking updates show up here.',
  },
  {
    target: 'profile',
    icon: User,
    title: 'Your account',
    body: 'Open your profile to update your photo and details.',
  },
  {
    target: 'menu',
    icon: Menu,
    title: 'Menu',
    body: 'Messages, requests, bookings, favorites, saved posts, support tickets, settings, and this guide again.',
  },
  {
    target: 'assistant',
    icon: Bot,
    title: 'Chat assistant',
    body: 'Stuck? Ask the assistant any question about using CreativeHUB.',
  },
];

const SPOTLIGHT_PADDING = 6;
const CARD_GAP = 12;
const EDGE = 16;

function findVisibleTarget(target: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden') {
      return element;
    }
  }
  return null;
}

function storageKey(userId: string) {
  return `creativehub:app-guide-seen:${userId}`;
}

function hasSeenGuide(userId: string) {
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markGuideSeen(userId: string) {
  try {
    window.localStorage.setItem(storageKey(userId), '1');
  } catch {
    // Private mode / blocked storage - the auth metadata flag still keeps
    // it from showing again, this just skips the network check.
  }
}

export function AppGuide() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  // Steps resolved against what's actually on screen when the guide opens.
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [cardElement, setCardElement] = useState<HTMLDivElement | null>(null);

  const open = useCallback(() => {
    setSteps(STEPS.filter((step) => !step.target || findVisibleTarget(step.target)));
    setIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    window.addEventListener(OPEN_APP_GUIDE_EVENT, open);
    return () => window.removeEventListener(OPEN_APP_GUIDE_EVENT, open);
  }, [open]);

  // Opens on Explore (where every step has something to point at) for a
  // new user who hasn't seen it yet. Delayed so the page has rendered its
  // targets first.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || location.pathname !== '/explore' || hasSeenGuide(userId)) {
      return;
    }
    let cancelled = false;
    let timer = 0;
    void supabase.auth.getUser().then(({ data }) => {
      const authUser = data.user;
      if (cancelled || !authUser) {
        return;
      }
      const isNewUser = new Date(authUser.created_at) >= GUIDE_RELEASED_AT;
      if (!isNewUser || authUser.user_metadata?.app_guide_seen) {
        markGuideSeen(userId);
        return;
      }
      timer = window.setTimeout(() => {
        open();
        markGuideSeen(userId);
        void supabase.auth.updateUser({ data: { app_guide_seen: true } });
      }, 900);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, location.pathname, open]);

  // Leaving the page mid-tour would leave the spotlight pointing at
  // elements that no longer exist.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const step = steps[index];

  // Track the current target's position through scrolling and resizing.
  useLayoutEffect(() => {
    if (!isOpen || !step?.target) {
      setRect(null);
      return;
    }
    const element = findVisibleTarget(step.target);
    if (!element) {
      setRect(null);
      return;
    }
    const initial = element.getBoundingClientRect();
    if (initial.top < 80 || initial.bottom > window.innerHeight - 80) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(element.getBoundingClientRect()));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, step]);

  useLayoutEffect(() => {
    if (cardElement) {
      setCardHeight(cardElement.getBoundingClientRect().height);
    }
  }, [cardElement, index, steps]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, steps.length]);

  const cardStyle = useMemo<CSSProperties>(() => {
    const width = Math.min(340, window.innerWidth - EDGE * 2);
    if (!rect) {
      return { width, left: (window.innerWidth - width) / 2, top: Math.max(EDGE, (window.innerHeight - cardHeight) / 2) };
    }
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - EDGE);
    const spaceBelow = window.innerHeight - rect.bottom;
    const fitsBelow = spaceBelow >= cardHeight + CARD_GAP + SPOTLIGHT_PADDING + EDGE;
    const top = fitsBelow
      ? rect.bottom + SPOTLIGHT_PADDING + CARD_GAP
      : Math.max(EDGE, rect.top - SPOTLIGHT_PADDING - CARD_GAP - cardHeight);
    return { width, left, top };
  }, [rect, cardHeight]);

  if (!isOpen || !step) {
    return null;
  }

  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  return createPortal(
    // Above every other overlay (NotificationsPanel tops out at z-[1501]).
    <div className="fixed inset-0 z-[1600]" role="dialog" aria-modal="true" aria-labelledby="app-guide-title">
      {rect ? (
        // Spotlight: a clear window around the target, with a light dim
        // everywhere else (the huge box-shadow) so the page stays visible
        // behind the guide.
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-sky-400 transition-all duration-300"
          style={{
            left: rect.left - SPOTLIGHT_PADDING,
            top: rect.top - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.35)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/35" />
      )}

      <div
        ref={setCardElement}
        className="fixed overflow-hidden rounded-2xl border border-sky-100 bg-white/85 shadow-[0_20px_60px_rgba(56,189,248,0.25)] backdrop-blur-xl transition-[top,left] duration-300 animate-fadeIn"
        style={cardStyle}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-sky-500/90 to-blue-600/90 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
            <Icon className="h-4 w-4" />
          </span>
          <h2 id="app-guide-title" className="flex-1 text-sm font-bold text-white">
            {step.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close guide"
            className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm leading-relaxed text-gray-700">{step.body}</p>

        <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-4">
          <div className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-4 bg-sky-500' : 'w-1.5 bg-sky-200'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-full border border-sky-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-sky-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? close() : setIndex(index + 1))}
              className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-500/30 transition-transform hover:scale-105"
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
