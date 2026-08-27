// Social links aren't a structured column yet — BecomeFreelancerPage.tsx saves
// them into freelancer_profiles.description as "Instagram: x | TikTok: y | ...".
// This parses that same format back out so the UI can render clickable links.
export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  behance?: string;
  website?: string;
}

const PATTERNS: Array<[keyof SocialLinks, RegExp]> = [
  ['instagram', /Instagram:\s*([^|]+)/i],
  ['tiktok', /TikTok:\s*([^|]+)/i],
  ['behance', /Behance:\s*([^|]+)/i],
  ['website', /Website:\s*([^|]+)/i],
];

export function parseSocialLinks(description?: string | null): SocialLinks {
  if (!description) return {};
  const links: SocialLinks = {};
  for (const [key, pattern] of PATTERNS) {
    const match = description.match(pattern);
    const value = match?.[1]?.trim();
    if (value) links[key] = value;
  }
  return links;
}

export function toSocialUrl(platform: keyof SocialLinks, value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, '');
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'behance':
      return `https://behance.net/${handle}`;
    case 'website':
      return trimmed.includes('.') ? `https://${trimmed}` : trimmed;
    default:
      return trimmed;
  }
}
