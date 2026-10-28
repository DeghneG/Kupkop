'use client';

import { useEffect } from 'react';

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

export default function ThemeInit() {
  useEffect(() => {
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
