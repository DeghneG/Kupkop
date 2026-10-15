'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('kupkop-theme');
      // Default to light unless explicitly saved as 'dark'
      const isDark = stored ? stored === 'dark' : document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
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
      // Ignore reading error if DOM is not ready
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    try {
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
      }
      localStorage.setItem('kupkop-theme', nextTheme);
    } catch (err) {
      console.warn('Could not save theme preference to localStorage', err);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5a6b85] hover:text-[#0b132b] dark:text-[#8e9bb0] dark:hover:text-white bg-white dark:bg-[#162138] hover:bg-[#f0f4fa] dark:hover:bg-[#1e2d4d] transition-all active:scale-95 border border-[#ccd7e8] dark:border-[#223152] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ff453a] cursor-pointer shrink-0"
    >
      {!mounted ? (
        <span className="w-5 h-5" aria-hidden="true" />
      ) : theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="w-5 h-5 text-zinc-600" aria-hidden="true" />
      )}
    </button>
  );
}
