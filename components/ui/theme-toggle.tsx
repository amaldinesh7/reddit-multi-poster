import React from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Animated theme toggle button with smooth sun/moon icon transition.
 * Click toggles between light and dark themes.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center justify-center",
        "min-h-[44px] min-w-[44px]",
        "cursor-pointer",
        "active:scale-95 transition-transform duration-75",
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      <div className="relative w-[18px] h-[18px]">
        {/* Sun icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "absolute inset-0 text-muted-foreground",
            "transition-all duration-200 ease-out",
            isDark 
              ? "opacity-0 rotate-45 scale-0" 
              : "opacity-100 rotate-0 scale-100"
          )}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>

        {/* Moon icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "absolute inset-0 text-muted-foreground",
            "transition-all duration-200 ease-out",
            isDark 
              ? "opacity-100 rotate-0 scale-100" 
              : "opacity-0 -rotate-45 scale-0"
          )}
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </div>
    </button>
  );
};

export default ThemeToggle;
