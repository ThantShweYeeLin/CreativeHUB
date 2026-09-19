import type { NextFunction, Request, Response } from 'express';
import { createSupabaseForRequest, getBearerToken } from './supabase.js';

// Rejects any request that doesn't carry a Supabase access token the auth
// server actually accepts. Verifying with getUser() (a round-trip to
// Supabase Auth) rather than just checking a token is present means a
// forged/expired/revoked token is rejected here, not only later by RLS.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const { data, error } = await createSupabaseForRequest(token).auth.getUser();
    if (error || !data.user) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }
    res.locals.userId = data.user.id;
    return next();
  } catch (error) {
    console.error('Auth check failed:', error);
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
}
