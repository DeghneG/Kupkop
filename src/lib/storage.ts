'use client';

import { useSyncExternalStore } from 'react';

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

// Role preview (anyone can choose one). Display only: the database still enforces the real
// account's permissions, so a preview never grants access to anything.
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
