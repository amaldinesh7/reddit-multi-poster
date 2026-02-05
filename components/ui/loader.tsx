import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Detect if the app is running as an installed PWA (standalone mode).
 * Returns false during SSR.
 */
const useIsPwa = (): boolean => {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsPwa(standalone);
  }, []);

  return isPwa;
};

/**
 * Animated logo loader with pulsing effect
 */
export function LogoLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className="relative">
      {/* Outer glow ring */}
      <div 
        className={cn(
          "absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/30 via-violet-500/20 to-orange-500/30",
          "animate-pulse blur-lg scale-125"
        )}
      />
      {/* Logo container with subtle bounce */}
      <div 
        className={cn(
          sizeClasses[size],
          "relative rounded-xl overflow-hidden",
          "animate-logo-pulse"
        )}
      >
        <img 
          src="/logo.png" 
          alt="Loading" 
          className="w-full h-full object-contain"
        />
      </div>
      {/* Orbiting dot */}
      <div className="absolute inset-0 animate-orbit">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
      </div>
    </div>
  );
}

/**
 * Spinner loader - simple and lightweight
 */
export function SpinnerLoader({ 
  size = 'md', 
  className 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-4',
  };

  return (
    <div 
      className={cn(
        sizeClasses[size],
        "border-muted-foreground/20 border-t-primary rounded-full animate-spin",
        className
      )} 
    />
  );
}

/**
 * Dots loader - three bouncing dots
 */
export function DotsLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for content loading
 */
export function Skeleton({ 
  className,
  variant = 'default'
}: { 
  className?: string;
  variant?: 'default' | 'circular' | 'text';
}) {
  const variantClasses = {
    default: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded h-4 w-full',
  };

  return (
    <div 
      className={cn(
        "animate-pulse bg-muted/50",
        variantClasses[variant],
        className
      )} 
    />
  );
}

/**
 * Card skeleton for loading states
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 space-y-3 rounded-lg border border-border/50 bg-card/50", className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

/**
 * Subreddit row skeleton for loading states
 */
export function SubredditRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-secondary/30">
      <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-5" />
    </div>
  );
}

/**
 * Main app loader — subtle, native-feeling.
 *
 * PWA mode (standalone): logo-only with gentle pulse. The OS splash screen
 * already handled branding, so this is just a brief bridge.
 *
 * Browser mode: logo + a thin shimmer bar for visual feedback.
 *
 * Accepts `exiting` prop so the parent can trigger a smooth fade-out
 * before unmounting.
 */
export function AppLoader({ exiting = false }: { exiting?: boolean }) {
  const isPwa = useIsPwa();

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background",
        "transition-opacity duration-300 ease-out",
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      aria-label="Loading application"
      role="status"
    >
      <div className="relative flex flex-col items-center">
        {/* Logo — always shown */}
        <LogoLoader size="lg" />

        {/* Thin shimmer bar — browser mode only */}
        {!isPwa && (
          <div className="mt-6 w-36 h-0.5 rounded-full bg-muted/20 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500/80 to-violet-500/80 rounded-full animate-loading-bar" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline loader for buttons and small areas
 */
export function InlineLoader({ 
  text,
  className 
}: { 
  text?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SpinnerLoader size="sm" />
      {text && <span>{text}</span>}
    </span>
  );
}

/**
 * Page section loader - for loading specific sections
 */
export function SectionLoader({ 
  message,
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <LogoLoader size="md" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
