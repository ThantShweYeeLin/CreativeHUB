import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const freelancers = await User.find({ role: 'freelancer' }).select('-passwordHash');
    return res.json({ freelancers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load freelancers.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const freelancer = await User.findById(req.params.id).select('-passwordHash');
    if (!freelancer || freelancer.role !== 'freelancer') {
      return res.status(404).json({ message: 'Freelancer not found.' });
    }
    return res.json({ freelancer });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load freelancer.' });
  }
});

export default router;
