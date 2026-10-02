// This is its own standalone Vercel project (Root Directory: server/), not
// bundled with the frontend — see api/index.ts for the serverless
// entrypoint that wraps the Express app exported below. Deploys install
// dependencies from this directory in isolation, so nothing here should
// import a file that lives outside server/ (see src/routes/chatbot.ts for
// the local-copy pattern used to avoid exactly that).
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { createOmiseWebhookHandler } from './routes/omiseWebhook.js';
import { corsOptions } from './lib/cors.js';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
// Vercel sits in front of this as a proxy - without trust proxy, req.ip
// (and every rate limiter keyed on it) sees Vercel's own address for every
// caller instead of the real client IP, making IP-based rate limiting
// either broken or a single shared bucket for all traffic.
app.set('trust proxy', 1);
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
