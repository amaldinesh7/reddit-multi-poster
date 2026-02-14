import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Bug, HelpCircle, Loader2, ChevronDown, Mail, ArrowLeft } from 'lucide-react';
import { AppHeader, AppFooter } from '@/components/layout';
import { cn } from '@/lib/utils';

// Board tokens from environment variables
const BOARD_TOKENS = {
  bugs: process.env.NEXT_PUBLIC_CANNY_BUGS_BOARD_TOKEN || '',
  features: process.env.NEXT_PUBLIC_CANNY_FEATURES_BOARD_TOKEN || '',
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com';

type TabType = 'features' | 'bugs' | 'faq';

// FAQ Data - Ordered by user journey and common questions
const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I get started with Reddit Multi Poster?',
        a: `Getting started is simple:\n\n**1. Connect your Reddit account** — Click "Login with Reddit" and authorize the app. We only request permissions needed to post on your behalf.\n\n**2. Add subreddits** — Go to Settings and search for subreddits you want to post to. Add them to your list.\n\n**3. Create your post** — Write your title and content, select your subreddits, and hit "Review & Post".\n\nThat's it! Your post will be submitted to all selected subreddits.`,
      },
      {
        q: 'What subreddits can I post to?',
        a: 'You can post to any subreddit where your Reddit account has posting permissions. This includes subreddits you\'re a member of and public subreddits that accept posts from your account. Some subreddits may have karma requirements or other restrictions set by their moderators.',
      },
      {
        q: 'Is my Reddit account safe?',
        a: 'Yes. We use Reddit\'s official OAuth system — we never see or store your Reddit password. You can revoke access anytime from your Reddit account settings under "Apps".',
      },
    ],
  },
  {
    category: 'Posting to Multiple Subreddits',
    questions: [
      {
        q: 'How do I post to multiple subreddits at once?',
        a: `Here's how to cross-post efficiently:\n\n**Step 1: Set up your subreddits (one-time)**\n• Go to **Settings** from the menu\n• Search for subreddits using the search bar\n• Click **+** to add them to your list\n• Organize into categories if needed (e.g., "Tech", "Marketing")\n\n**Step 2: Create your post**\n• On the main page, write your **title** and **content**\n• Add images or videos if needed\n\n**Step 3: Select where to post**\n• Check the subreddits you want to post to\n• Set flairs if required by the subreddit\n\n**Step 4: Review and post**\n• Click **"Review & Post"**\n• Verify everything looks correct\n• Confirm to submit\n\nWe'll post to each subreddit one by one and show you the status of each submission.`,
      },
      {
        q: 'Can I customize my post for each subreddit?',
        a: 'Yes! Click the **edit icon** next to any selected subreddit to customize the title, body text, or flair specifically for that community. Your main post stays as the default for other subreddits. This is useful when different communities have different title formats or content preferences.',
      },
      {
        q: 'What happens if a post fails to submit?',
        a: 'If a post fails (due to subreddit rules, rate limits, etc.), we\'ll show you which ones failed and why. You can then fix the issue and retry just the failed posts without affecting the successful ones.',
      },
    ],
  },
  {
    category: 'Flairs & Media',
    questions: [
      {
        q: 'What are flairs and how do I set them?',
        a: 'Flairs are labels that subreddits use to categorize posts (e.g., "Question", "Discussion", "News"). Some subreddits **require** a flair before posting. When you select a subreddit that uses flairs, you\'ll see a dropdown to choose one. Pick the most relevant flair for your content.',
      },
      {
        q: 'Can I add images or videos?',
        a: 'Yes! Click the **media upload area** to add images or videos. Supported formats include JPG, PNG, GIF, and MP4. Keep in mind that some subreddits restrict media posts or have specific rules about image content.',
      },
    ],
  },
  {
    category: 'Managing Your Subreddits',
    questions: [
      {
        q: 'How do I organize my subreddits?',
        a: 'In **Settings**, you can create categories to group related subreddits. Click **"New Category"** to create one, then drag and drop subreddits between categories. This makes it faster to select multiple related subreddits when posting.',
      },
      {
        q: 'How do I remove a subreddit from my list?',
        a: 'In **Settings**, click the **trash icon** next to any subreddit to remove it from your list. This won\'t affect any posts you\'ve already made to that subreddit.',
      },
    ],
  },
  {
    category: 'Plans & Limits',
    questions: [
      {
        q: 'Is Reddit Multi Poster free?',
        a: 'Yes! The free plan lets you:\n• Save up to **5 subreddits**\n• Post to up to **5 subreddits** at a time\n\nThis is perfect for getting started and testing the app.',
      },
      {
        q: 'What do I get with the paid plan?',
        a: 'The paid plan unlocks the full power of Reddit Multi Poster:\n\n• **Unlimited saved subreddits** — Add as many as you need\n• **Unlimited subreddits per post** — Post to all your subreddits at once\n• **Per-subreddit customization** — Customize title, content, and flair for each subreddit individually\n• **Category organization** — Group subreddits into custom categories\n• **Priority support** — Get help faster when you need it\n\nIt\'s a **one-time payment of ₹199** — no recurring subscription fees, ever.',
      },
      {
        q: 'How do I upgrade?',
        a: 'Click the **"Upgrade"** button in the header or go to Settings. You\'ll be taken to a secure checkout page. Once payment is complete, your account is upgraded instantly.',
      },
      {
        q: 'What if my Reddit account gets suspended?',
        a: 'If your Reddit account gets suspended or banned, don\'t worry — your Pro plan isn\'t lost. Simply email us at the support address below with your old Reddit username and new account details. We\'ll transfer your Pro plan to your new account at no extra cost.',
      },
    ],
  },
];

