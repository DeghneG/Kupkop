'use client';

import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type MockRole = 'citizen' | 'volunteer' | 'facility' | 'admin';

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

export function useMockRole(): [MockRole, (role: MockRole) => void] {
  const role = useSyncExternalStore<MockRole>(
    subscribeStorage,
    () => {
      try {
        const stored = localStorage.getItem('kupkop-mock-role') as MockRole | null;
        if (stored && ['citizen', 'volunteer', 'facility', 'admin'].includes(stored)) {
          return stored;
        }
      } catch {
        // Fallback to citizen on error
      }
      return 'citizen';
    },
    () => 'citizen'
  );

  const setMockRole = (newRole: MockRole) => {
    try {
      localStorage.setItem('kupkop-mock-role', newRole);
      window.dispatchEvent(new Event('kupkop-storage-change'));
    } catch (err) {
      console.warn('Could not save mock role to localStorage', err);
    }
  };

  return [role, setMockRole];
}
