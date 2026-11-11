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

const VIEW_AS_ROLES: readonly string[] = ['citizen', 'volunteer', 'facility', 'admin'];

/**
 * Each frame of the three-screen demo keeps its own role in its window name. Not sessionStorage: same-origin frames
 * of one tab share it, so they overwrote each other and set off each other's storage events in an endless loop.
 * A window name belongs to one frame and fires no events.
 */
export const PANE_PREFIX = 'kupkop-pane:';

/** A frame's role wins over the shared preview role; neither valid means no preview. Pure, so it can be tested. */
export function resolveViewAs(pane: string | null, stored: string | null): ViewAsRole | null {
  if (pane && VIEW_AS_ROLES.includes(pane)) return pane as ViewAsRole;
  return stored && VIEW_AS_ROLES.includes(stored) ? (stored as ViewAsRole) : null;
}

/** The role of this frame when it is a pane of the three-screen demo (set by ?pane=), else null. */
export function readPaneRole(): ViewAsRole | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!window.name.startsWith(PANE_PREFIX)) {
      // A page opened as /?pane=volunteer becomes that pane, even outside the three-screen page
      const fromUrl = new URLSearchParams(window.location.search).get('pane');
      if (fromUrl && VIEW_AS_ROLES.includes(fromUrl)) window.name = PANE_PREFIX + fromUrl;
    }
    return window.name.startsWith(PANE_PREFIX) ? resolveViewAs(window.name.slice(PANE_PREFIX.length), null) : null;
  } catch {
    return null;
  }
}

/** The role being previewed right now: this frame's pane role first, then the shared preview role. */
export function readViewAs(): ViewAsRole | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('kupkop-view-as');
  } catch {
    // storage blocked: no preview
  }
  return resolveViewAs(readPaneRole(), stored);
}

/** True inside a pane of the three-screen demo (the banners and role switcher are hidden there). */
export function usePaneFrame(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => readPaneRole() !== null,
    () => false
  );
}

// Role preview (anyone can choose one). Display only: the database still enforces the real
// account's permissions, so a preview never grants access to anything.
export function useViewAs(): [ViewAsRole | null, (role: ViewAsRole | null) => void] {
  const current = useSyncExternalStore<ViewAsRole | null>(subscribeStorage, readViewAs, () => null);

  const setViewAs = (role: ViewAsRole | null) => {
    // A pane of the three-screen demo is fixed to its role
    if (readPaneRole()) return;
    try {
      if (role) localStorage.setItem('kupkop-view-as', role);
      else localStorage.removeItem('kupkop-view-as');
      window.dispatchEvent(new Event('kupkop-storage-change'));
    } catch (err) {
      console.warn('Could not save view-as role', err);
    }
  };

  return [current, setViewAs];
}
