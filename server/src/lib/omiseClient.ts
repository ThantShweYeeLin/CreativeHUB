import Omise from 'omise';

// Warns rather than throws at import time — Vercel builds/bundles this file
// even in environments where the key genuinely isn't set yet (e.g. before
// Phase A's env var is added), and a throw there would break the build
// itself rather than just the one route that actually needs it.
if (!process.env.OMISE_SECRET_KEY) {
  console.warn('OMISE_SECRET_KEY is not set — payment routes will fail until it is configured.');
}

export const omiseClient = Omise({
  secretKey: process.env.OMISE_SECRET_KEY || '',
  omiseVersion: '2019-05-29',
});
