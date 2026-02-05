import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface UserStats {
  totalKarma?: number;
  accountAgeDays?: number;
  accountAgeLabel?: string;
  hasVerifiedEmail?: boolean;
}

interface MobileUserStatsBannerProps {
  userStats: UserStats | undefined;
  className?: string;
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
 * Custom hook for scroll-aware visibility
 * Hides the banner when scrolling down, shows when at top
 */
const useMobileStatsVisibility = () => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const hideThreshold = 50;

    const updateVisibility = () => {
      const scrollY = window.scrollY;
      
      // Only apply on mobile
      if (window.innerWidth >= 768) {
        setIsVisible(false); // Always hidden on desktop
        ticking.current = false;
        return;
      }

      // Show when at top or near top
      if (scrollY < hideThreshold) {
        setIsVisible(true);
      } else {
        // Hide when scrolled down
        setIsVisible(false);
      }
      
      lastScrollY.current = scrollY;
      ticking.current = false;
    };

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateVisibility);
        ticking.current = true;
      }
    };

    // Also handle resize
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsVisible(false);
      } else if (window.scrollY < 50) {
        setIsVisible(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isVisible;
};

export const MobileUserStatsBanner: React.FC<MobileUserStatsBannerProps> = ({
  userStats,
  className,
}) => {
  const isVisible = useMobileStatsVisibility();

  if (!userStats) return null;

  const eligibilityStatus = getEligibilityStatus(userStats);
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

  return (
    <div
      className={cn(
        // Only show on mobile
        "md:hidden",
        // Positioning
        "sticky top-14 z-40",
        // Visual styling
        "bg-background/90 backdrop-blur-md",
        "border-b border-border/50",
        // Padding
        "px-4 py-2",
        // Transition for smooth hide/show
        "transition-all duration-300 ease-out",
        // Hide state
        !isVisible && "opacity-0 -translate-y-full pointer-events-none h-0 py-0 border-0 overflow-hidden",
        isVisible && "opacity-100 translate-y-0",
        className
      )}
    >
      <Tooltip
        content={
          <div className="text-xs space-y-1 p-1">
            <p className="font-medium">{statusLabels[eligibilityStatus]}</p>
            <p>Karma: {(userStats.totalKarma ?? 0).toLocaleString()}</p>
            <p>Account: {userStats.accountAgeLabel || 'Unknown'} old</p>
            <p>Email: {userStats.hasVerifiedEmail ? 'Verified' : 'Not verified'}</p>
          </div>
        }
        side="bottom"
      >
        <div className="flex items-center justify-center gap-3 cursor-help">
          {/* Status orb */}
          <div className={cn(
            "w-2 h-2 rounded-full shrink-0",
            statusColors[eligibilityStatus],
            eligibilityStatus === 'good' && "animate-eligibility-pulse",
            eligibilityStatus === 'warning' && "animate-eligibility-pulse-warning",
            eligibilityStatus === 'error' && "animate-eligibility-pulse-blocked"
          )} />
          
          {/* Karma */}
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold">{(userStats.totalKarma ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">karma</span>
          </div>
          
          <span className="text-muted-foreground/40">·</span>
          
          {/* Account Age */}
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold">{userStats.accountAgeLabel || 'Unknown'}</span>
          </div>
          
          {/* Unverified email indicator */}
          {!userStats.hasVerifiedEmail && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-amber-500 font-medium">Unverified</span>
            </>
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default MobileUserStatsBanner;
