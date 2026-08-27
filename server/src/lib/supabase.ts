import { createClient } from '@supabase/supabase-js';

// Resolved lazily (not at module load) because ES module imports are hoisted
// above index.ts's dotenv.config() call — reading process.env at the top
// level here would run before the .env file is loaded.
export function createSupabaseForRequest(accessToken?: string) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY (or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) in server environment.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export function getBearerToken(header?: string) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}
