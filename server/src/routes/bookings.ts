import { Router } from 'express';
import Booking from '../models/Booking.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const bookings = await Booking.find().populate('clientId freelancerId', '-passwordHash');
    return res.json({ bookings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load bookings.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    return res.status(201).json({ booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create booking.' });
  }
});

export default router;
