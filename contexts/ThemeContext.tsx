import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'reddit-multi-poster-theme';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme, options?: { animate?: boolean }) => void;
  resolvedTheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const THEME_COLORS: Record<'light' | 'dark', string> = {
  light: '#f8fafc',
  dark: '#0f172a'
};

type ApplyThemeOptions = {
  skipTransition?: boolean;
  animate?: boolean;
  previousResolved?: 'light' | 'dark' | null;
};

const applyTheme = (
  resolved: 'light' | 'dark',
  { skipTransition = false, animate = true, previousResolved = null }: ApplyThemeOptions = {}
) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Enable smooth cross-fade transition (skipped on initial mount)
  if (!skipTransition) {
    root.classList.add('theme-transitioning');
  }

  // Set wipe gradient stops using previous/next resolved theme colors
  if (!skipTransition && animate && !prefersReducedMotion && previousResolved) {
    root.style.setProperty('--theme-wipe-from', THEME_COLORS[previousResolved]);
    root.style.setProperty('--theme-wipe-to', THEME_COLORS[resolved]);
    root.classList.add('theme-wipe');
  }

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Remove transition classes after animation to avoid permanent perf cost
  if (!skipTransition) {
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
      root.classList.remove('theme-wipe');
    }, 500);
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  const setTheme = useCallback(
    (next: Theme, options?: { animate?: boolean }) => {
      const animate = options?.animate ?? true;
      setThemeState(next);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      const resolved = next === 'system' ? getSystemTheme() : next;
      setResolvedTheme(resolved);
      applyTheme(resolved, { animate, previousResolved: resolvedTheme });
    },
    [resolvedTheme]
  );

  useEffect(() => {
    const stored = (localStorage?.getItem(THEME_STORAGE_KEY) as Theme | null) ?? 'dark';
    setThemeState(stored);
    const resolved = stored === 'system' ? getSystemTheme() : stored;
    setResolvedTheme(resolved);
    applyTheme(resolved, { skipTransition: true, animate: false }); // Skip transition on initial mount
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved, { animate: false, previousResolved: resolvedTheme });
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mounted, theme, resolvedTheme]);

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
