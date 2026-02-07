import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Bug, HelpCircle, Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Board tokens from environment variables
const BOARD_TOKENS = {
  bugs: process.env.NEXT_PUBLIC_CANNY_BUGS_BOARD_TOKEN || '',
  features: process.env.NEXT_PUBLIC_CANNY_FEATURES_BOARD_TOKEN || '',
  help: process.env.NEXT_PUBLIC_CANNY_HELP_BOARD_TOKEN || '',
};

type BoardType = 'bugs' | 'features' | 'help';

// Declare Canny global type
declare global {
  interface Window {
    Canny?: {
      (action: string, options?: Record<string, unknown>): void;
      q?: unknown[];
    };
  }
}

/**
 * Help & Feedback page with Canny integration.
 * Accessible to all authenticated users.
 */
const HelpPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, me, logout, entitlement } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [ssoToken, setSsoToken] = useState<string | null>(null);
  const [cannyLoaded, setCannyLoaded] = useState(false);
  const [activeBoard, setActiveBoard] = useState<BoardType>('features');
  const [loadingToken, setLoadingToken] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check admin status (for header display only, not for access control)
  useEffect(() => {
    if (!me?.name) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin-check');
        if (res.ok) {
          const data: unknown = await res.json();
          if (
            typeof data === 'object' &&
            data !== null &&
            'isAdmin' in data &&
            typeof (data as { isAdmin: unknown }).isAdmin === 'boolean'
          ) {
            setIsAdmin((data as { isAdmin: boolean }).isAdmin);
          }
        }
      } catch {
        // Silently fail - admin status is not critical for this page
      }
    };
    checkAdmin();
  }, [me?.name]);

  // Fetch Canny SSO token
  useEffect(() => {
    if (!isAuthenticated || !me?.name) return;

    const fetchSsoToken = async () => {
      try {
        const res = await fetch('/api/canny-sso');
        if (res.ok) {
          const data: unknown = await res.json();
          if (
            typeof data === 'object' &&
            data !== null &&
            'ssoToken' in data &&
            typeof (data as { ssoToken: unknown }).ssoToken === 'string'
          ) {
            setSsoToken((data as { ssoToken: string }).ssoToken);
          }
        }
      } catch {
        // SSO token fetch failed - widget will work without user identification
        console.error('Failed to fetch Canny SSO token');
      } finally {
        setLoadingToken(false);
      }
    };

    fetchSsoToken();
  }, [isAuthenticated, me?.name]);

  // Load Canny SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if Canny SDK is already loaded
    if (window.Canny) {
      setCannyLoaded(true);
      return;
    }

    // Load Canny SDK script
    const loadCannySDK = () => {
      if (document.getElementById('canny-jssdk')) {
        setCannyLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://sdk.canny.io/sdk.js';
      script.id = 'canny-jssdk';
      script.onload = () => setCannyLoaded(true);

      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      }
    };

    // Initialize Canny queue if not exists
    if (typeof window.Canny !== 'function') {
      const cannyQueue: unknown[][] = [];
      const cannyFunc = function (...args: unknown[]) {
        cannyQueue.push(args);
      };
      (cannyFunc as { q?: unknown[][] }).q = cannyQueue;
      window.Canny = cannyFunc as Window['Canny'];
    }

    if (document.readyState === 'complete') {
      loadCannySDK();
    } else {
      window.addEventListener('load', loadCannySDK);
      return () => window.removeEventListener('load', loadCannySDK);
    }
  }, []);

  // Render Canny widget when SDK is loaded and board changes
  const renderCannyWidget = useCallback(() => {
    if (!cannyLoaded || !window.Canny || loadingToken) return;

    const boardToken = BOARD_TOKENS[activeBoard];
    if (!boardToken) return;

    // Clear previous widget
    const container = document.querySelector('[data-canny]');
    if (container) {
      container.innerHTML = '';
    }

    // Render new widget
    window.Canny('render', {
      boardToken,
      basePath: '/help',
      ssoToken: ssoToken || undefined,
      theme: 'auto',
    });
  }, [cannyLoaded, activeBoard, ssoToken, loadingToken]);

  useEffect(() => {
    renderCannyWidget();
  }, [renderCannyWidget]);

  // Check if Canny is configured
  const isCannyConfigured = Object.values(BOARD_TOKENS).some((token) => token !== '');

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Help & Feedback | Poststation</title>
      </Head>
      <div className="min-h-viewport bg-background safe-bottom flex flex-col">
        {isAuthenticated && (
          <AppHeader
            userName={me?.name}
            userAvatar={me?.icon_img}
            onLogout={logout}
            entitlement={entitlement}
            isAdmin={isAdmin}
            pageTitle="Help & Feedback"
            showBackButton
          />
        )}
        <div className="app-container max-w-4xl py-6">
          {!isCannyConfigured ? (
            // Fallback UI when Canny is not configured
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h2 className="text-sm font-semibold">Send Feedback</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Have a suggestion or general feedback? This feature is being set up.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <div className="flex items-start gap-3">
                  <Bug className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h2 className="text-sm font-semibold">Report a Bug</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Found something broken? Bug reporting is being set up.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h2 className="text-sm font-semibold">Get Help</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Need assistance? Help section is being set up.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Canny widget with tabs
            <div className="w-full">
              {/* Board selector tabs */}
              <Tabs
                value={activeBoard}
                onValueChange={(value) => setActiveBoard(value as BoardType)}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="features">
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Feature Requests</span>
                    <span className="sm:hidden">Features</span>
                  </TabsTrigger>
                  <TabsTrigger value="bugs">
                    <Bug className="w-4 h-4" />
                    <span>Bugs</span>
                  </TabsTrigger>
                  <TabsTrigger value="help">
                    <HelpCircle className="w-4 h-4" />
                    <span>Help</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Single Canny widget container */}
              <div className="mt-6">
                {loadingToken || !cannyLoaded ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div data-canny className="min-h-[500px]" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HelpPage;
