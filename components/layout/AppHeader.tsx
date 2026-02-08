import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, Shield, Sun, Moon, Monitor, Infinity, ArrowLeft, HelpCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  pageTitle?: string;
  pageSubtitle?: string;
  headerActions?: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
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
  pageTitle,
  headerActions,
  showBackButton = false,
  onBack,
}) => {
  const { theme, setTheme } = useTheme();
  const { isVisible, isAtTop } = useScrollDirection();
  const showUpgrade = entitlement !== 'paid' && onUpgrade;
  const trimmedUserName = userName?.trim() || '';
  const showAdminIcon = isAdmin && pageTitle === 'Admin Panel';

  // Theme cycle for mobile tap-to-switch button
  const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
  const THEME_ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
  const ThemeIcon = THEME_ICONS[theme];

  const handleCycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  const handleViewProfile = () => {
    if (!trimmedUserName) return;
    window.open(`https://reddit.com/user/${trimmedUserName}`, '_blank');
  };

  const handleSettings = () => {
    window.location.href = '/settings';
  };

  const handleHelp = () => {
    window.location.href = '/help';
  };

  const handleAdminPanel = () => {
    window.location.href = '/admin';
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    window.history.back();
  };

  return (
    <header 
      className={cn(
        // Base styles
        "sticky top-0 z-50 pt-[env(safe-area-inset-top)]",
        // Solid background
        "bg-background",
        // Subtle shadow when scrolled
        !isAtTop && "shadow-sm",
        // Mobile: Slide up/down transition
        "transition-transform duration-smooth md:translate-y-0 will-change-transform transform-gpu",
        !isVisible && "-translate-y-full"
      )}
    >
      <div className="app-container">
        <div className="flex h-14 min-h-[44px] items-center gap-2">
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="inline-flex min-h-[44px] min-w-[44px] p-2 cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <a
              href="/"
              aria-label="Go to post screen"
              className={cn(
                "relative h-9 w-9 shrink-0 overflow-hidden rounded-lg flex items-center justify-center",
                "cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <img 
                src="/logo.png" 
                alt="Reddit Multi Poster" 
                className="h-full w-full object-contain" 
              />
            </a>
            {pageTitle ? (
              <div className="flex items-center gap-2 min-w-0">
                {showAdminIcon && <Shield className="w-4 h-4 text-cyan-400" aria-hidden="true" />}
                <span className="truncate text-base font-semibold tracking-tight">
                  {pageTitle}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span 
                  className={cn(
                    "truncate font-semibold tracking-tight",
                    entitlement === 'paid' && "font-display font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 bg-clip-text text-transparent"
                  )}
                >
                  Multi Poster
                </span>
                {showUpgrade && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    disabled={upgradeLoading}
                    className={cn(
                      "hidden md:inline-flex shrink-0 items-center gap-1.5 text-xs cursor-pointer",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "h-7 rounded-md px-2.5 font-semibold",
                      "text-violet-700 dark:text-violet-300",
                      "border border-violet-500/30 dark:border-violet-400/25",
                      "bg-violet-600/10 dark:bg-violet-400/10",
                      "transition-colors duration-200",
                      "hover:bg-violet-600/15 dark:hover:bg-violet-400/15",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                    aria-label="Go Unlimited"
                  >
                    <Infinity className="h-4 w-4" aria-hidden="true" />
                    <span>{upgradeLoading ? 'Opening checkout…' : 'Go Unlimited'}</span>
                  </button>
                )}
                {entitlement === 'paid' && (
                  <span 
                    className="relative inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/20 via-purple-500/25 to-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/40 dark:border-violet-400/25 shadow-sm shadow-violet-500/25 overflow-hidden"
                    aria-label="Pro plan active"
                  >
                    <span className="relative z-10">Pro</span>
                    <span className="absolute inset-0 animate-pro-shimmer" aria-hidden="true" />
                  </span>
                )}
              </div>
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
                  "md:hidden shrink-0 flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer",
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
            {headerActions}
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
            {/* Desktop-only: Theme cycle button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCycleTheme}
              className="hidden md:inline-flex min-h-[44px] min-w-[44px] p-2 cursor-pointer"
              aria-label={`Theme: ${theme}. Click to switch.`}
            >
              <ThemeIcon className="w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
            </Button>
            {/* Desktop-only: User dropdown (profile/settings/theme/logout moved to bottom nav on mobile) */}
            <div className="hidden md:flex">
            <DropdownMenu
              trigger={
                <button
                  className={cn(
                    "group flex min-h-[44px] min-w-[44px] sm:min-w-0 items-center justify-center gap-2",
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
                  <span className="text-sm font-medium hidden sm:inline">
                    u/{trimmedUserName || 'user'}
                  </span>
                  <ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                </button>
              }
            >
              {/* User actions */}
              <DropdownMenuItem onClick={handleViewProfile}>
                <User className="h-4 w-4 mr-2" aria-hidden="true" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSettings}>
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHelp}>
                <HelpCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Help & Feedback
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
