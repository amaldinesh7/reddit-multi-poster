import posthog from 'posthog-js';
import { PostHog } from 'posthog-node';

// ============================================================================
// Configuration
// ============================================================================

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Check if PostHog is configured
export const isPostHogEnabled = (): boolean => {
  return Boolean(POSTHOG_KEY);
};

// ============================================================================
// Client-side PostHog (Browser)
// ============================================================================

let clientInitialized = false;

/**
 * Initialize PostHog on the client side.
 * Call this once in _app.tsx on mount.
 */
export const initPostHogClient = (): void => {
  if (typeof window === 'undefined') return;
  if (clientInitialized) return;
  if (!isPostHogEnabled()) {
    console.warn('PostHog not configured - analytics disabled');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Privacy-first configuration
    autocapture: false, // Only track explicit events
    capture_pageview: false, // We'll handle page views manually via router
    capture_pageleave: true, // Track when users leave
    disable_session_recording: true, // Disabled for free tier optimization
    persistence: 'localStorage+cookie', // Cross-session identity
    // Respect Do Not Track
    respect_dnt: true,
    // Mask all text by default for privacy
    mask_all_text: false,
    mask_all_element_attributes: false,
  });

  clientInitialized = true;
};

/**
 * Get the PostHog client instance.
 * Returns null if not initialized or not in browser.
 */
export const getPostHogClient = () => {
  if (typeof window === 'undefined') return null;
  if (!clientInitialized) return null;
  return posthog;
};

// ============================================================================
// Server-side PostHog (Node.js)
// ============================================================================

let serverClient: PostHog | null = null;

/**
 * Get the server-side PostHog client.
 * Creates a singleton instance.
 */
export const getPostHogServer = (): PostHog | null => {
  if (typeof window !== 'undefined') return null; // Only server-side
  if (!isPostHogEnabled()) return null;
  
  if (!serverClient) {
    serverClient = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // Flush events in batches
      flushAt: 20,
      flushInterval: 10000, // 10 seconds
    });
  }
  
  return serverClient;
};

// ============================================================================
// Event Types
// ============================================================================

export type AnalyticsEvent = 
  | 'login_clicked'
  | 'oauth_started'
  | 'signup_completed'
  | 'login_completed'
  | 'first_post_created'
  | 'logout';

export interface EventProperties {
  // Common properties
  source?: string;
  
  // User properties (for signup/login)
  reddit_username?: string;
  is_new_user?: boolean;
  
  // Post properties
  subreddit_count?: number;
  post_kind?: string;
}

// ============================================================================
// Client-side Event Tracking
// ============================================================================

/**
 * Track an analytics event on the client side.
 */
export const trackEvent = (
  event: AnalyticsEvent,
  properties?: EventProperties
): void => {
  const client = getPostHogClient();
  if (!client) return;
  
  client.capture(event, properties);
};

/**
 * Track a page view on the client side.
 */
export const trackPageView = (url?: string): void => {
  const client = getPostHogClient();
  if (!client) return;
  
  client.capture('$pageview', url ? { $current_url: url } : undefined);
};

/**
 * Identify a user on the client side.
 * Call this after successful authentication.
 */
export const identifyUser = (
  userId: string,
  properties?: {
    reddit_username?: string;
    created_at?: string;
  }
): void => {
  const client = getPostHogClient();
  if (!client) return;
  
  client.identify(userId, properties);
};

/**
 * Reset user identity (on logout).
 */
export const resetUser = (): void => {
  const client = getPostHogClient();
  if (!client) return;
  
  client.reset();
};

// ============================================================================
// Server-side Event Tracking
// ============================================================================

/**
 * Track an analytics event on the server side.
 * Use this in API routes.
 */
export const trackServerEvent = (
  distinctId: string,
  event: AnalyticsEvent,
  properties?: EventProperties
): void => {
  const client = getPostHogServer();
  if (!client) return;
  
  client.capture({
    distinctId,
    event,
    properties,
  });
};

/**
 * Identify a user on the server side.
 */
export const identifyServerUser = (
  distinctId: string,
  properties?: {
    reddit_username?: string;
    created_at?: string;
  }
): void => {
  const client = getPostHogServer();
  if (!client) return;
  
  client.identify({
    distinctId,
    properties,
  });
};

/**
 * Shutdown server client gracefully.
 * Call this on process exit if needed.
 */
export const shutdownPostHogServer = async (): Promise<void> => {
  if (serverClient) {
    await serverClient.shutdown();
  }
};
