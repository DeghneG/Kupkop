// Setup from https://docs.expo.dev/guides/using-supabase: expo-sqlite's localStorage keeps the session.
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False when mobile/.env is missing; screens show a setup notice instead of failing quietly. */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-anon-key', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Phones have no URL to read a session from; sign-in uses the emailed code
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is open
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** The web app on Vercel hosts Rafa, street lookup and email checks; the Gemini key stays there. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://kupkop.vercel.app').replace(/\/$/, '');
