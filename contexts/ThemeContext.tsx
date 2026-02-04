import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'reddit-multi-poster-theme';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const applyTheme = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    }
    const resolved = next === 'system' ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    const stored = (localStorage?.getItem(THEME_STORAGE_KEY) as Theme | null) ?? 'system';
    setThemeState(stored);
    const resolved = stored === 'system' ? getSystemTheme() : stored;
    setResolvedTheme(resolved);
    applyTheme(resolved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mounted, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
