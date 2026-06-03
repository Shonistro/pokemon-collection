import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev so a missing .env.local is obvious.
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

/**
 * The browser Supabase client. Uses ONLY the public anon key — Row-Level
 * Security on the database is what actually protects per-user data.
 *
 * The TCG API key is NOT here and never reaches the client; all TCG calls go
 * through the `tcg-proxy` Edge Function (see src/providers/TcgApiProvider.ts).
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
