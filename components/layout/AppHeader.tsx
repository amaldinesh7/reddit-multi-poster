import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, Shield, Infinity, ArrowLeft, HelpCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
  onLogout?: () => void;
  isAdmin?: boolean;
  entitlement?: 'free' | 'trial' | 'paid';
  trialDaysLeft?: number | null;
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
  trialDaysLeft = null,
  onUpgrade,
  upgradeLoading = false,
  userStats: _userStats,
  pageTitle,
  headerActions,
  showBackButton = false,
  onBack,
}) => {
  const { isVisible, isAtTop } = useScrollDirection();
  const showUpgrade = entitlement !== 'paid' && onUpgrade;
  const hasProAccess = entitlement === 'paid' || entitlement === 'trial';
  const trimmedUserName = userName?.trim() || '';
  const showAdminIcon = isAdmin && pageTitle === 'Admin Panel';

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
            {!pageTitle && (
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
            )}
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
                    hasProAccess && "font-display font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 bg-clip-text text-transparent"
                  )}
                >
                  Multi Poster
                </span>
                {/* Trial badge - text badge in amber to create urgency */}
                {entitlement === 'trial' && (
                  <span 
                    className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    aria-label={`Trial${trialDaysLeft ? ` - ${trialDaysLeft} days left` : ''}`}
                  >
                    Trial{trialDaysLeft ? ` • ${trialDaysLeft}d` : ''}
                  </span>
                )}
                {/* Pro badge - show full text */}
                {entitlement === 'paid' && (
                  <span 
                    className="relative inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/20 via-purple-500/25 to-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/40 dark:border-violet-400/25 shadow-sm shadow-violet-500/25 overflow-hidden"
                    aria-label="Pro plan active"
                  >
                    <span className="relative z-10">Pro</span>
                    <span className="absolute inset-0 animate-pro-shimmer" aria-hidden="true" />
                  </span>
                )}
                {/* Go Unlimited button - shown after trial/pro badge */}
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
              </div>
            )}
          </div>

          {/* Desktop: User Stats removed (now shown in sub-header banner) */}

          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3 ml-auto">
            {/* Mobile: Go Unlimited button - icon-only for trial users, full button for free users */}
            {showUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgradeLoading}
                className={cn(
                  "md:hidden shrink-0 flex items-center justify-center cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "rounded-md font-semibold",
                  "text-white border border-violet-700/40",
                  "bg-violet-800/90",
                  "transition-all duration-200",
                  "hover:bg-violet-800",
                  "shadow-[0_0_0_1px_rgba(124,58,237,0.4)]",
                  "hover:shadow-[0_0_0_3px_rgba(124,58,237,0.28)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  // Icon-only on mobile when on trial, full button for free users
                  entitlement === 'trial' 
                    ? "p-2 min-h-[36px] min-w-[36px]" 
                    : "gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm"
                )}
                aria-label="Go Unlimited"
              >
                <Infinity className="h-4 w-4" aria-hidden="true" />
                {/* Show text only for free users (not on trial) */}
                {entitlement !== 'trial' && (
                  <>
                    <span className="hidden sm:inline">{upgradeLoading ? 'Opening checkout…' : 'Go Unlimited'}</span>
                    <span className="sm:hidden">{upgradeLoading ? '…' : 'Go Unlimited'}</span>
                  </>
                )}
              </button>
            )}
            {headerActions}
            {/* Theme toggle button with animated sun/moon icon */}
            <ThemeToggle />
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
              {onLogout && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-red-400">
                    <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                    Logout
                  </DropdownMenuItem>
                </>
              )}
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
