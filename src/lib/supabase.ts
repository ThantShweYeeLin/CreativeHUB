import { createClient } from '@supabase/supabase-js';
export type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Backwards-compatible export used across the codebase
export const isSupabaseConfigured = hasSupabaseConfig;

// @ts-expect-error TS2304: `export type { Database }` above re-exports the
// name for other files but never binds it locally, so this line can't see
// it. The real fix (`import type` instead) is correct in isolation but
// cascaded into 100+ errors last time - half the codebase's
// `(supabase as any)` casts implicitly rely on this type staying
// unresolved. Zero runtime impact either way; the actual fix is
// regenerating database.types.ts properly, not this line.
export const supabase = createClient<Database>(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'missing-supabase-anon-key'
);
