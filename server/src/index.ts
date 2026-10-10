// This is its own standalone Vercel project (Root Directory: server/), not
// bundled with the frontend — see api/index.ts for the serverless
// entrypoint that wraps the Express app exported below. Deploys install
// dependencies from this directory in isolation, so nothing here should
// import a file that lives outside server/ (see src/routes/chatbot.ts for
// the local-copy pattern used to avoid exactly that).
///This file creates the actual Express application.
import express from 'express'; ///Bring in Express for the server
import cors from 'cors'; ///to control which websites can call it,
import helmet from 'helmet'; ///for security-related HTTP headers,
import dotenv from 'dotenv'; /// to load environment variables from a local .env file.
import apiRouter from './routes/index.js'; ///the router assembled in server/src/routes/index.ts. It connects route groups such as auth, payments, and chatbot.
import { createOmiseWebhookHandler } from './routes/omiseWebhook.js'; ///handles incoming payment-provider notifications.
import { corsOptions } from './lib/cors.js'; /// specify the server’s cross-origin rules.

dotenv.config();

const app = express(); /// creates the Express application. T
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
// Vercel sits in front of this as a proxy - without trust proxy, req.ip
// (and every rate limiter keyed on it) sees Vercel's own address for every
// caller instead of the real client IP, making IP-based rate limiting
// either broken or a single shared bucket for all traffic.
app.set('trust proxy', 1);
// Helmet's defaults are aimed at apps that serve HTML, but they're still
// the right call here, not just harmless: default-src 'none' CSP is exactly
// correct for a JSON-only API (there's no page content for it to restrict),
// and HSTS/nosniff/frameguard/referrer-policy all apply regardless of
// content type. No per-route tuning needed - this API never serves HTML.
app.use(helmet());
app.use(cors(corsOptions));
// Omise signs the exact request bytes, so the webhook gets the RAW body and
// must be registered before express.json() consumes it. It is deliberately
// outside requireAuth: Omise has no user session - the signature is the auth.
app.post('/api/webhooks/omise', express.raw({ type: '*/*', limit: '256kb' }), createOmiseWebhookHandler());
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (_req, res) => {
  res.send({ status: 'ok', service: 'CreativeHUB backend' });
});

// Vercel invokes the exported Express app as a serverless function. Keep the
// listener only for local development; connecting to a database at module load
// time would make every deployment request fail when MongoDB is unavailable.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
