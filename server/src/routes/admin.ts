import { Router } from 'express';
import { createSupabaseAdminClient, createSupabaseForRequest, getBearerToken } from '../lib/supabase.js';

const router = Router();

// GoTrue's own permanent-ban idiom (its own admin API docs use this exact
// value as the example for "ban forever") - there's no literal "forever",
// so a very long duration is the accepted way to express it. Reactivating
// sets ban_duration back to 'none'.
const PERMANENT_BAN_DURATION = '876000h';

// public.users.account_status already drives the in-app RLS/trigger
// enforcement (see supabase/account_ban_enforcement.sql) and is what
// admin_set_account_status() (called directly from the frontend) writes -
// this route is the other half: banning/unbanning at the Supabase Auth
// layer itself, which the frontend's anon key can never do, so a banned
// user can't sign back in at all (not just get blocked once inside the
// app), and an already-open session fails its next token refresh. Needs
// the service-role key, hence a backend route rather than a direct RPC.
router.post('/ban', async (req, res) => {
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

    const { data: isAdmin, error: isAdminError } = await callerSupabase.rpc('is_admin', { uid: callerData.user.id });
    if (isAdminError || !isAdmin) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const { userId, banned } = req.body as { userId?: string; banned?: boolean };
    if (!userId || typeof banned !== 'boolean') {
      return res.status(400).json({ message: 'userId and banned are required.' });
    }

    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? PERMANENT_BAN_DURATION : 'none',
    });
    if (updateError) {
      return res.status(500).json({ message: updateError.message || 'Unable to update ban status.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to update ban status.' });
  }
});

export default router;
