'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const VERBS = ['hacked', 'built', 'crafted', 'made', 'designed', 'coded', 'created', 'forged'];
const MORPH_INTERVAL = 3000; // 3 seconds between morphs

export const AppFooter: React.FC = () => {
  const [currentVerbIndex, setCurrentVerbIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      
      // After fade out completes, change the word
      setTimeout(() => {
        setCurrentVerbIndex((prev) => (prev + 1) % VERBS.length);
        setIsAnimating(false);
      }, 300);
    }, MORPH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="relative mt-auto">
      {/* Clean separator line */}
      <div className="h-px bg-border/50" />
      
      {/* Footer content with noise texture */}
      <div 
        className={cn(
          "noise-texture noise-subtle",
          "relative overflow-hidden",
          "px-4 sm:px-6 py-2 sm:py-4",
          "bg-muted/30"
        )}
      >
        <div className="relative max-w-7xl mx-auto flex items-center justify-between">
          {/* Left side - Privacy / Terms */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
            <Link 
              href="/privacy" 
              className="hover:text-foreground transition-colors duration-200 cursor-pointer"
            >
              Privacy
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link 
              href="/terms" 
              className="hover:text-foreground transition-colors duration-200 cursor-pointer"
            >
              Terms
            </Link>
          </div>

          {/* Right side - Animated credit */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
            <span
              className={cn(
                'inline-block min-w-[52px] text-right font-mono italic',
                'text-primary/80',
                'transition-all duration-300 ease-out',
                isAnimating 
                  ? 'opacity-0 translate-y-1 blur-[2px]' 
                  : 'opacity-100 translate-y-0 blur-0'
              )}
            >
              {VERBS[currentVerbIndex]}
            </span>
            <span className="text-muted-foreground">by</span>
            <span className="text-muted-foreground/80 tracking-wide">
              a fellow redditor
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
