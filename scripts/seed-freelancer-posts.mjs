// Adds two new For You feed posts per existing freelancer (client_posts -
// the table's name is legacy; client_id is just an author FK, see
// ForYouPage.tsx's mapClientPostRowToFeedPost), each captioned for that
// freelancer's own category (freelancer_profiles.title) so their feed
// presence actually reflects the work they do, not generic filler.
//
// Additive only - never touches or removes any existing post. Images use
// the same picsum.photos/seed/<name>-<n> deterministic-placeholder pattern
// already used by prior seeded rows in this project (see e.g. the
// "Namfon Yodkaew" sample post), not a real photo host, so this never
// depends on guessing a real Unsplash photo id that might not exist.
//
// Usage: pnpm exec tsx --env-file=.env.local scripts/seed-freelancer-posts.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const CAPTIONS_BY_CATEGORY = {
  Photographer: [
    'Golden hour portraits from yesterday\'s session — this is why I love what I do. #creativehub #photography',
    'Wedding gallery delivered! A few of my favorite frames from the day. #creativehub #weddingphotography',
    'Testing a new lens for portrait work this week — the bokeh is unreal. #creativehub #photography',
  ],
  Videographer: [
    'Behind the scenes from a wedding shoot this weekend! Highlight reel coming soon. #creativehub #videography',
    'Just wrapped editing a same-day-edit video — nothing beats seeing the couple\'s reaction. #creativehub #videography',
    'Sneak peek from set for a new showreel dropping soon. #creativehub #filmmaking',
  ],
  'Makeup Artist': [
    'Bridal glam for today\'s ceremony — soft, romantic, and long-lasting all day. #creativehub #bridalmakeup',
    'Loved creating this bold look for a client\'s birthday shoot today. #creativehub #makeupartist',
    'Kit restocked and ready for a full week of bookings. #creativehub #mua',
  ],
  'Hair Stylist': [
    'Updo perfection for today\'s bride — every pin placed just right. #creativehub #bridalhair',
    'Fresh cut, fresh confidence. Loved this transformation today. #creativehub #hairstylist',
    'Testing new braiding techniques ahead of wedding season. #creativehub #hairstyling',
  ],
  'Fashion Designer': [
    'Latest piece from my new collection, fresh off the sewing machine. #creativehub #fashiondesign',
    'Fitting day! Small adjustments make all the difference. #creativehub #fashiondesign',
    'Sketch to finished garment — the process is my favorite part. #creativehub #couture',
  ],
  Decorator: [
    'Table setting from last night\'s event — soft florals and warm candlelight. #creativehub #eventdecor',
    'Balloon arch install for a birthday party this weekend — so much fun to build. #creativehub #eventdecor',
    'Backdrop design coming together for an upcoming wedding. #creativehub #weddingdecor',
  ],
  'Cake/Dessert Maker': [
    'Three-tier wedding cake, fresh out of the fridge and ready for delivery. #creativehub #weddingcake',
    'New dessert table setup for a client\'s birthday party today. #creativehub #dessertdesign',
    'Testing a new flavor combination this week — feedback always welcome! #creativehub #baking',
  ],
  Musician: [
    'Set list ready for tonight\'s gig — can\'t wait to play for this crowd. #creativehub #livemusic',
    'New cover added to the repertoire this week. #creativehub #musician',
    'Sound check done, ready for tonight\'s wedding reception. #creativehub #weddingmusic',
  ],
};

const POSTS_PER_FREELANCER = 2;
const DAY_MS = 86400000;

function randomPastDate(maxDaysAgo) {
  const daysAgo = Math.random() * maxDaysAgo;
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString();
}

function pickTwo(options) {
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, POSTS_PER_FREELANCER);
}

async function main() {
  const { data: profiles, error: pErr } = await admin.from('freelancer_profiles').select('user_id, title');
  if (pErr) throw pErr;

  const { data: users, error: uErr } = await admin.from('users').select('id, full_name, account_status').eq('role', 'freelancer');
  if (uErr) throw uErr;
  const activeById = new Map(users.filter((u) => (u.account_status || 'active') === 'active').map((u) => [u.id, u]));

  const rows = [];
  let skippedNoCaption = 0;
  for (const profile of profiles) {
    const user = activeById.get(profile.user_id);
    if (!user) continue;
    const captions = CAPTIONS_BY_CATEGORY[profile.title];
    if (!captions) { skippedNoCaption++; continue; }

    const chosen = pickTwo(captions);
    for (let i = 0; i < chosen.length; i++) {
      const seed = `${encodeURIComponent(user.full_name || profile.user_id)}-svc-${i}-${Math.random().toString(36).slice(2, 8)}`;
      rows.push({
        client_id: profile.user_id,
        caption: chosen[i],
        image_url: `https://picsum.photos/seed/${seed}/800/800`,
        is_published: true,
        created_at: randomPastDate(21),
      });
    }
  }

  console.log(`Inserting ${rows.length} posts across ${profiles.length - skippedNoCaption} freelancers (${skippedNoCaption} skipped - no caption template for their category)...`);

  const { error: insertError } = await admin.from('client_posts').insert(rows);
  if (insertError) throw insertError;

  console.log(`Done: inserted ${rows.length} posts.`);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
