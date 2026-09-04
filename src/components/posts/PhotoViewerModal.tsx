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

  return (
    <div
      // Above the global mobile bottom nav (z-[1200], see MobileBottomNav).
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/90 p-4"
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
    </div>
  );
}

export default PhotoViewerModal;
