import { Router } from 'express';
import authRouter from './auth.js';
import freelancersRouter from './freelancers.js';
import bookingsRouter from './bookings.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/freelancers', freelancersRouter);
router.use('/bookings', bookingsRouter);

export default router;
