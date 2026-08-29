import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_ICONS, isValidSocialUrl, type SocialPlatform } from '../../../lib/socialPlatforms';

interface StepPortfolioProps {
  links: Partial<Record<SocialPlatform, string>>;
  onLinksChange: (links: Partial<Record<SocialPlatform, string>>) => void;
}

export function StepPortfolio({ links, onLinksChange }: StepPortfolioProps) {
  const setLink = (platform: SocialPlatform, value: string) => {
    onLinksChange({ ...links, [platform]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-700">Your portfolio</p>
        <p className="text-xs text-gray-500">
          Optional — share links to your Instagram, Facebook, or portfolio website instead of uploading files. You
          can add or edit more later.
        </p>
      </div>

      {SOCIAL_PLATFORMS.map((platform) => {
        const Icon = SOCIAL_PLATFORM_ICONS[platform];
        const value = links[platform] || '';
        const showError = value.trim().length > 0 && !isValidSocialUrl(value);

        return (
          <div key={platform}>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
              <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span className="w-20 flex-shrink-0 text-sm font-semibold text-gray-600">{platform}</span>
              <input
                value={value}
                onChange={(event) => setLink(platform, event.target.value)}
                placeholder={`https://...`}
                className="w-full bg-transparent py-3 focus:outline-none"
              />
            </div>
            {showError && <p className="mt-1 text-xs font-semibold text-red-600">Enter a full link starting with https://</p>}
          </div>
        );
      })}
    </div>
  );
}
