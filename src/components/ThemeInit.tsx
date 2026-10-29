'use client';

import { useLayoutEffect } from 'react';

// Suppress any React 19 script-tag false-positive development warnings
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return;
    }
    origError.apply(console, args);
  };
}

// The inline script in layout.tsx sets the theme before paint; this re-applies it after React's
// development remount clears it, and before paint so there is no flash either way.
export default function ThemeInit() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('kupkop-theme');
      const isDark =
        stored === 'dark' ||
        (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
      }
    } catch {
      // Storage unavailable or blocked
    }
  }, []);

  return null;
}
