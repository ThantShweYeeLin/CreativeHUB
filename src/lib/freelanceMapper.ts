export interface FreelancerPortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  projectUrl?: string;
  createdAt?: string;
  likes?: number;
  comments?: number;
}

export interface FreelancerMapProfile {
  id: string;
  userId?: string;
  fullName: string;
  username: string;
  profileImage: string;
  coverImage: string;
  profession: string;
  bio: string;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  totalProjects: number;
  totalReviews: number;
  location: string;
  skills: string[];
  portfolio: FreelancerPortfolioItem[];
  availability: string[];
  email: string;
  phone: string;
  hourlyRate?: number;
  experienceYears?: number;
  isAvailable: boolean;
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400';

const PLACEHOLDER_COVER =
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200';

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function firstRecord(value: unknown): Record<string, any> {
  if (Array.isArray(value)) {
    return asRecord(value[0]);
  }

  return asRecord(value);
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizePortfolio(value: unknown): FreelancerPortfolioItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: String(index),
          title: `Project ${index + 1}`,
          description: '',
          imageUrl: item,
        };
      }

      const record = asRecord(item);
      const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [];
      const imageUrl = stringValue(record.imageUrl, record.image_url, record.image, imageUrls[0]);

      return {
        id: stringValue(record.id, String(index)),
        title: stringValue(record.title, `Project ${index + 1}`),
        description: stringValue(record.description),
        imageUrl,
        projectUrl: stringValue(record.projectUrl, record.project_url),
        createdAt: stringValue(record.created_at, record.createdAt) || undefined,
        likes: numberValue(record.likes, record.like_count) ?? undefined,
        comments: numberValue(record.comments, record.comment_count) ?? undefined,
      };
    })
    .filter((item) => item.imageUrl);
}

export function normalizeFreelancer(row: unknown): FreelancerMapProfile {
  const record = asRecord(row);
  const user = firstRecord(record.users ?? record.user);
  const freelancerProfile = asRecord(record.freelancerProfile ?? record.freelancer_profile);
  const source = Object.keys(freelancerProfile).length > 0 ? { ...freelancerProfile, ...record } : record;
  const portfolio = normalizePortfolio(source.portfolio ?? source.portfolios);
  const email = stringValue(source.email, user.email);
  const fullName = stringValue(source.fullName, source.full_name, source.name, user.full_name, user.name, email);
  const username = stringValue(source.username, user.username, email ? email.split('@')[0] : '');
  const profession = stringValue(source.profession, source.title, source.specialty, 'Freelancer');
  const profileImage = stringValue(
    source.profileImage,
    source.profile_image,
    source.avatarUrl,
    source.avatar_url,
    user.avatar_url,
    user.avatarUrl,
    PLACEHOLDER_IMAGE
  );
  const coverImage = stringValue(
    source.coverImage,
    source.cover_image,
    source.coverUrl,
    source.cover_url,
    portfolio[0]?.imageUrl,
    PLACEHOLDER_COVER
  );
  const rating = numberValue(source.rating, user.rating) ?? 0;
  const totalReviews = numberValue(source.totalReviews, source.total_reviews, user.total_reviews, source.reviews?.length) ?? 0;
  const totalProjects = numberValue(source.totalProjects, source.total_projects, source.projects, source.portfolio_count) ?? portfolio.length;
  const isAvailable = typeof source.is_available === 'boolean' ? source.is_available : source.availability !== false;
  const availability = stringArray(source.availability);

  return {
    id: stringValue(source.id, source._id),
    userId: stringValue(source.user_id, user.id, source.userId) || undefined,
    fullName,
    username,
    profileImage,
    coverImage,
    profession,
    bio: stringValue(source.bio, source.description),
    latitude: numberValue(source.latitude, source.lat, source.location_latitude),
    longitude: numberValue(source.longitude, source.lng, source.lon, source.location_longitude),
    rating,
    totalProjects,
    totalReviews,
    location: stringValue(source.location, user.location),
    skills: stringArray(source.skills),
    portfolio,
    availability: availability.length > 0 ? availability : isAvailable ? ['Available'] : ['Unavailable'],
    email,
    phone: stringValue(source.phone, user.phone),
    hourlyRate: numberValue(source.hourlyRate, source.hourly_rate) ?? undefined,
    experienceYears: numberValue(source.experienceYears, source.experience_years) ?? undefined,
    isAvailable,
  };
}