import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare, MoreVertical, Menu, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const PwaOnboarding = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

    useEffect(() => {
        // Check if simplified prompt has been seen
        const hasSeenPrompt = localStorage.getItem('pwa_prompt_seen');
        if (hasSeenPrompt) return;

        // Detect Platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);

        // Check if running in standalone mode (already installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        if (isStandalone) return;

        if (isIOS) {
            setPlatform('ios');
            setShowPrompt(true);
        } else if (isAndroid) {
            setPlatform('android');
            setShowPrompt(true);
        }
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa_prompt_seen', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <Card className="w-full max-w-md shadow-2xl bg-card border-primary/20 animate-in slide-in-from-bottom duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-lg font-bold text-primary">Install App</CardTitle>
                    <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8 -mr-2">
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                        Install this app on your home screen for the best experience.
                    </p>

                    <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                        {platform === 'ios' ? (
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border border-border">
                                        <Share className="w-4 h-4 text-primary" />
                                    </div>
                                    <span>Tap the <strong>Share</strong> button in the navigation bar.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border border-border">
                                        <PlusSquare className="w-4 h-4 text-primary" />
                                    </div>
                                    <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border border-border">
                                        <MoreVertical className="w-4 h-4 text-primary" />
                                    </div>
                                    <span>Tap the <strong>Menu</strong> icon (3 dots) in the browser.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border border-border">
                                        <Download className="w-4 h-4 text-primary" />
                                    </div>
                                    <span>Tap <strong>Install App</strong> or <strong>Add to Home screen</strong>.</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button onClick={handleDismiss} className="w-full font-semibold">
                        Got it
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default PwaOnboarding;
