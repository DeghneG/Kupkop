'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeMode, useIsMounted } from '@/lib/storage';

export default function ThemeToggle() {
  const isMounted = useIsMounted();
  const [themeMode, setThemeMode] = useThemeMode();

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setThemeMode(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-fg-muted hover:text-fg bg-surface hover:bg-surface-muted transition-all active:scale-95 border border-border shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 cursor-pointer shrink-0"
    >
      {!isMounted ? (
        <span className="w-5 h-5" aria-hidden="true" />
      ) : isDark ? (
        <Sun className="w-5 h-5 text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="w-5 h-5 text-fg-muted" aria-hidden="true" />
      )}
    </button>
  );
}
