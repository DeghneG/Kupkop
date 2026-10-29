// Small device preferences. localStorage here is expo-sqlite's, installed in lib/supabase.ts.
import 'expo-sqlite/localStorage/install';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'kupkop-theme';
const WELCOME_KEY = 'kupkop-welcome-seen';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; the app works without them
  }
}

export function getThemeMode(): ThemeMode {
  const stored = read(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function setThemeMode(mode: ThemeMode) {
  write(THEME_KEY, mode);
}

export function hasSeenWelcome(): boolean {
  return read(WELCOME_KEY) === '1';
}

export function markWelcomeSeen() {
  write(WELCOME_KEY, '1');
}
