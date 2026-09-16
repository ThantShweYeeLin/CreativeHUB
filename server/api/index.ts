// Vercel serverless entrypoint — every request to this project (see the
// catch-all rewrite in vercel.json) lands here. The Express app itself still
// mounts everything under /api (see src/index.ts), and Vercel rewrites
// preserve the original request path, so req.url inside Express is still
// e.g. "/api/chatbot/message" — no path-stripping needed.
import app from '../src/index.js';

export default app;
