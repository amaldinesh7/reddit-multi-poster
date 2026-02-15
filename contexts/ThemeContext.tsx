import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'reddit-multi-poster-theme';

// Simple light/dark theme
export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyTheme = (theme: Theme, skipTransition = false) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Enable smooth transition (skipped on initial mount)
  if (!skipTransition) {
    root.classList.add('theme-transitioning');
  }

  // Apply or remove dark class
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Remove transition class after animation
  if (!skipTransition) {
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 150);
  }
};

const isValidTheme = (value: string | null): value is Theme => {
  return value === 'light' || value === 'dark';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage?.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [theme, setTheme]);

  // Initialize theme from query param or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTheme = urlParams.get('theme');
    
    let initialTheme: Theme;
    
    if (isValidTheme(queryTheme)) {
      initialTheme = queryTheme;
      localStorage.setItem(THEME_STORAGE_KEY, queryTheme);
    } else {
      const stored = localStorage?.getItem(THEME_STORAGE_KEY);
      initialTheme = isValidTheme(stored) ? stored : 'dark';
    }
    
    setThemeState(initialTheme);
    applyTheme(initialTheme, true); // Skip transition on mount
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
