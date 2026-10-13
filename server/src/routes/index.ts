import { Router } from 'express'; ///to group related API routes.
import authRouter from './auth.js';
import accountRouter from './account.js';
import adminRouter from './admin.js';
import chatbotRouter from './chatbot.js';
import paymentsRouter from './payments.js';
import subscriptionsRouter from './subscriptions.js';
import geocodeRouter from './geocode.js';
import { requireAuth } from '../lib/requireAuth.js';///verifies the Supabase access token before allowing the request through.
import { chatbotRateLimit, generalApiRateLimit, geocodeRateLimit } from '../lib/rateLimit.js';

const router = Router();

// Only signup/login and the geocoding proxy are reachable without a token -
// geocoding has no user-specific data to protect and guests now browse
// Explore/Map too - everything else needs a verified Supabase session, so
// an unauthenticated caller gets a 401 rather than any data (freelancer
// emails, feed, chatbot, payments, ...).
// authRateLimit is applied per-route inside authRouter, not to the whole
// mount - /auth/showcase has its own, much more generous limit (see
// rateLimit.ts) so it never shares a budget with actual login/signup/
// check-email attempts.
router.use('/auth', authRouter);
router.use('/geocode', geocodeRateLimit, geocodeRouter);
router.use(requireAuth);
router.use(generalApiRateLimit);
//router.use('/feed', feedRouter);
router.use('/account', accountRouter);
router.use('/admin', adminRouter);
router.use('/chatbot', chatbotRateLimit, chatbotRouter);
router.use('/payments', paymentsRouter);
router.use('/subscriptions', subscriptionsRouter);

export default router;
