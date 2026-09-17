import { Router } from 'express';
import authRouter from './auth.js';
import freelancersRouter from './freelancers.js';
import bookingsRouter from './bookings.js';
import feedRouter from './feed.js';
import accountRouter from './account.js';
import chatbotRouter from './chatbot.js';
import paymentsRouter from './payments.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/freelancers', freelancersRouter);
router.use('/bookings', bookingsRouter);
router.use('/feed', feedRouter);
router.use('/account', accountRouter);
router.use('/chatbot', chatbotRouter);
router.use('/payments', paymentsRouter);

export default router;
