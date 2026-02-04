import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare, MoreVertical, Menu, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const PwaOnboarding = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // Capture install prompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            checkStatus();
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check status
        const checkStatus = () => {
            const promptSeen = localStorage.getItem('pwa_prompt_seen');
            const bannerClosed = localStorage.getItem('pwa_banner_closed');

            // Detect Platform
            const userAgent = window.navigator.userAgent.toLowerCase();
            const isIOS = /iphone|ipad|ipod/.test(userAgent);
            const isAndroid = /android/.test(userAgent);
            const isMobile = isIOS || isAndroid;

            // Check standalone
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;

            if (isStandalone) return;

            if (isIOS) setPlatform('ios');
            else if (isAndroid) setPlatform('android');

            // Logic
            if (!promptSeen && isMobile) {
                setShowPrompt(true);
            } else if (!bannerClosed) {
                // Show banner if prompt was seen/dismissed but banner isn't closed
                // And it's not standalone
                setShowBanner(true);
            }
        };

        checkStatus();

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handlePromptDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa_prompt_seen', 'true');
        setShowBanner(true); // Show banner after dismissing prompt
    };

    const handleBannerDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('pwa_banner_closed', 'true');
    };

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setShowPrompt(false);
                setShowBanner(false);
            }
        } else if (platform === 'ios') {
            // iOS instructions are in the prompt
            if (!showPrompt) setShowPrompt(true);
        }
    };

    return (
        <>
            {/* Full Screen Prompt */}
            {showPrompt && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-md shadow-2xl bg-card border-primary/20 animate-in slide-in-from-bottom duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-lg font-bold text-primary">Install App</CardTitle>
                            <Button variant="ghost" size="icon" onClick={handlePromptDismiss} className="h-8 w-8 -mr-2">
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-2">
                            <p className="text-sm text-muted-foreground">
                                Install Reddit Multi-Poster for the best experience.
                            </p>

                            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                                {platform === 'ios' ? (
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border border-border">
                                                <Share className="w-4 h-4 text-primary" />
                                            </div>
                                            <span>Tap <strong>Share</strong></span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border border-border">
                                                <PlusSquare className="w-4 h-4 text-primary" />
                                            </div>
                                            <span><strong>Add to Home Screen</strong></span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 text-sm">
                                        <p>Tap <strong>Install</strong> below to add to your home screen.</p>
                                    </div>
                                )}
                            </div>

                            <Button onClick={platform === 'ios' ? handlePromptDismiss : handleInstallClick} className="w-full font-semibold">
                                {platform === 'ios' ? 'Got it' : 'Install App'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Persistent Top Banner - Changed to block/static positioning */}
            {showBanner && !showPrompt && (
                <div className="w-full bg-primary/10 border-b border-primary/20 backdrop-blur-md mb-4 rounded-md">
                    <div className="container mx-auto flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/20 p-1.5 rounded-md">
                                <Download className="w-4 h-4 text-primary" />
                            </div>
                            <span className="text-xs font-medium">Install App</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {(platform !== 'ios' && deferredPrompt) && (
                                <Button size="sm" variant="default" className="h-7 text-xs px-2" onClick={handleInstallClick}>
                                    Install
                                </Button>
                            )}
                            {platform === 'ios' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setShowPrompt(true)}>
                                    How?
                                </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={handleBannerDismiss}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PwaOnboarding;
