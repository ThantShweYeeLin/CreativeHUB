import rateLimit from 'express-rate-limit';

// In-memory store (express-rate-limit's default) - this counts requests per
// warm serverless function instance, not globally across every instance
// Vercel might spin up under heavy/distributed load. That's a real
// limitation, not a full guarantee, but it's a genuine improvement over the
// zero rate limiting that existed before on every route, auth included. A
// fully distributed limit (e.g. Upstash Redis via rate-limit-redis) would
// need new infrastructure provisioned and is a reasonable next step, not
// something to silently add here.
//
// standardHeaders: adds RateLimit-* response headers so a well-behaved
// client can see its own remaining quota. legacyHeaders: false skips the
// older X-RateLimit-* headers now considered deprecated.

// Signup/login/check-email - no session required to call these at all, so
// they're the most exposed to brute-force/enumeration/spam-account abuse.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

// The Nominatim geocoding proxy - also reachable without a session (guests
// browsing Explore/Map), and proxies a third-party service with its own
// usage policy this app could get blocked from if hammered.
export const geocodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many location lookups. Please slow down.' },
});

// Every other /api route sits behind requireAuth already (a verified
// Supabase session is its own throttle on casual abuse), but a compromised
// or malicious account could still hammer these - a generous ceiling that
// normal usage will never come close to.
export const generalApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

// Each chatbot message is a real, metered AI provider API call (Gemini/Groq)
// that costs money - tighter than the general limit specifically to cap
// that cost exposure, independent of how generous general API usage is.
export const chatbotRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many messages. Please wait a moment before sending another.' },
});
