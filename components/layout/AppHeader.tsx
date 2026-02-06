import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, Shield, Sun, Moon, Monitor, Infinity } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface UserStats {
  totalKarma?: number;
  followers?: number;
  accountAgeDays?: number;
  accountAgeLabel?: string;
  hasVerifiedEmail?: boolean;
}

interface AppHeaderProps {
  userName?: string;
  userAvatar?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  entitlement?: 'free' | 'paid';
  onUpgrade?: () => void;
  upgradeLoading?: boolean;
  userStats?: UserStats;
}

/**
 * Custom hook for mobile scroll-aware header behavior
 * Shows header when scrolling up, hides when scrolling down
 */
const useScrollDirection = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const lastVisible = useRef(true);
  const lastAtTop = useRef(true);
  const ticking = useRef(false);

  useEffect(() => {
    const threshold = 10;
    const hideThreshold = 80; // Only hide after scrolling down this much

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const atTop = scrollY < 10;
      if (atTop !== lastAtTop.current) {
        lastAtTop.current = atTop;
        setIsAtTop(atTop);
      }

      // Only apply scroll hiding behavior on smaller screens
      if (window.innerWidth >= 768) {
        if (!lastVisible.current) {
          lastVisible.current = true;
          setIsVisible(true);
        }
        lastScrollY.current = scrollY;
        ticking.current = false;
        return;
      }

      const direction = scrollY > lastScrollY.current ? 'down' : 'up';
      const diff = Math.abs(scrollY - lastScrollY.current);

      if (diff > threshold) {
        if (direction === 'down' && scrollY > hideThreshold && lastVisible.current) {
          lastVisible.current = false;
          setIsVisible(false);
        } else if (direction === 'up' && !lastVisible.current) {
          lastVisible.current = true;
          setIsVisible(true);
        }
        lastScrollY.current = scrollY;
      }
      
      ticking.current = false;
    };

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { isVisible, isAtTop };
};

const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  userAvatar,
  onLogout,
  isAdmin = false,
  entitlement,
  onUpgrade,
  upgradeLoading = false,
  userStats: _userStats,
}) => {
  const { theme, setTheme } = useTheme();
  const { isVisible, isAtTop } = useScrollDirection();
  const showUpgrade = entitlement !== 'paid' && onUpgrade;
  const trimmedUserName = userName?.trim() || '';

  // Theme cycle for mobile tap-to-switch button
  const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
  const THEME_ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
  const ThemeIcon = THEME_ICONS[theme];

  const handleCycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };
  
  const handleThemeSelect = (next: Theme) => () => setTheme(next);

  const handleViewProfile = () => {
    if (!trimmedUserName) return;
    window.open(`https://reddit.com/user/${trimmedUserName}`, '_blank');
  };

  const handleSettings = () => {
    window.location.href = '/settings';
  };

  const handleAdminPanel = () => {
    window.location.href = '/admin';
  };

  return (
    <header 
      className={cn(
        // Base styles
        "sticky top-0 z-50 pt-[env(safe-area-inset-top)]",
        // Background with subtle blur
        "bg-background/95 backdrop-blur-sm",
        // Simple border
        "border-b border-border/50",
        // Subtle shadow when scrolled
        !isAtTop && "shadow-sm",
        // Mobile: Slide up/down transition
        "transition-transform duration-smooth md:translate-y-0 will-change-transform transform-gpu",
        !isVisible && "-translate-y-full"
      )}
    >
      <div className="app-container">
        <div className="flex h-14 min-h-[44px] items-center gap-2">
          {/* Logo */}
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Reddit Multi Poster" 
                className="h-full w-full object-contain" 
              />
            </div>
            <span className="truncate font-semibold tracking-tight">Multi Poster</span>
            {entitlement === 'paid' && (
              <span 
                className="relative inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/15 via-purple-500/20 to-violet-500/15 text-violet-400 border border-violet-400/25 shadow-sm shadow-violet-500/20 overflow-hidden"
                aria-label="Pro plan active"
              >
                <span className="relative z-10">Pro</span>
                <span className="absolute inset-0 animate-pro-shimmer" aria-hidden="true" />
              </span>
            )}
          </div>

          {/* Desktop: User Stats removed (now shown in sub-header banner) */}

          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3 ml-auto">
            

            {showUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgradeLoading}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "rounded-md px-3.5 py-1.5 font-semibold",
                  "text-white border border-violet-700/40",
                  "bg-violet-800/90",
                  "transition-all duration-200",
                  "hover:bg-violet-800",
                  "shadow-[0_0_0_1px_rgba(124,58,237,0.4)]",
                  "hover:shadow-[0_0_0_3px_rgba(124,58,237,0.28)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                aria-label="Go Unlimited"
              >
                <Infinity className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{upgradeLoading ? 'Opening checkout…' : 'Go Unlimited'}</span>
                <span className="sm:hidden">{upgradeLoading ? '…' : 'Go Unlimited'}</span>
              </button>
            )}
            {/* Mobile-only: Theme cycle button */}
            <button
              type="button"
              onClick={handleCycleTheme}
              className={cn(
                "md:hidden min-h-[44px] min-w-[44px]",
                "flex items-center justify-center",
                "cursor-pointer active:scale-95"
              )}
              aria-label={`Theme: ${theme}. Tap to switch.`}
            >
              <ThemeIcon className="w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
            </button>
            {/* Desktop-only: User dropdown (profile/settings/theme/logout moved to bottom nav on mobile) */}
            <div className="hidden md:flex">
            <DropdownMenu
              trigger={
                <button
                  className={cn(
                    "flex min-h-[44px] min-w-[44px] sm:min-w-0 items-center justify-center gap-2",
                    "rounded-md px-2.5 sm:px-3 py-1.5",
                    "transition-colors",
                    "hover:bg-secondary",
                    "cursor-pointer"
                  )}
                  aria-label="User menu"
                >
                  <Avatar
                    src={userAvatar}
                    alt={trimmedUserName || 'User'}
                    fallback={trimmedUserName || 'U'}
                    size="sm"
                  />
                  <span className="text-sm font-medium hidden sm:inline truncate max-w-[120px]">
                    u/{trimmedUserName || 'user'}
                  </span>
                  <ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                </button>
              }
            >
              {/* Theme options */}
              <DropdownMenuItem onClick={handleThemeSelect('light')}>
                <Sun className="h-4 w-4 mr-2" aria-hidden="true" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleThemeSelect('dark')}>
                <Moon className="h-4 w-4 mr-2" aria-hidden="true" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleThemeSelect('system')}>
                <Monitor className="h-4 w-4 mr-2" aria-hidden="true" />
                System
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* User actions */}
              <DropdownMenuItem onClick={handleViewProfile}>
                <User className="h-4 w-4 mr-2" aria-hidden="true" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSettings}>
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={handleAdminPanel}>
                  <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-400">
                <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                Logout
              </DropdownMenuItem>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export { useScrollDirection };
export default AppHeader;
