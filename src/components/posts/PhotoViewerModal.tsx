import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface PhotoViewerModalProps {
  url: string;
  alt?: string;
  isVideo?: boolean;
  onClose: () => void;
}

export function PhotoViewerModal({ url, alt, isVideo, onClose }: PhotoViewerModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    // Portaled to document.body - pages like ForYouPage wrap their content
    // in a `relative z-10` div, which creates its own stacking context and
    // traps this overlay's z-index inside it, underneath MainLayout's header
    // and the mobile bottom nav (both z-[1200]). On phones that left the
    // bottom nav covering the comment input, so it couldn't be typed in.
    // See the same fix in SearchFilterPanel.tsx.
    <div
      // Above the global mobile bottom nav (z-[1200], see MobileBottomNav) and
      // PostDetailModal (z-[1300]), which it can be opened from.
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/90 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-gray-700 shadow"
      >
        <X className="h-5 w-5" />
      </button>

      {isVideo ? (
        <video src={url} className="max-h-[90vh] max-w-[90vw] object-contain" controls autoPlay />
      ) : (
        <ImageWithFallback src={url} alt={alt || 'Post image'} className="max-h-[90vh] max-w-[90vw] object-contain" />
      )}
    </div>,
    document.body
  );
}

export default PhotoViewerModal;
