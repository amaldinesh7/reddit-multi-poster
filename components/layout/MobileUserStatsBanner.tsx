import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Users } from 'lucide-react';

interface UserStats {
  totalKarma?: number;
  followers?: number;
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
  const lastVisible = useRef(true);
  const ticking = useRef(false);

  useEffect(() => {
    const hideThreshold = 50;

    const updateVisibility = () => {
      const scrollY = window.scrollY;
      
      // Only apply scroll-hide on mobile
      if (window.innerWidth >= 768) {
        if (!lastVisible.current) {
          lastVisible.current = true;
          setIsVisible(true);
        }
        ticking.current = false;
        return;
      }

      // Show when at top or near top
      if (scrollY < hideThreshold && !lastVisible.current) {
        lastVisible.current = true;
        setIsVisible(true);
      } else if (scrollY >= hideThreshold && lastVisible.current) {
        // Hide when scrolled down
        lastVisible.current = false;
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
        if (!lastVisible.current) {
          lastVisible.current = true;
          setIsVisible(true);
        }
      } else if (window.scrollY < 50 && !lastVisible.current) {
        lastVisible.current = true;
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
        // Show on all sizes (mobile scroll-hides, desktop stays visible)
        // Positioning
        "sticky top-14 z-40",
        // Visual styling
        "bg-background/90 backdrop-blur-md",
        "border-b border-border/50",
        // Padding
        "py-1 md:py-1.5",
        // Transition for smooth hide/show
        "transition-[transform,opacity] duration-300 ease-out will-change-transform transform-gpu",
        "bg-neutral-100 dark:bg-neutral-900",
        // Hide state
        !isVisible && "opacity-0 -translate-y-full pointer-events-none border-transparent",
        isVisible && "opacity-100 translate-y-0",
        className
      )}
    >
      <div className="app-container">
        <div className="flex items-center justify-center gap-3">
        {/* Status orb */}
        <div className={cn(
          "w-2 h-2 rounded-full shrink-0",
          statusColors[eligibilityStatus],
          eligibilityStatus === 'good' && "animate-eligibility-pulse",
          eligibilityStatus === 'warning' && "animate-eligibility-pulse-warning",
          eligibilityStatus === 'error' && "animate-eligibility-pulse-blocked"
        )} />
        
        {/* Karma */}
        <div className="flex items-center gap-1.5 text-xs">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold">{(userStats.totalKarma ?? 0).toLocaleString()}</span>
          <span className="text-muted-foreground text-xs">karma</span>
        </div>
        
        <span className="text-muted-foreground/40">·</span>
        
        {/* Followers */}
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold">{(userStats.followers ?? 0).toLocaleString()}</span>
        </div>
        
        <span className="text-muted-foreground/40">·</span>
        
        {/* Account Age */}
        <div className="flex items-center gap-1.5 text-xs">
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
      </div>
    </div>
  );
};

export default MobileUserStatsBanner;
