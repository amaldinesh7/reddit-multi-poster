import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { X, Share, PlusSquare, ChevronRight, Smartphone, Zap, CheckCircle2, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Types for state management
type InstallState = 'checking' | 'available' | 'prompting' | 'installing' | 'installed' | 'unavailable';
type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop' | 'unknown';
type IOSStep = 0 | 1 | 2 | 3; // intro, share, add, success

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaOnboardingProps {
  hasQueueItems?: boolean;
}

export const PwaOnboarding: React.FC<PwaOnboardingProps> = ({ hasQueueItems = false }) => {
  // Core state
  const [installState, setInstallState] = useState<InstallState>('checking');
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [iosStep, setIosStep] = useState<IOSStep>(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  // Animation states
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Refs
  const promptRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Detect platform
  const detectPlatform = useCallback((): Platform => {
    if (typeof window === 'undefined') return 'unknown';
    
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua);
    
    if (isIOS && isSafari) return 'ios-safari';
    if (isIOS) return 'ios-other';
    if (isAndroid) return 'android';
    if (!isIOS && !isAndroid) return 'desktop';
    return 'unknown';
  }, []);

  // Check if app is already installed
  const isStandalone = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
  }, []);

  // Initialize and set up event listeners
  useEffect(() => {
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    // Check if already installed
    if (isStandalone()) {
      setInstallState('installed');
      return;
    }

    // Handle beforeinstallprompt for Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('available');
      checkAndShowUI();
    };

    // Handle appinstalled event
    const handleAppInstalled = () => {
      setInstallState('installed');
      setShowSuccessAnimation(true);
      setDeferredPrompt(null);
      
      // Auto-dismiss after success animation
      setTimeout(() => {
        setShowPrompt(false);
        setShowBanner(false);
        setShowSuccessAnimation(false);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check status for iOS or if prompt already captured
    const checkStatus = () => {
      if (detectedPlatform === 'ios-safari') {
        setInstallState('available');
        checkAndShowUI();
      } else if (detectedPlatform === 'ios-other') {
        // Chrome/Firefox on iOS can't install PWAs
        setInstallState('unavailable');
      } else if (detectedPlatform === 'desktop') {
        // Desktop - wait for beforeinstallprompt or hide
        setTimeout(() => {
          if (installState === 'checking') {
            setInstallState('unavailable');
          }
        }, 2000);
      }
    };

    checkStatus();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [detectPlatform, isStandalone, installState]);

  // Check localStorage and show appropriate UI
  const checkAndShowUI = useCallback(() => {
    const promptDismissed = localStorage.getItem('pwa_prompt_dismissed');
    const bannerDismissed = localStorage.getItem('pwa_banner_dismissed');
    const detectedPlatform = detectPlatform();
    const isMobile = detectedPlatform.startsWith('ios') || detectedPlatform === 'android';

    if (!isMobile) return;

    if (!promptDismissed) {
      setShowPrompt(true);
    } else if (!bannerDismissed) {
      setShowBanner(true);
    }
  }, [detectPlatform]);

  // Handle Android/Chrome install
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    setInstallState('installing');
    setIsAnimating(true);
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallState('installed');
        setShowSuccessAnimation(true);
        localStorage.setItem('pwa_installed', 'true');
      } else {
        setInstallState('available');
      }
    } catch (error) {
      console.error('Install prompt error:', error);
      setInstallState('available');
    } finally {
      setIsAnimating(false);
    }
  };

  // Handle iOS step navigation
  const handleIOSNextStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIosStep((prev) => Math.min(prev + 1, 3) as IOSStep);
      setIsAnimating(false);
    }, 150);
  };

  const handleIOSPrevStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIosStep((prev) => Math.max(prev - 1, 0) as IOSStep);
      setIsAnimating(false);
    }, 150);
  };

  // Dismiss handlers
  const handlePromptDismiss = () => {
    setShowPrompt(false);
    setIosStep(0);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    
    // Show banner as fallback
    if (installState === 'available') {
      setShowBanner(true);
    }
  };

  const handleBannerDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  const handleShowHowTo = () => {
    setShowBanner(false);
    setShowPrompt(true);
    setIosStep(0);
  };

  // Focus management for accessibility
  useEffect(() => {
    if (showPrompt && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [showPrompt]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPrompt) {
        handlePromptDismiss();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrompt]);

  // Don't render if installed or unavailable
  if (installState === 'installed' || installState === 'unavailable' || installState === 'checking') {
    return null;
  }

  // Render iOS walkthrough steps
  const renderIOSWalkthrough = () => {
    const steps = [
      {
        title: "Add Multi Poster to Home",
        subtitle: "Launch instantly. No browser needed.",
        content: (
          <div className="flex items-center justify-center gap-8 py-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Faster Launch</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">App-like Feel</span>
            </div>
          </div>
        ),
        cta: "Show Me How",
        ctaAction: handleIOSNextStep,
      },
      {
        title: "Step 1: Tap Share",
        subtitle: "Find the share button in Safari",
        content: (
          <div className="relative py-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 animate-pwa-highlight">
                  <Share className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <ArrowDown className="w-5 h-5 text-primary animate-pwa-bounce" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-[200px]">
                Tap the <strong className="text-foreground">Share</strong> button at the bottom of Safari
              </p>
            </div>
          </div>
        ),
        cta: "I Found It",
        ctaAction: handleIOSNextStep,
      },
      {
        title: "Step 2: Add to Home Screen",
        subtitle: "Scroll and tap the option",
        content: (
          <div className="relative py-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 animate-pwa-highlight">
                  <PlusSquare className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                <div className="flex items-center gap-3">
                  <PlusSquare className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">Add to Home Screen</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-[220px]">
                Scroll down in the share menu and tap <strong className="text-foreground">"Add to Home Screen"</strong>
              </p>
            </div>
          </div>
        ),
        cta: "Done!",
        ctaAction: handleIOSNextStep,
      },
      {
        title: "You're All Set!",
        subtitle: "Multi Poster is on your home screen",
        content: (
          <div className="relative py-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 animate-pwa-success">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  Look for the <strong className="text-foreground">Multi Poster</strong> icon
                </p>
                <p className="text-xs text-muted-foreground">
                  on your home screen
                </p>
              </div>
            </div>
          </div>
        ),
        cta: "Close",
        ctaAction: handlePromptDismiss,
      },
    ];

    const currentStep = steps[iosStep];
    const progress = ((iosStep + 1) / steps.length) * 100;

    return (
      <div className={`transition-opacity duration-150 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
        {/* Progress indicator */}
        {iosStep > 0 && iosStep < 3 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Step {iosStep} of 2</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">{currentStep.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{currentStep.subtitle}</p>
        </div>

        {currentStep.content}

        {/* Navigation */}
        <div className="flex gap-2 mt-6">
          {iosStep > 0 && iosStep < 3 && (
            <Button 
              variant="outline" 
              onClick={handleIOSPrevStep}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {iosStep === 0 && (
            <Button 
              variant="ghost" 
              onClick={handlePromptDismiss}
              className="flex-1"
            >
              Maybe Later
            </Button>
          )}
          <Button 
            onClick={currentStep.ctaAction}
            className="flex-1 font-semibold"
          >
            {currentStep.cta}
            {iosStep < 3 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    );
  };

  // Render Android/Chrome prompt
  const renderAndroidPrompt = () => {
    if (showSuccessAnimation) {
      return (
        <div className="text-center py-8">
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 animate-pwa-success mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Added to Home Screen!</h3>
          <p className="text-sm text-muted-foreground">
            Find Multi Poster on your home screen
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* App preview */}
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Image src="/logo.png" alt="Multi Poster" width={40} height={40} className="w-10 h-10" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
              <PlusSquare className="w-3 h-3 text-primary" />
            </div>
          </div>
        </div>

        {/* Value props */}
        <div className="flex items-center justify-center gap-8 py-2">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">Instant Launch</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Smartphone className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">Full Screen</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Add Multi Poster to your home screen for quick access anytime.
        </p>

        {/* CTA */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="ghost" 
            onClick={handlePromptDismiss}
            className="flex-1"
          >
            Not Now
          </Button>
          <Button 
            onClick={handleInstallClick}
            disabled={installState === 'installing'}
            className="flex-1 font-semibold"
          >
            {installState === 'installing' ? (
              <>
                <span className="animate-pulse">Adding...</span>
              </>
            ) : (
              <>
                Add to Home Screen
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Full Screen Modal */}
      {showPrompt && (
        <div 
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-400 ease-out"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-prompt-title"
        >
          <Card 
            ref={promptRef}
            className="w-full max-w-md shadow-2xl bg-card border-primary/20 animate-in slide-in-from-bottom-8 duration-700 ease-out pb-[env(safe-area-inset-bottom,0px)] sm:pb-0"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-md shadow-primary/20">
                  <Image src="/logo.png" alt="" width={24} height={24} className="w-6 h-6" aria-hidden="true" />
                </div>
                <CardTitle id="pwa-prompt-title" className="text-lg font-bold text-foreground">
                  {platform === 'ios-safari' ? '' : 'Add to Home Screen'}
                </CardTitle>
              </div>
              <Button 
                ref={firstFocusableRef}
                variant="ghost" 
                size="icon" 
                onClick={handlePromptDismiss} 
                className="h-8 w-8 -mr-2 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              {platform === 'ios-safari' ? renderIOSWalkthrough() : renderAndroidPrompt()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Persistent Banner */}
      {showBanner && !showPrompt && (
        <div 
          className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 rounded-md overflow-hidden"
          role="region"
          aria-label="Add to home screen"
        >
          <div className="app-container flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-sm animate-pwa-icon-pulse">
                  <Image src="/logo.png" alt="" width={20} height={20} className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Use as a mobile app</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">Launch instantly, no browser needed</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {platform === 'ios-safari' ? (
                <Button 
                  size="sm" 
                  variant="default" 
                  className="h-8 text-xs px-3 font-medium cursor-pointer"
                  onClick={handleShowHowTo}
                >
                  Show Me
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              ) : deferredPrompt ? (
                <Button 
                  size="sm" 
                  variant="default" 
                  className="h-8 text-xs px-3 font-medium cursor-pointer"
                  onClick={handleInstallClick}
                  disabled={installState === 'installing'}
                >
                  {installState === 'installing' ? 'Adding...' : 'Add'}
                </Button>
              ) : null}
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 cursor-pointer" 
                onClick={handleBannerDismiss}
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaOnboarding;
