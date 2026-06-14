import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role = 'client' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ email, passwordHash, name, role });
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET ?? 'secret', {
      expiresIn: '7d'
    });

    return res.status(201).json({ user: { id: user._id, email: user.email, name: user.name, role: user.role }, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET ?? 'secret', {
      expiresIn: '7d'
    });

    return res.json({ user: { id: user._id, email: user.email, name: user.name, role: user.role }, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

export default router;
