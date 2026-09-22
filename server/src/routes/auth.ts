import { Router } from 'express';
import { createSupabaseAdminClient, createSupabaseForRequest } from '../lib/supabase.js';

const router = Router();

// Public (no session yet): the sign-up form needs to know whether an email is
// already taken before the user has an account. supabase/lock_down_anonymous_access.sql
// revoked anon's direct table access, so this can't be a client-side Supabase
// query any more - the admin client checks it server-side and returns only a
// boolean, never the row.
router.post('/check-email', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const { data, error } = await createSupabaseAdminClient()
      .from('users')
      .select('id')
      .ilike('email', email)
      .limit(1);

    if (error) return res.status(500).json({ message: 'Unable to validate email.' });
    return res.json({ exists: (data || []).length > 0 });
  } catch (error) {
    console.error('check-email failed:', error);
    return res.status(500).json({ message: 'Unable to validate email right now. Please try again.' });
  }
});

// Public (no session yet): powers the rotating stats/testimonials/spotlight
// panel on the login and sign-up screens. Same queries src/lib/dataService.ts
// getAuthShowcaseData() used to run directly against Supabase with the anon
// key, back when the "viewable by everyone" policies actually applied to
// anon - see supabase/lock_down_anonymous_access.sql. Only aggregate counts
// and already-public profile/review fields are returned.
router.get('/showcase', async (_req, res) => {
  try {
    const admin = createSupabaseAdminClient();
    const [
      freelancerCountResp,
      memberCountResp,
      reviewStatsResp,
      avatarRowsResp,
      testimonialRowsResp,
      spotlightRowsResp,
    ] = await Promise.all([
      admin.from('users').select('id', { count: 'exact', head: true })
        .eq('role', 'freelancer').eq('account_status', 'active'),
      admin.from('users').select('id', { count: 'exact', head: true })
        .eq('account_status', 'active'),
      admin.from('reviews').select('rating', { count: 'exact' }).limit(1000),
      admin.from('users').select('full_name, avatar_url')
        .eq('role', 'freelancer').eq('account_status', 'active')
        .not('avatar_url', 'is', null)
        .order('total_reviews', { ascending: false })
        .limit(6),
      admin.from('reviews')
        .select('id, rating, comment, created_at, reviewer:reviewer_id(full_name, avatar_url), reviewee:reviewee_id(full_name)')
        .not('comment', 'is', null)
        .gte('rating', 4)
        .order('created_at', { ascending: false })
        .limit(15),
      admin.from('freelancer_profiles')
        .select('user_id, title, skills, users:user_id!inner(full_name, avatar_url, rating, total_reviews, location, account_status)')
        .neq('visibility', 'limited')
        .eq('is_available', true)
        .eq('users.account_status', 'active')
        .not('users.avatar_url', 'is', null)
        .order('total_reviews', { foreignTable: 'users', ascending: false })
        .limit(8),
    ]);

    const reviewRows = (reviewStatsResp.data || []) as Array<{ rating: number | null }>;
    const totalReviews = reviewStatsResp.count ?? reviewRows.length;
    const avgRating = reviewRows.length > 0
      ? reviewRows.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewRows.length
      : 0;

    const avatars = ((avatarRowsResp.data || []) as Array<{ full_name: string | null; avatar_url: string | null }>)
      .filter((r) => !!r.avatar_url)
      .map((r) => ({ name: r.full_name || 'Creative', avatarUrl: r.avatar_url as string }));

    const testimonials = ((testimonialRowsResp.data || []) as Array<any>)
      .filter((r) => typeof r.comment === 'string' && r.comment.trim().length >= 12 && r.reviewer)
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        comment: (r.comment as string).trim(),
        rating: Number(r.rating) || 5,
        reviewerName: r.reviewer?.full_name || 'CreativeHUB member',
        reviewerAvatar: r.reviewer?.avatar_url || null,
        revieweeName: r.reviewee?.full_name || null,
      }));

    const spotlights = ((spotlightRowsResp.data || []) as Array<any>)
      .filter((r) => r.users?.avatar_url)
      .slice(0, 8)
      .map((r) => ({
        id: r.user_id,
        name: r.users?.full_name || 'Freelancer',
        avatarUrl: r.users?.avatar_url || null,
        title: r.title || null,
        skills: Array.isArray(r.skills) ? r.skills.slice(0, 3) : [],
        rating: Number(r.users?.rating) || 0,
        totalReviews: Number(r.users?.total_reviews) || 0,
        location: r.users?.location || null,
      }));

    return res.json({
      freelancerCount: freelancerCountResp.count || 0,
      memberCount: memberCountResp.count || 0,
      totalReviews,
      avgRating,
      avatars,
      testimonials,
      spotlights,
    });
  } catch (error) {
    console.error('showcase failed:', error);
    return res.status(500).json({ message: 'Unable to load showcase data.' });
  }
});

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
