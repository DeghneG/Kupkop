import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for scheduled jobs and server-only routes. It bypasses RLS, so it must never
 * reach the browser, and every route that uses it checks its own secret or the caller's identity first.
 * Returns null until SUPABASE_SERVICE_ROLE_KEY is set (on Vercel and in .env.local).
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
