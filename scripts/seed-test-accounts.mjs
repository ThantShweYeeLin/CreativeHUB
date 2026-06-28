import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultPassword = process.env.TEST_ACCOUNT_PASSWORD || 'CreativeHub123!';

if (process.argv.includes('--help')) {
  console.log(`Usage: pnpm seed:test-accounts

Required environment variables:
  SUPABASE_SERVICE_ROLE_KEY   Service role key from Supabase

Optional environment variables:
  SUPABASE_URL                Falls back to VITE_SUPABASE_URL
  TEST_ACCOUNT_PASSWORD       Defaults to CreativeHub123!

The script is safe to re-run. It will create or update the test users,
their public profiles, freelancer profiles, and sample portfolio items.`);
  process.exit(0);
}

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local or export it before running the seed script.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testAccounts = [
  {
    email: 'mia.client@creativehub.test',
    fullName: 'Mia Carter',
    role: 'client',
    profile: {
      bio: 'Test client account for booking flows and messaging checks.',
      location: 'San Francisco, CA',
      rating: 0,
      total_reviews: 0,
    },
  },
  {
    email: 'noah.client@creativehub.test',
    fullName: 'Noah Bennett',
    role: 'client',
    profile: {
      bio: 'Test client account for request and payment state coverage.',
      location: 'Austin, TX',
      rating: 0,
      total_reviews: 0,
    },
  },
  {
    email: 'ava.freelancer@creativehub.test',
    fullName: 'Ava Thompson',
    role: 'freelancer',
    profile: {
      bio: 'Brand designer test account with an active freelancer profile.',
      location: 'New York, NY',
      location_latitude: 40.712776,
      location_longitude: -74.005974,
      location_place_id: 'seed-ava-nyc',
      rating: 4.9,
      total_reviews: 18,
    },
    freelancerProfile: {
      title: 'Brand Designer',
      description: 'Creates identity systems, social kits, and campaign visuals for fast-moving startups.',
      hourly_rate: 55,
      skills: ['Branding', 'Logo Design', 'Art Direction'],
      styles: ['Minimal', 'Editorial', 'Bold'],
      experience_years: 6,
      portfolio_count: 2,
      is_available: true,
    },
    portfolios: [
      {
        title: 'Northwind Rebrand',
        description: 'Identity refresh with packaging direction and launch assets.',
        image_urls: [],
        project_url: 'https://example.com/northwind-rebrand',
        tools_used: ['Figma', 'Illustrator', 'Photoshop'],
        featured: true,
      },
      {
        title: 'Harvest Social Launch',
        description: 'Social media launch kit for a seasonal e-commerce campaign.',
        image_urls: [],
        project_url: 'https://example.com/harvest-social-launch',
        tools_used: ['Figma', 'After Effects'],
        featured: false,
      },
    ],
  },
  {
    email: 'liam.freelancer@creativehub.test',
    fullName: 'Liam Brooks',
    role: 'freelancer',
    profile: {
      bio: 'Motion design test account for search, portfolio, and booking scenarios.',
      location: 'Seattle, WA',
      location_latitude: 47.606209,
      location_longitude: -122.332069,
      location_place_id: 'seed-liam-seattle',
      rating: 4.8,
      total_reviews: 11,
    },
    freelancerProfile: {
      title: 'Motion Designer',
      description: 'Builds animated explainers, ads, and UI motion systems for product teams.',
      hourly_rate: 68,
      skills: ['Motion Design', 'Video Editing', 'UI Animation'],
      styles: ['Cinematic', 'Playful', 'Clean'],
      experience_years: 8,
      portfolio_count: 2,
      is_available: true,
    },
    portfolios: [
      {
        title: 'Pulse App Trailer',
        description: 'Launch trailer focused on onboarding and product storytelling.',
        image_urls: [],
        project_url: 'https://example.com/pulse-app-trailer',
        tools_used: ['After Effects', 'Premiere Pro', 'Figma'],
        featured: true,
      },
      {
        title: 'Nova SaaS Explainer',
        description: 'Narrated product explainer with motion graphics and social cutdowns.',
        image_urls: [],
        project_url: 'https://example.com/nova-saas-explainer',
        tools_used: ['After Effects', 'Illustrator'],
        featured: false,
      },
    ],
  },
  {
    email: 'nina.photographer@creativehub.test',
    fullName: 'Nina Wong',
    role: 'freelancer',
    profile: {
      bio: 'Bangkok photographer for portrait and lifestyle projects.',
      location: 'Siam, Bangkok',
      location_latitude: 13.7466,
      location_longitude: 100.5347,
      location_place_id: 'seed-nina-bkk-siam',
      rating: 4.7,
      total_reviews: 24,
    },
    freelancerProfile: {
      title: 'Photographer',
      description: 'Outdoor portrait and campaign photographer available for fast bookings.',
      hourly_rate: 75,
      skills: ['Photography', 'Portrait', 'Lighting'],
      styles: ['Editorial', 'Natural Light'],
      experience_years: 7,
      portfolio_count: 2,
      is_available: true,
    },
    portfolios: [
      {
        title: 'Siam Street Portraits',
        description: 'Urban portrait session around Siam district.',
        image_urls: [],
        project_url: 'https://example.com/siam-street-portraits',
        tools_used: ['Lightroom', 'Photoshop'],
        featured: true,
      },
    ],
  },
  {
    email: 'pim.makeup@creativehub.test',
    fullName: 'Pim Chai',
    role: 'freelancer',
    profile: {
      bio: 'Makeup artist focused on bridal and beauty campaigns in central Bangkok.',
      location: 'Chidlom, Bangkok',
      location_latitude: 13.7440,
      location_longitude: 100.5453,
      location_place_id: 'seed-pim-bkk-chidlom',
      rating: 4.9,
      total_reviews: 31,
    },
    freelancerProfile: {
      title: 'Makeup Artist',
      description: 'High-end beauty and bridal makeup with studio and on-site service.',
      hourly_rate: 95,
      skills: ['Makeup', 'Beauty', 'Bridal'],
      styles: ['Luxury', 'Soft Glam'],
      experience_years: 9,
      portfolio_count: 2,
      is_available: true,
    },
    portfolios: [
      {
        title: 'Chidlom Bridal Studio',
        description: 'Bridal looks and skincare prep for destination weddings.',
        image_urls: [],
        project_url: 'https://example.com/chidlom-bridal-studio',
        tools_used: ['Airbrush Kit', 'Studio Lighting'],
        featured: true,
      },
    ],
  },
  {
    email: 'mint.videographer@creativehub.test',
    fullName: 'Mint Kriang',
    role: 'freelancer',
    profile: {
      bio: 'Videographer creating short-form campaign content around Bangkok CBD.',
      location: 'Asok, Bangkok',
      location_latitude: 13.7373,
      location_longitude: 100.5602,
      location_place_id: 'seed-mint-bkk-asok',
      rating: 4.6,
      total_reviews: 16,
    },
    freelancerProfile: {
      title: 'Videographer',
      description: 'Short-form campaign video production and post editing.',
      hourly_rate: 88,
      skills: ['Videography', 'Editing', 'Color Grading'],
      styles: ['Cinematic', 'Minimal'],
      experience_years: 5,
      portfolio_count: 2,
      is_available: true,
    },
    portfolios: [
      {
        title: 'Asok Brand Reel',
        description: 'Fast turnaround social campaign reel for a fashion brand.',
        image_urls: [],
        project_url: 'https://example.com/asok-brand-reel',
        tools_used: ['Premiere Pro', 'DaVinci Resolve'],
        featured: true,
      },
    ],
  },
];

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const users = data.users || [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return match;
    }

    if (users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function ensureAuthUser(account) {
  const existingUser = await findUserByEmail(account.email);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: account.email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
        role: account.role,
      },
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
      role: account.role,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function ensurePublicUser(user, account) {
  const payload = {
    id: user.id,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    ...account.profile,
  };

  const firstAttempt = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (!firstAttempt.error) {
    return;
  }

  const message = (firstAttempt.error.message || '').toLowerCase();
  if (message.includes('location_latitude') || message.includes('location_longitude') || message.includes('location_place_id')) {
    const {
      location_latitude: _lat,
      location_longitude: _lng,
      location_place_id: _pid,
      ...safeProfile
    } = account.profile || {};

    const fallbackPayload = {
      id: user.id,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
      ...safeProfile,
    };

    const fallbackAttempt = await supabase.from('users').upsert(fallbackPayload, { onConflict: 'id' });
    if (fallbackAttempt.error) {
      throw fallbackAttempt.error;
    }
    return;
  }

  throw firstAttempt.error;
}

async function ensureFreelancerProfile(userId, account) {
  if (!account.freelancerProfile) {
    return null;
  }

  const { data, error } = await supabase
    .from('freelancer_profiles')
    .upsert({ user_id: userId, ...account.freelancerProfile }, { onConflict: 'user_id' })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function ensurePortfolios(freelancerId, account) {
  if (!freelancerId || !account.portfolios?.length) {
    return;
  }

  const { data: existingItems, error: existingItemsError } = await supabase
    .from('portfolios')
    .select('title')
    .eq('freelancer_id', freelancerId);

  if (existingItemsError) {
    throw existingItemsError;
  }

  const existingTitles = new Set((existingItems || []).map((item) => item.title));
  const missingItems = account.portfolios
    .filter((item) => !existingTitles.has(item.title))
    .map((item) => ({ freelancer_id: freelancerId, ...item }));

  if (!missingItems.length) {
    return;
  }

  const { error } = await supabase.from('portfolios').insert(missingItems);
  if (error) {
    throw error;
  }
}

async function main() {
  console.log(`Seeding ${testAccounts.length} CreativeHUB test accounts...`);

  for (const account of testAccounts) {
    const user = await ensureAuthUser(account);
    await ensurePublicUser(user, account);
    const freelancerId = await ensureFreelancerProfile(user.id, account);
    await ensurePortfolios(freelancerId, account);
    console.log(`- ${account.email} (${account.role}) ready`);
  }

  console.log(`\nShared password: ${defaultPassword}`);
}

main().catch((error) => {
  console.error('Failed to seed test accounts.');
  console.error(error);
  process.exit(1);
});