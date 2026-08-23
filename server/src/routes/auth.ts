import { Router } from 'express';
import { createSupabaseForRequest } from '../lib/supabase.js';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role = 'client' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required.' });
    }

    if (role !== 'client' && role !== 'freelancer') {
      return res.status(400).json({ message: 'Role must be client or freelancer.' });
    }

    const supabase = createSupabaseForRequest();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, role } },
    });

    if (error) return res.status(400).json({ message: error.message });
    if (!data.user) return res.status(500).json({ message: 'Supabase did not create the user.' });

    // When email confirmation is disabled Supabase returns a session immediately,
    // allowing the profile row to be created under the user's RLS permissions.
    if (data.session?.access_token) {
      const authenticatedSupabase = createSupabaseForRequest(data.session.access_token);
      const { error: profileError } = await authenticatedSupabase.from('users').upsert({
        id: data.user.id,
        email,
        full_name: name,
        role,
      });
      if (profileError) return res.status(400).json({ message: profileError.message });
    }

    return res.status(201).json({
      user: { id: data.user.id, email: data.user.email, fullName: name, role },
      session: data.session,
      needsEmailConfirmation: !data.session,
    });
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

    const supabase = createSupabaseForRequest();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return res.status(401).json({ message: error?.message ?? 'Invalid credentials.' });

    const authenticatedSupabase = createSupabaseForRequest(data.session.access_token);
    const { data: profile, error: profileError } = await authenticatedSupabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) return res.status(400).json({ message: profileError.message });
    return res.json({ user: profile ?? { id: data.user.id, email: data.user.email }, session: data.session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

export default router;
