'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const VERBS = ['hacked', 'built', 'crafted', 'made', 'designed', 'coded', 'created', 'forged'];
const MORPH_INTERVAL = 3000; // 3 seconds between morphs
const GLITCH_DURATION = 700;
const GLITCH_TICK = 45;
const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+-?';

export const AppFooter: React.FC = () => {
  const [currentVerbIndex, setCurrentVerbIndex] = useState(0);
  const [displayVerb, setDisplayVerb] = useState(VERBS[0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const currentVerbRef = useRef(0);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    currentVerbRef.current = currentVerbIndex;
  }, [currentVerbIndex]);

  useEffect(() => {
    const startGlitch = (toIndex: number) => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      setIsAnimating(true);

      const target = VERBS[toIndex];
      const start = Date.now();

      const tick = setInterval(() => {
        const progress = Math.min((Date.now() - start) / GLITCH_DURATION, 1);
        const revealCount = Math.floor(progress * target.length);
        const scrambled = target
          .split('')
          .map((char, index) => (index < revealCount ? char : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]))
          .join('');

        setDisplayVerb(scrambled);

        if (progress >= 1) {
          clearInterval(tick);
          setDisplayVerb(target);
          setIsAnimating(false);
          isAnimatingRef.current = false;
          setCurrentVerbIndex(toIndex);
        }
      }, GLITCH_TICK);
    };

    const interval = setInterval(() => {
      const nextIndex = (currentVerbRef.current + 1) % VERBS.length;
      startGlitch(nextIndex);
    }, MORPH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="relative mt-auto">
      <div className="h-px bg-border/60" />
      <div className="relative overflow-hidden app-container py-3 sm:py-4">
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-6">
          {/* Left side - Privacy / Terms */}
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
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
                'inline-block min-w-[60px] text-right font-mono italic tracking-wider',
                'text-orange-600',
                'transition-all duration-200 ease-out',
                isAnimating 
                  ? 'opacity-70 blur-[1px]' 
                  : 'opacity-100 blur-0'
              )}
            >
              {displayVerb}
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
