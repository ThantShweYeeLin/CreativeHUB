import { useEffect, useRef, useState } from 'react';
import { Link2, Share2 } from 'lucide-react';
import {
  copyPostLink,
  getPostShareUrl,
  isNativeShareSupported,
  shareNative,
  shareToFacebook,
  shareToWhatsApp,
  shareToX,
  type PostShareMethod,
} from '../lib/postShare';

interface PostShareMenuProps {
  postId: string;
  /** e.g. "CreativeHUB post by @username" — used as the native-share title. */
  title: string;
  /** Short caption/description for native share `text`. Never used for X (kept generic there per spec). */
  description?: string;
  /** Trigger button styling — the caller decides how it fits its own layout (post card row vs. a standalone page button). */
  triggerClassName?: string;
  triggerLabel?: string;
  /** Full custom trigger content (e.g. a two-line label to match a sibling button) — overrides triggerLabel/the default icon when given. */
  children?: React.ReactNode;
  align?: 'left' | 'right';
  onShared?: (method: PostShareMethod) => void;
  /** Extra menu items rendered after the 5 built-in options (e.g. "Send in Messages" on the For You feed) — kept out of the base 5 so this component stays generically reusable. Receives a `close` callback so a caller-owned item (which likely opens its own separate overlay, like a mutuals picker) can close this menu first instead of leaving it open underneath. */
  extraItems?: (close: () => void) => React.ReactNode;
}

const PLATFORM_BADGE_CLASS = 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white';

export function PostShareMenu({
  postId,
  title,
  description,
  triggerClassName,
  triggerLabel = 'Share',
  children,
  align = 'right',
  onShared,
  extraItems,
}: PostShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = (event: React.MouseEvent) => {
    // The share button often sits in the same action row as Like/Comment/
    // Favorite — never let opening this menu bubble up to a card-level
    // click handler.
    event.stopPropagation();
    setStatus(null);
    setIsOpen((current) => !current);
  };

  const handleCopyLink = async () => {
    const result = await copyPostLink(postId);
    if (result.ok) {
      setStatus({ kind: 'success', message: 'Post link copied!' });
      onShared?.('copy_link');
    } else {
      setStatus({ kind: 'error', message: result.message });
    }
  };

  const handleNativeShare = async () => {
    const url = getPostShareUrl(postId);
    if (!isNativeShareSupported()) {
      // Spec: fall back to Copy Link rather than showing a broken/dead option.
      await handleCopyLink();
      return;
    }
    const result = await shareNative({ title, text: description, url });
    if (result === 'shared') {
      onShared?.('native');
      setIsOpen(false);
    } else if (result === 'cancelled') {
      // The user closed the native sheet themselves — not an error.
      setIsOpen(false);
    } else if (result === 'unsupported') {
      await handleCopyLink();
    } else {
      setStatus({ kind: 'error', message: "Couldn't share this post." });
    }
  };

  const handleWhatsApp = () => {
    shareToWhatsApp(postId);
    onShared?.('whatsapp');
    setIsOpen(false);
  };

  const handleFacebook = () => {
    shareToFacebook(postId);
    onShared?.('facebook');
    setIsOpen(false);
  };

  const handleX = () => {
    shareToX(postId);
    onShared?.('x');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Share post"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={
          triggerClassName ||
          'flex items-center gap-2 rounded-full bg-gray-50 px-3 py-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900'
        }
      >
        {children || (
          <>
            <Share2 className="h-5 w-5" />
            {triggerLabel && <span className="text-sm font-semibold">{triggerLabel}</span>}
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Share this post"
          className={`absolute top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Share this post</p>

          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              void handleCopyLink();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span className={`${PLATFORM_BADGE_CLASS} bg-gray-700`}>
              <Link2 className="h-4 w-4" />
            </span>
            Copy Link
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              void handleNativeShare();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span className={`${PLATFORM_BADGE_CLASS} bg-gray-900`}>
              <Share2 className="h-4 w-4" />
            </span>
            Share
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              handleWhatsApp();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span className={`${PLATFORM_BADGE_CLASS} bg-[#25D366]`}>W</span>
            WhatsApp
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              handleFacebook();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span className={`${PLATFORM_BADGE_CLASS} bg-[#1877F2]`}>f</span>
            Facebook
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              handleX();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span className={`${PLATFORM_BADGE_CLASS} bg-black`}>X</span>
            X
          </button>

          {extraItems?.(() => setIsOpen(false))}

          {status && (
            <p
              className={`mt-1 rounded-xl px-3 py-2 text-xs font-medium ${
                status.kind === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
