import { Router } from 'express';
import { createSupabaseAdminClient, createSupabaseForRequest, getBearerToken } from '../lib/supabase.js';

const router = Router();

// Permanently deletes the caller's own account (never a client-supplied id).
// Deleting the auth.users row cascades to public.users and everything that
// references it (freelancer_profiles, portfolios, posts, etc. — see
// supabase/schema.sql's "on delete cascade" foreign keys), which the anon
// key can't do on its own — this is the one place this backend needs the
// service-role key.
router.delete('/', async (req, res) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ message: 'Missing access token.' });
    }

    const callerSupabase = createSupabaseForRequest(token);
    const { data: callerData, error: callerError } = await callerSupabase.auth.getUser();

    if (callerError || !callerData.user) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    const admin = createSupabaseAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(callerData.user.id);

    if (deleteError) {
      return res.status(500).json({ message: deleteError.message || 'Unable to delete account.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to delete account.' });
  }
});

export default router;
