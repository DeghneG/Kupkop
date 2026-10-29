import { createBrowserClient } from '@supabase/ssr';

/**
 * False when this build had no Supabase settings (e.g. a deploy missing its environment variables).
 * NEXT_PUBLIC_ values are fixed at build time, so adding them later needs a rebuild.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let warned = false;

export function createClient() {
  if (!isSupabaseConfigured && !warned) {
    warned = true;
    console.error(
      'Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY were missing at build time. Add them and rebuild.'
    );
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(supabaseUrl, supabaseKey);
}