// Declare Canny global type
declare global {
  interface Window {
    Canny?: {
      (action: string, options?: Record<string, unknown>): void;
      q?: unknown[];
    };
  }
}

// FAQ Item Component with markdown-like formatting
const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Simple markdown-like formatting for bold text and line breaks
  const formatAnswer = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      // Handle line breaks
      const lines = part.split('\n');
      return lines.map((line, lineIndex) => (
        <React.Fragment key={`${index}-${lineIndex}`}>
          {line}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      ));
    });
  };

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left cursor-pointer hover:text-foreground transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium pr-4">{question}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[800px] pb-4' : 'max-h-0'
        )}
      >
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {formatAnswer(answer)}
        </div>
      </div>
    </div>
  );
};

// Tab Button Component using brand colors
const TabButton: React.FC<{
  value: TabType;
  activeTab: TabType;
  onClick: (value: TabType) => void;
  icon: React.ReactNode;
  label: string;
  shortLabel?: string;
}> = ({ value, activeTab, onClick, icon, label, shortLabel }) => {
  const isActive = activeTab === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 h-full text-sm font-medium transition-all duration-200 gap-2 cursor-pointer',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'hover:bg-secondary/80 hover:text-foreground text-muted-foreground'
      )}
      aria-label={label}
      tabIndex={0}
    >
      {icon}
      {shortLabel ? (
        <>
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
};

/**
 * Help & Feedback page with Canny integration and FAQ.
 * Accessible to ALL users (authenticated and unauthenticated) in both dev and prod.
 * - FAQ: Always available to everyone
 * - Feature Requests / Bugs: Works anonymously for non-authenticated users
 */
const HelpPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, me, logout, entitlement } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [ssoToken, setSsoToken] = useState<string | null>(null);
  const [cannyLoaded, setCannyLoaded] = useState(false);
  const [loadingToken, setLoadingToken] = useState(true);
  const [cannyError, setCannyError] = useState<string | null>(null);

  // Get active tab from URL query parameter, default to 'faq'
  // Use router.isReady to ensure query params are available
  const tabFromQuery = router.isReady ? (router.query.tab as string | undefined) : undefined;
  const activeTab: TabType = tabFromQuery && (['faq', 'features', 'bugs'] as const).includes(tabFromQuery as TabType)
    ? (tabFromQuery as TabType)
    : 'faq';

  // Handle tab change - update URL
  const handleTabChange = useCallback((tab: TabType) => {
    router.push({ pathname: '/help', query: { tab } }, undefined, { shallow: true });
  }, [router]);

  // No authentication redirect - help page is public

  // Check admin status (for header display only, not for access control)
  // Only check if user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !me?.name) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin-check');
        if (res.ok) {
          const data: unknown = await res.json();
          // Only show admin menu if user is admin by Reddit username (not password)
          if (
            typeof data === 'object' &&
            data !== null &&
            'isAdminByUsername' in data &&
            (data as { isAdminByUsername: unknown }).isAdminByUsername === true
          ) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch {
        // Silently fail - admin status is not critical for this page
      }
    };
    checkAdmin();
  }, [isAuthenticated, me?.name]);

  // Fetch Canny SSO token for authenticated users
  // Unauthenticated users can still use Canny boards anonymously
  useEffect(() => {
    // If not authenticated, skip SSO token fetch but still allow loading to complete
    if (!isAuthenticated) {
      setLoadingToken(false);
      return;
    }
    
    if (!me?.name) return;

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

  // Render Canny widget when SDK is loaded and tab changes to a Canny board
  const renderCannyWidget = useCallback(() => {
    // Don't render Canny for FAQ tab
    if (activeTab === 'faq') {
      setCannyError(null);
      return;
    }

    if (!cannyLoaded || !window.Canny || loadingToken) return;

    const boardToken = BOARD_TOKENS[activeTab as keyof typeof BOARD_TOKENS];
    if (!boardToken) {
      setCannyError('This feedback board is not configured yet.');
      return;
    }

    // Clear any previous error when attempting to render
    setCannyError(null);

    // Wait a tick for the container to be in the DOM after tab switch
    setTimeout(() => {
      const container = document.querySelector('[data-canny]');
      if (!container || !window.Canny) return;

      // Clear previous widget content
      container.innerHTML = '';

      try {
        // Render new widget
        window.Canny('render', {
          boardToken,
          basePath: '/help',
          ssoToken: ssoToken || undefined,
          theme: 'auto',
        });
      } catch (error) {
        console.error('Failed to render Canny widget:', error);
        setCannyError('Unable to load the feedback widget. Please try refreshing the page.');
      }
    }, 0);
  }, [cannyLoaded, activeTab, ssoToken, loadingToken]);

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
        <title>Help & Feedback | Reddit Multi Poster</title>
        <meta name="description" content="Get help with Reddit Multi Poster. Browse FAQs, request features, or report bugs." />
      </Head>
      <div className="min-h-viewport bg-background safe-bottom flex flex-col">
        {/* Show full AppHeader for authenticated users, simple header for guests */}
        {isAuthenticated ? (
          <AppHeader
            userName={me?.name}
            userAvatar={me?.icon_img}
            onLogout={logout}
            entitlement={entitlement}
            isAdmin={isAdmin}
            pageTitle="Help & Feedback"
            showBackButton
          />
        ) : (
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
            <div className="app-container py-4 max-w-4xl flex items-center justify-between">
              <Link 
                href="/login" 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
              <h1 className="text-sm font-medium">Help & Feedback</h1>
            </div>
          </header>
        )}
        <div className="app-container max-w-4xl py-6">
          <div className="w-full">
            {/* Tab selector - using brand colors */}
            <div className="grid grid-cols-2 h-12 items-center justify-center rounded-xl bg-secondary/50 p-1.5 text-muted-foreground backdrop-blur-sm border border-border/50 w-full">
              <TabButton
                value="faq"
                activeTab={activeTab}
                onClick={handleTabChange}
                icon={<HelpCircle className="w-4 h-4" />}
                label="FAQ"
              />
              <TabButton
                value="features"
                activeTab={activeTab}
                onClick={handleTabChange}
                icon={<MessageSquare className="w-4 h-4" />}
                label="Feature Requests"
                shortLabel="Features"
              />
              {/* Bugs tab hidden for now */}
              {/* <TabButton
                value="bugs"
                activeTab={activeTab}
                onClick={handleTabChange}
                icon={<Bug className="w-4 h-4" />}
                label="Bugs"
              /> */}
            </div>

            {/* Content area */}
            <div className="mt-6">
              {/* FAQ Content - shown when FAQ tab is active */}
              {activeTab === 'faq' && (
                <div className="space-y-6">
                  {FAQ_ITEMS.map((category) => (
                    <div key={category.category} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                      <div className="px-5 py-3 bg-secondary/30 border-b border-border/50">
                        <h2 className="text-sm font-semibold">{category.category}</h2>
                      </div>
                      <div className="px-5">
                        {category.questions.map((item) => (
                          <FAQItem key={item.q} question={item.q} answer={item.a} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Contact Support */}
                  <div className="rounded-xl border border-border/50 bg-card p-5">
                    <h2 className="text-sm font-semibold mb-1">Still need help?</h2>
                    <p className="text-xs text-muted-foreground mb-3">
                      Can&apos;t find what you&apos;re looking for? Reach out and we&apos;ll get back to you as soon as possible.
                    </p>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=Reddit Multi Poster - Support Request`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      tabIndex={0}
                      aria-label={`Email support at ${SUPPORT_EMAIL}`}
                    >
                      <Mail className="w-4 h-4" />
                      {SUPPORT_EMAIL}
                    </a>
                  </div>
                </div>
              )}

              {/* Canny boards - shown when features or bugs tab is active */}
              {activeTab !== 'faq' && (
                <>
                  {!isCannyConfigured ? (
                    // Fallback when Canny not configured
                    <div className="rounded-xl border border-border/50 bg-card p-5 text-center">
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'features' ? 'Feature requests' : 'Bug reporting'} is being set up. Check back soon!
                      </p>
                    </div>
                  ) : cannyError ? (
                    // Error state for Canny
                    <div className="rounded-xl border border-border/50 bg-card p-5 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">{cannyError}</p>
                      <button
                        type="button"
                        tabIndex={0}
                        aria-label="Retry loading Canny widget"
                        onClick={() => {
                          setCannyError(null);
                          renderCannyWidget();
                        }}
                        className="text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        Try again
                      </button>
                    </div>
                  ) : loadingToken || !cannyLoaded ? (
                    // Loading state for Canny
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    // Canny widget container
                    <div data-canny className="min-h-[500px]" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <AppFooter />
      </div>
    </>
  );
};

export default HelpPage;
