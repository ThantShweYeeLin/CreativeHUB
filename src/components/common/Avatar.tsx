import type { Gender } from '../../lib/database.types';
import { ImageWithFallback } from './ImageWithFallback';

interface AvatarProps {
  src: string;
  alt: string;
  // Accepted for backward compatibility with existing callers, but no
  // longer rendered — gender badges were removed from all profile pictures.
  gender?: Gender | null;
  sizeClassName?: string;
  imgClassName?: string;
  badgeSize?: 'xs' | 'sm' | 'md';
  badgePosition?: 'bottom-right' | 'top-right' | 'top-left';
}

export function Avatar({
  src,
  alt,
  sizeClassName = 'w-10 h-10',
  imgClassName = 'w-full h-full object-cover',
}: AvatarProps) {
  return (
    <div className={`relative inline-block flex-shrink-0 ${sizeClassName}`}>
      <div className="h-full w-full overflow-hidden rounded-full">
        <ImageWithFallback src={src} alt={alt} className={imgClassName} />
      </div>
    </div>
  );
}

export default Avatar;
