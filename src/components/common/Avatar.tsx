import type { Gender } from '../../lib/database.types';
import { ImageWithFallback } from './ImageWithFallback';
import { GenderBadge } from './GenderBadge';

interface AvatarProps {
  src: string;
  alt: string;
  gender?: Gender | null;
  sizeClassName?: string;
  imgClassName?: string;
  badgeSize?: 'xs' | 'sm' | 'md';
  badgePosition?: 'bottom-right' | 'top-right' | 'top-left';
}

export function Avatar({
  src,
  alt,
  gender,
  sizeClassName = 'w-10 h-10',
  imgClassName = 'w-full h-full object-cover',
  badgeSize = 'sm',
  badgePosition = 'bottom-right',
}: AvatarProps) {
  return (
    <div className={`relative inline-block flex-shrink-0 ${sizeClassName}`}>
      <div className="h-full w-full overflow-hidden rounded-full">
        <ImageWithFallback src={src} alt={alt} className={imgClassName} />
      </div>
      <GenderBadge gender={gender} size={badgeSize} position={badgePosition} />
    </div>
  );
}

export default Avatar;
