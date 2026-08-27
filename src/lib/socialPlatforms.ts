import { Dribbble, Facebook, Globe, Instagram, Music2, Palette, Youtube, type LucideIcon } from 'lucide-react';

export const SOCIAL_PLATFORMS = ['Instagram', 'TikTok', 'Behance', 'Dribbble', 'Facebook', 'YouTube', 'Website'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
}

export const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, LucideIcon> = {
  Instagram,
  TikTok: Music2,
  Behance: Palette,
  Dribbble,
  Facebook,
  YouTube: Youtube,
  Website: Globe,
};

export function isValidSocialUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
