// Adds two new For You feed posts per existing freelancer (client_posts -
// the table's name is legacy; client_id is just an author FK, see
// ForYouPage.tsx's mapClientPostRowToFeedPost), each captioned for that
// freelancer's own category (freelancer_profiles.title).
//
// Unlike an earlier version of this script, every caption here is paired
// with a SPECIFIC image chosen and visually verified (via Read on a
// downloaded sample) to actually depict that caption - a live camera, a
// real wedding, an actual hair-styling session, a real cake, etc. - not a
// same-category-but-otherwise-random photo. Caption and image are always
// inserted together as a fixed pair, never shuffled independently.
//
// Additive only - never touches or removes any existing post. Images are
// real Unsplash CDN photos (images.unsplash.com/photo-<id>), each spot-
// checked for a 200 response before being used here.
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

const img = (id) => `https://images.unsplash.com/${id}?w=800&h=800&fit=crop`;

// Each entry: [caption, imageId] - a fixed, visually-verified pair.
const POST_PAIRS_BY_CATEGORY = {
  Photographer: [
    ['Golden hour portraits from yesterday\'s session — this is why I love what I do. #creativehub #photography', 'photo-1554048612-b6a482bc67e5'],
    ['Wedding gallery delivered! A few of my favorite frames from the day. #creativehub #weddingphotography', 'photo-1583939003579-730e3918a45a'],
    ['Testing a new lens for portrait work this week — the bokeh is unreal. #creativehub #photography', 'photo-1516035069371-29a1b244cc32'],
    ['New camera day — can\'t wait to put this to work. #creativehub #photography', 'photo-1516724562728-afc824a36e84'],
  ],
  Videographer: [
    ['Behind the scenes from a wedding shoot this weekend! Highlight reel coming soon. #creativehub #videography', 'photo-1601506521937-0121a7fc2a6b'],
    ['Just wrapped editing a same-day-edit video — nothing beats seeing the couple\'s reaction. #creativehub #videography', 'photo-1585951237318-9ea5e175b891'],
  ],
  'Makeup Artist': [
    ['Bridal glam for today\'s ceremony — soft, romantic, and long-lasting all day. #creativehub #bridalmakeup', 'photo-1487412947147-5cebf100ffc2'],
    ['Loved creating this bold look for a client\'s shoot today. #creativehub #makeupartist', 'photo-1512496015851-a90fb38ba796'],
    ['Kit restocked and ready for a full week of bookings. #creativehub #mua', 'photo-1526045478516-99145907023c'],
  ],
  'Hair Stylist': [
    ['Updo curls coming together for today\'s bride — every strand placed just right. #creativehub #bridalhair', 'photo-1560869713-7d0a29430803'],
    ['Fresh blowout, fresh confidence. Loved this finish today. #creativehub #hairstylist', 'photo-1562322140-8baeececf3df'],
    ['New look, new confidence — swipe to see the reveal. #creativehub #hairstylist', 'photo-1519699047748-de8e457a634e'],
    ['Testing new styling techniques ahead of wedding season. #creativehub #hairstyling', 'photo-1522337360788-8b13dee7a37e'],
  ],
  'Fashion Designer': [
    ['Fresh pieces just hit the rack — swing by the studio to see them in person. #creativehub #fashiondesign', 'photo-1523381210434-271e8be1f52b'],
    ['Cozy knits ready for the new collection preview. #creativehub #fashiondesign', 'photo-1558769132-cb1aea458c5e'],
    ['Just finished this piece — can\'t wait for it to find its owner. #creativehub #fashiondesign', 'photo-1591047139829-d91aecb6caea'],
    ['Styling day for an upcoming shoot. #creativehub #fashiondesign', 'photo-1521577352947-9bb58764b69a'],
  ],
  Decorator: [
    ['String lights and florals for last night\'s reception — the ambiance came together perfectly. #creativehub #eventdecor', 'photo-1527529482837-4698179dc6ce'],
    ['Ballroom transformation complete for tonight\'s reception. #creativehub #eventdecor', 'photo-1519167758481-83f550bb49b3'],
    ['Table details and centerpieces coming together for an upcoming wedding. #creativehub #weddingdecor', 'photo-1464366400600-7168b8af9bc3'],
    ['Floral centerpieces styled for this weekend\'s celebration. #creativehub #eventdecor', 'photo-1478146059778-26028b07395a'],
  ],
  'Cake/Dessert Maker': [
    ['Three-tier wedding cake, fresh out of the fridge and ready for delivery. #creativehub #weddingcake', 'photo-1535141192574-5d4897c12636'],
    ['New dessert table setup for a client\'s birthday party today. #creativehub #dessertdesign', 'photo-1486427944299-d1955d23e34d'],
    ['Testing a new chocolate drip combination this week — feedback always welcome! #creativehub #baking', 'photo-1578985545062-69928b1d9587'],
    ['Birthday cake ready for pickup — sprinkles included. #creativehub #dessertdesign', 'photo-1621303837174-89787a7d4729'],
  ],
  Musician: [
    ['Set list ready for tonight\'s gig — can\'t wait to play for this crowd. #creativehub #livemusic', 'photo-1514320291840-2e0a9bf2a9ae'],
    ['New cover added to the repertoire this week. #creativehub #musician', 'photo-1493225457124-a3eb161ffa5f'],
    ['Sound check done, ready for tonight\'s wedding reception. #creativehub #weddingmusic', 'photo-1511671782779-c97d3d27a1d4'],
    ['Late night set — the crowd was electric tonight. #creativehub #livemusic', 'photo-1470225620780-dba8ba36b745'],
  ],
};

const POSTS_PER_FREELANCER = 2;
const DAY_MS = 86400000;

function randomPastDate(maxDaysAgo) {
  const daysAgo = Math.random() * maxDaysAgo;
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString();
}

function pickN(pairs, n) {
  const shuffled = [...pairs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, pairs.length));
}

async function main() {
  const { data: profiles, error: pErr } = await admin.from('freelancer_profiles').select('user_id, title');
  if (pErr) throw pErr;

  const { data: users, error: uErr } = await admin.from('users').select('id, account_status').eq('role', 'freelancer');
  if (uErr) throw uErr;
  const activeIds = new Set(users.filter((u) => (u.account_status || 'active') === 'active').map((u) => u.id));

  const rows = [];
  let skippedNoTemplate = 0;
  for (const profile of profiles) {
    if (!activeIds.has(profile.user_id)) continue;
    const pairs = POST_PAIRS_BY_CATEGORY[profile.title];
    if (!pairs) { skippedNoTemplate++; continue; }

    for (const [caption, imageId] of pickN(pairs, POSTS_PER_FREELANCER)) {
      rows.push({
        client_id: profile.user_id,
        caption,
        image_url: img(imageId),
        is_published: true,
        created_at: randomPastDate(21),
      });
    }
  }

  console.log(`Inserting ${rows.length} posts across ${profiles.length - skippedNoTemplate} freelancers (${skippedNoTemplate} skipped - no template for their category)...`);

  const { error: insertError } = await admin.from('client_posts').insert(rows);
  if (insertError) throw insertError;

  console.log(`Done: inserted ${rows.length} posts.`);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
