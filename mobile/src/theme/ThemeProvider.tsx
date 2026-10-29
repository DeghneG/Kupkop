import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type ColorTokens } from '@/theme/tokens';
import { getThemeMode, setThemeMode as saveThemeMode, type ThemeMode } from '@/lib/prefs';

type ThemeValue = {
  colors: ColorTokens;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

// System / Light / Dark, same three choices as web Settings
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(getThemeMode);

  const value = useMemo<ThemeValue>(() => {
    const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
    return {
      colors: isDark ? dark : light,
      isDark,
      mode,
      setMode: (next) => {
        saveThemeMode(next);
        setModeState(next);
      },
    };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
