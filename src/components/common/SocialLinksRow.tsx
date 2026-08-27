import { SOCIAL_PLATFORM_ICONS, type SocialLink, type SocialPlatform } from '../../lib/socialPlatforms';

interface SocialLinksRowProps {
  links: SocialLink[];
  className?: string;
}

// Deliberately minimal: icon + platform name only, no description or
// preview text — clicking the platform name opens the freelancer's page.
export function SocialLinksRow({ links, className }: SocialLinksRowProps) {
  if (!links.length) return null;

  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      {links.map((link) => {
        const Icon = SOCIAL_PLATFORM_ICONS[link.platform as SocialPlatform];
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {link.platform}
          </a>
        );
      })}
    </div>
  );
}
