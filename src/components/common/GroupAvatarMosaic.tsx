import { Avatar } from './Avatar';
import { ImageWithFallback } from './ImageWithFallback';

interface GroupAvatarMosaicProps {
  /** Other members' avatar URLs, in display order - the caller decides who's "other" (self already excluded). */
  avatarUrls: (string | null | undefined)[];
  alt: string;
  fallbackSrc: string;
  sizeClassName?: string;
}

// A group chat's "picture" was always just one arbitrary member's own
// avatar (whichever happened to sort first) - every other platform's group
// icon is a mosaic of several members instead, so a 1:1 thread and a group
// thread actually look different at a glance in the inbox list. One member
// falls back to a plain Avatar (nothing to mosaic); 2 splits the circle in
// half; 3 gives one half to the first member and splits the other half
// between the next two; 4+ shows a straight 2x2 of the first four.
export function GroupAvatarMosaic({ avatarUrls, alt, fallbackSrc, sizeClassName = 'w-12 h-12' }: GroupAvatarMosaicProps) {
  const urls = avatarUrls.filter((url): url is string => Boolean(url)).slice(0, 4);

  if (urls.length <= 1) {
    return <Avatar src={urls[0] || fallbackSrc} alt={alt} sizeClassName={sizeClassName} />;
  }

  const tile = (url: string, key: number, extraClassName = '') => (
    <div key={key} className={`overflow-hidden bg-sky-50 ${extraClassName}`}>
      <ImageWithFallback src={url} alt="" className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm ${sizeClassName}`} aria-label={alt} role="img">
      {urls.length === 2 && <div className="grid h-full w-full grid-cols-2 gap-px bg-white">{urls.map((url, i) => tile(url, i))}</div>}
      {urls.length === 3 && (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white">
          {tile(urls[0], 0, 'row-span-2')}
          {tile(urls[1], 1, '')}
          {tile(urls[2], 2, '')}
        </div>
      )}
      {urls.length === 4 && (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white">{urls.map((url, i) => tile(url, i))}</div>
      )}
    </div>
  );
}
