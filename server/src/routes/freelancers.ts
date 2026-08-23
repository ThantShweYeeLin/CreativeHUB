import { Router } from 'express';
import { createSupabaseForRequest } from '../lib/supabase.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const supabase = createSupabaseForRequest();
    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select('*, users:user_id(id, email, full_name, avatar_url, bio, location, rating, total_reviews)')
      .eq('is_available', true);
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ freelancers: data ?? [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load freelancers.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const supabase = createSupabaseForRequest();
    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select('*, users:user_id(id, email, full_name, avatar_url, bio, location, rating, total_reviews)')
      .eq('user_id', req.params.id)
      .maybeSingle();
    if (error) return res.status(400).json({ message: error.message });
    if (!data) {
      return res.status(404).json({ message: 'Freelancer not found.' });
    }
    return res.json({ freelancer: data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load freelancer.' });
  }
});

export default router;
