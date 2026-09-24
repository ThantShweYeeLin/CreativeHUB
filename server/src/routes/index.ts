import { Router } from 'express';
import authRouter from './auth.js';
import freelancersRouter from './freelancers.js';
import bookingsRouter from './bookings.js';
import feedRouter from './feed.js';
import accountRouter from './account.js';
import chatbotRouter from './chatbot.js';
import paymentsRouter from './payments.js';
import subscriptionsRouter from './subscriptions.js';
import geocodeRouter from './geocode.js';
import { requireAuth } from '../lib/requireAuth.js';

const router = Router();

// Only signup/login and the geocoding proxy are reachable without a token -
// geocoding has no user-specific data to protect and guests now browse
// Explore/Map too - everything else needs a verified Supabase session, so
// an unauthenticated caller gets a 401 rather than any data (freelancer
// emails, feed, chatbot, payments, ...).
router.use('/auth', authRouter);
router.use('/geocode', geocodeRouter);
router.use(requireAuth);
router.use('/freelancers', freelancersRouter);
router.use('/bookings', bookingsRouter);
router.use('/feed', feedRouter);
router.use('/account', accountRouter);
router.use('/chatbot', chatbotRouter);
router.use('/payments', paymentsRouter);
router.use('/subscriptions', subscriptionsRouter);

export default router;
