'use client';

import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Set once the landing page has been shown on this device, so the feed opens directly afterwards. */
export const WELCOME_SEEN_KEY = 'kupkop-welcome-seen';

const emptySubscribe = () => () => {};

export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('kupkop-storage-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('kupkop-storage-change', callback);
  };
}

export type ViewAsRole = 'citizen' | 'volunteer' | 'facility' | 'admin';

// Admin-only UI preview of another role. Display only: the database still
// enforces the real role, and useProfile ignores this unless the user is an admin.
export function useViewAs(): [ViewAsRole | null, (role: ViewAsRole | null) => void] {
  const stored = useSyncExternalStore<string | null>(
    subscribeStorage,
    () => {
      try {
        return localStorage.getItem('kupkop-view-as');
      } catch {
        return null;
      }
    },
    () => null
  );

  const setViewAs = (role: ViewAsRole | null) => {
    try {
      if (role) localStorage.setItem('kupkop-view-as', role);
      else localStorage.removeItem('kupkop-view-as');
      window.dispatchEvent(new Event('kupkop-storage-change'));
    } catch (err) {
      console.warn('Could not save view-as role', err);
    }
  };

  const valid = ['citizen', 'volunteer', 'facility', 'admin'].includes(stored ?? '');
  return [valid ? (stored as ViewAsRole) : null, setViewAs];
}

export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const mode = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => {
      try {
        const stored = localStorage.getItem('kupkop-theme');
        if (stored === 'dark' || stored === 'light') return stored;
      } catch {
        // Fallback to system on error
      }
      return 'system';
    },
    () => 'system'
  );

  const setThemeMode = (newMode: ThemeMode) => {
    try {
      let isDark = false;
      if (newMode === 'dark') {
        isDark = true;
        localStorage.setItem('kupkop-theme', 'dark');
      } else if (newMode === 'light') {
        isDark = false;
        localStorage.setItem('kupkop-theme', 'light');
      } else {
        localStorage.setItem('kupkop-theme', 'system');
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
      }

      window.dispatchEvent(new Event('kupkop-storage-change'));
    } catch (err) {
      console.warn('Could not save theme preference to localStorage', err);
    }
  };

  return [mode, setThemeMode];
}
