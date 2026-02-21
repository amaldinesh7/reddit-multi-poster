import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Stacked Bars loader — five bars dancing in rhythm.
 * Apple Music visualizer feel: minimal, clean, satisfying.
 */
export function LogoLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const barConfig = {
    sm: { count: 4, width: 'w-[3px]', gap: 'gap-[3px]', height: 'h-6' },
    md: { count: 5, width: 'w-[3.5px]', gap: 'gap-[4px]', height: 'h-8' },
    lg: { count: 5, width: 'w-1', gap: 'gap-[5px]', height: 'h-10' },
  };

  const config = barConfig[size];

  return (
    <div
      className={cn('flex items-center', config.gap, config.height)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: config.count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            config.width,
            'rounded-full bg-primary animate-[bar-dance_1.2s_cubic-bezier(0.4,0,0.6,1)_infinite]'
          )}
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
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
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30">
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
 * Main app loader — centered stacked bars with smooth fade transition.
 * Accepts `exiting` prop so the parent can trigger a fade-out before unmounting.
 */
export function AppLoader({ exiting = false }: { exiting?: boolean }) {
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
      <LogoLoader size="lg" />
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
    <div className={cn("flex flex-col items-center justify-center py-12 gap-4", className)}>
      <LogoLoader size="md" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
