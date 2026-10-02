import type { CorsOptions } from 'cors';

// Was `cors({ origin: true, credentials: true })` - `origin: true` reflects
// whatever Origin header the caller sends back as Access-Control-Allow-Origin,
// which combined with credentials: true means literally any website on the
// internet could make a credentialed cross-origin request to this API and
// have the browser let the response through. Not currently exploitable the
// way classic CSRF is (auth here is a Bearer header the caller's own JS has
// to read from localStorage and attach - nothing for a third-party page to
// auto-attach the way a cookie would be), but it's needlessly permissive and
// should be scoped to the frontend's actual origins.
//
// Hardcoded defaults are this project's known Vercel aliases (checked via
// `vercel alias ls` - the project has no custom domain) plus local dev
// ports, so this fails toward "the real frontend still works" even if
// ALLOWED_ORIGINS/APP_BASE_URL are never configured in an environment.
// ALLOWED_ORIGINS (comma-separated) lets a custom domain be added later
// without a code change; APP_BASE_URL is also honored since
// server/.env.example already documents it as "the frontend's public URL"
// for an unrelated purpose (Omise 3-D Secure redirects).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://creative-hub-rho.vercel.app',
  'https://creative-hub-uris-projects-1c635f0f.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

// Vercel preview deployments for this project get a unique per-deployment
// hostname each time (e.g. creative-ezlfjj9az-uris-projects-1c635f0f.vercel.app)
// - this covers those and the stable aliases above without allowlisting
// every other site on vercel.app.
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/creative(-hub)?-[a-z0-9]+-uris-projects-1c635f0f\.vercel\.app$/;

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv, ...(appBaseUrl ? [appBaseUrl] : [])]));
}

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // No Origin header at all means this isn't a browser cross-origin
    // request in the first place (server-to-server calls, curl, the Omise
    // webhook) - CORS only governs what a browser will let a web page read,
    // so there's nothing to restrict here.
    if (!origin) {
      callback(null, true);
      return;
    }
    if (getAllowedOrigins().includes(origin) || PREVIEW_ORIGIN_PATTERN.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed`));
  },
};
