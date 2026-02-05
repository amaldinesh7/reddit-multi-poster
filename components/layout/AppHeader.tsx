import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, Shield, Sun, Moon, Monitor, Infinity, TrendingUp, Clock, Users } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

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
 * Get eligibility status based on user stats
 */
const getEligibilityStatus = (stats: UserStats): 'good' | 'warning' | 'error' => {
  const karma = stats.totalKarma ?? 0;
  const accountAge = stats.accountAgeDays ?? 0;
  const emailVerified = stats.hasVerifiedEmail ?? false;
  
  const issues: string[] = [];
  
  if (karma < 10) issues.push('very low karma');
  else if (karma < 100) issues.push('low karma');
  
  if (accountAge < 3) issues.push('very new account');
  else if (accountAge < 7) issues.push('new account');
  
  if (!emailVerified) issues.push('email not verified');
  
  if (issues.length >= 2 || karma < 10 || accountAge < 3) return 'error';
  if (issues.length >= 1) return 'warning';
  return 'good';
};

/**
 * Custom hook for mobile scroll-aware header behavior
 * Shows header when scrolling up, hides when scrolling down
 */
const useScrollDirection = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const threshold = 10;
    const hideThreshold = 60; // Only hide after scrolling down this much

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      
      setIsAtTop(scrollY < 10);

      // Only apply scroll hiding behavior on smaller screens
      if (window.innerWidth >= 768) {
        setIsVisible(true);
        lastScrollY.current = scrollY;
        ticking.current = false;
        return;
      }

      const direction = scrollY > lastScrollY.current ? 'down' : 'up';
      const diff = Math.abs(scrollY - lastScrollY.current);

      if (diff > threshold) {
        if (direction === 'down' && scrollY > hideThreshold) {
          setIsVisible(false);
        } else if (direction === 'up') {
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
  userStats,
}) => {
  const { setTheme } = useTheme();
  const { isVisible, isAtTop } = useScrollDirection();
  const showUpgrade = entitlement !== 'paid' && onUpgrade;
  
  // Calculate eligibility status for the status orb
  const eligibilityStatus = userStats ? getEligibilityStatus(userStats) : 'good';
  const statusColors = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };
  const statusLabels = {
    good: 'Ready to post',
    warning: 'Some restrictions may apply',
    error: 'Posting may be restricted',
  };

  const handleThemeSelect = (next: Theme) => () => setTheme(next);

  const handleViewProfile = () => {
    window.open(`https://reddit.com/user/${userName}`, '_blank');
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
        "transition-transform duration-smooth md:translate-y-0",
        !isVisible && "-translate-y-full"
      )}
    >
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 min-h-[44px] items-center justify-between gap-2">
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

          {/* Desktop: User Stats - Karma & Account Age */}
          {userStats && (
            <Tooltip
              content={
                <div className="text-xs space-y-1 p-1">
                  <p className="font-medium">{statusLabels[eligibilityStatus]}</p>
                  <p>Karma: {(userStats.totalKarma ?? 0).toLocaleString()}</p>
                  <p>Followers: {(userStats.followers ?? 0).toLocaleString()}</p>
                  <p>Account: {userStats.accountAgeLabel || 'Unknown'} old</p>
                  <p>Email: {userStats.hasVerifiedEmail ? 'Verified' : 'Not verified'}</p>
                </div>
              }
              side="bottom"
            >
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50 cursor-help transition-colors hover:bg-secondary">
                {/* Status orb */}
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  statusColors[eligibilityStatus],
                  eligibilityStatus === 'good' && "animate-eligibility-pulse",
                  eligibilityStatus === 'warning' && "animate-eligibility-pulse-warning",
                  eligibilityStatus === 'error' && "animate-eligibility-pulse-blocked"
                )} />
                {/* Karma */}
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{(userStats.totalKarma ?? 0).toLocaleString()}</span>
                </div>
                <span className="text-muted-foreground/40">·</span>
                {/* Followers */}
                <div className="flex items-center gap-1 text-sm">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{(userStats.followers ?? 0).toLocaleString()}</span>
                </div>
                <span className="text-muted-foreground/40">·</span>
                {/* Account Age */}
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{userStats.accountAgeLabel || 'Unknown'}</span>
                </div>
              </div>
            </Tooltip>
          )}

          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            {showUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgradeLoading}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "rounded-md px-3 py-2 font-semibold",
                  "bg-violet-600 text-white",
                  "transition-colors duration-200",
                  "hover:bg-violet-500",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                aria-label="Go Unlimited"
              >
                <Infinity className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{upgradeLoading ? 'Opening checkout…' : 'Go Unlimited'}</span>
                <span className="sm:hidden">{upgradeLoading ? '…' : 'Pro'}</span>
              </button>
            )}
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
                    alt={userName || 'User'}
                    fallback={userName || 'U'}
                    size="sm"
                  />
                  <span className="text-sm font-medium hidden sm:inline truncate max-w-[120px]">
                    u/{userName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
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
    </header>
  );
};

export { useScrollDirection };
export default AppHeader;
