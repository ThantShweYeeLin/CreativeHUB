import { createClient } from '@supabase/supabase-js';
export type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Backwards-compatible export used across the codebase
export const isSupabaseConfigured = hasSupabaseConfig;

export const supabase = createClient<Database>(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'missing-supabase-anon-key'
);
