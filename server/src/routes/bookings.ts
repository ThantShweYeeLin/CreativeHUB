import { Router } from 'express';
import { createSupabaseForRequest, getBearerToken } from '../lib/supabase.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ message: 'Missing Supabase bearer token.' });

    const supabase = createSupabaseForRequest(token);
    const { data, error } = await supabase
      .from('bookings')
      .select('*, client:client_id(id, email, full_name, avatar_url), freelancer:freelancer_id(id, email, full_name, avatar_url)')
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ bookings: data ?? [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load bookings.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ message: 'Missing Supabase bearer token.' });

    const supabase = createSupabaseForRequest(token);
    const { data, error } = await supabase.from('bookings').insert(req.body).select('*').single();
    if (error) return res.status(400).json({ message: error.message });
    return res.status(201).json({ booking: data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create booking.' });
  }
});

export default router;
