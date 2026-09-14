import type { PostShareMethod } from './database.types';

export type { PostShareMethod };

/**
 * Canonical public URL for a post. Always derived from the current origin
 * so it's correct on localhost, a Vercel preview deployment, or production
 * — never hardcode a domain here.
 */
export function getPostShareUrl(postId: string): string {
  return `${window.location.origin}/post/${postId}`;
}

export type CopyLinkResult = { ok: true } | { ok: false; message: string };

/**
 * Copies a post's share URL to the clipboard. Tries the async Clipboard
 * API first (requires a secure context), falling back to the legacy
 * execCommand approach for older browsers or non-HTTPS/non-localhost
 * origins — same fallback ForYouPage's existing copyShareLink already
 * used, extracted here so both it and the new PostShareMenu share one
 * implementation instead of two copies of the same fallback dance.
 */
export async function copyPostLink(postId: string): Promise<CopyLinkResult> {
  const url = getPostShareUrl(postId);

  try {
    if (!navigator.clipboard || !window.isSecureContext) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(url);
    return { ok: true };
  } catch {
    // Fall through to the legacy fallback below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
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

  return fallbackWorked ? { ok: true } : { ok: false, message: "Couldn't copy the link. Please try again." };
}

export type NativeShareResult = 'shared' | 'unsupported' | 'cancelled' | 'error';

export function isNativeShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Web Share API wrapper. Returns 'cancelled' (not 'error') when the user
 * dismisses the native sheet themselves — callers must not show an error
 * toast for that case, only for a genuine failure.
 */
export async function shareNative(params: { title: string; text?: string; url: string }): Promise<NativeShareResult> {
  if (!isNativeShareSupported()) {
    return 'unsupported';
  }
  try {
    await navigator.share(params);
    return 'shared';
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return 'cancelled';
    }
    return 'error';
  }
}

function openExternalShareWindow(url: string) {
  // noopener/noreferrer: never hand the opened page a `window.opener`
  // reference back into the app. A reasonable popup size rather than a
  // full new tab keeps CreativeHUB visible behind it.
  const popup = window.open(url, '_blank', 'noopener,noreferrer,width=600,height=520');
  return Boolean(popup);
}

export function shareToWhatsApp(postId: string): boolean {
  const url = getPostShareUrl(postId);
  const text = `Check out this creative post on CreativeHUB: ${url}`;
  return openExternalShareWindow(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

export function shareToFacebook(postId: string): boolean {
  const url = getPostShareUrl(postId);
  return openExternalShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
}

export function shareToX(postId: string): boolean {
  const url = getPostShareUrl(postId);
  // Deliberately short and generic — never the post caption, per spec.
  const text = 'Check out this creative work on CreativeHUB.';
  return openExternalShareWindow(
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  );
}
