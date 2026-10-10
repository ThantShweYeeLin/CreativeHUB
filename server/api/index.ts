// Vercel serverless entrypoint — every request to this project (see the
// catch-all rewrite in vercel.json) lands here. The Express app itself still
// mounts everything under /api (see src/index.ts), and Vercel rewrites
// preserve the original request path, so req.url inside Express is still
// e.g. "/api/chatbot/message" — no path-stripping needed.

/// Vercel server entry point: `server/api/index.ts`
///`server/api/index.ts` is a small adapter for deploying the Express app on Vercel. It imports the app created in `server/src/index.ts` and exports it in the form Vercel expects.

///It **does not create a second Express app**; it hands the existing one to Vercel.

import app from '../src/index.js';

export default app;
