/**
 * Supabase client for the frontend (browser).
 *
 * Uses ONLY the publishable (anon) key — never the service role key.
 * The service role key lives only in the PXXL dashboard environment for the backend.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type { SupabaseClient } from '@supabase/supabase-js';