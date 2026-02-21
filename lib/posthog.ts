/**
 * Client-side PostHog tracking utilities.
 * 
 * IMPORTANT: Only import this file in client-side components and pages.
 * For API routes, use lib/posthog-server.ts instead.
 */
import type { PostHog } from 'posthog-js';
import {
  POSTHOG_KEY,
  POSTHOG_HOST,
  ANALYTICS_ENVIRONMENT,
  isPostHogEnabled,
  type AnalyticsEvent,
  type EventProperties,
} from './posthog-types';
import type { UtmParams } from './utm';

// Re-export types and utilities for convenience
export { isPostHogEnabled, ANALYTICS_ENVIRONMENT };
export type { AnalyticsEvent, EventProperties };

// ============================================================================
// Client-side PostHog (Browser)
// ============================================================================

let clientInitialized = false;
let client: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;
const pendingActions: Array<(activeClient: PostHog) => void> = [];

const flushPendingActions = (activeClient: PostHog): void => {
  for (const action of pendingActions.splice(0)) {
    action(activeClient);
  }
};

const queueAction = (action: (activeClient: PostHog) => void): void => {
  // Keep queue bounded to avoid unbounded memory growth.
  if (pendingActions.length > 100) {
    pendingActions.shift();
  }
  pendingActions.push(action);
};

const loadPostHogClient = async (): Promise<PostHog | null> => {
  if (typeof window === 'undefined') return null;
  if (!isPostHogEnabled()) {
    return null;
  }
  if (clientInitialized && client) {
    return client;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const module = await import('posthog-js');
    const posthog = module.default;

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

    client = posthog;
    clientInitialized = true;
    flushPendingActions(posthog);

    return posthog;
  })()
    .catch((error: unknown) => {
      console.error('Failed to initialize PostHog client', error);
      return null;
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
};

/**
 * Initialize PostHog on the client side.
 * Call this once in _app.tsx on mount.
 */
export const initPostHogClient = (): void => {
  if (!isPostHogEnabled()) {
    console.warn('PostHog not configured - analytics disabled');
    return;
  }
  void loadPostHogClient();
};

/**
 * Get the PostHog client instance.
 * Returns null if not initialized or not in browser.
 */
export const getPostHogClient = (): PostHog | null => {
  if (typeof window === 'undefined') return null;
  if (!clientInitialized || !client) return null;
  return client;
};

// ============================================================================
// Client-side Event Tracking
// ============================================================================

/**
 * Track an analytics event on the client side.
 * Automatically adds environment property for filtering.
 */
export const trackEvent = (
  event: AnalyticsEvent,
  properties?: EventProperties
): void => {
  const activeClient = getPostHogClient();
  if (activeClient) {
    activeClient.capture(event, {
      ...properties,
      environment: ANALYTICS_ENVIRONMENT,
    });
    return;
  }

  queueAction((loadedClient) => {
    loadedClient.capture(event, {
      ...properties,
      environment: ANALYTICS_ENVIRONMENT,
    });
  });
  void loadPostHogClient();
};

/**
 * Track a page view on the client side.
 * Automatically adds environment property for filtering.
 */
export const trackPageView = (url?: string): void => {
  const activeClient = getPostHogClient();
  if (activeClient) {
    activeClient.capture('$pageview', {
      ...(url ? { $current_url: url } : {}),
      environment: ANALYTICS_ENVIRONMENT,
    });
    return;
  }

  queueAction((loadedClient) => {
    loadedClient.capture('$pageview', {
      ...(url ? { $current_url: url } : {}),
      environment: ANALYTICS_ENVIRONMENT,
    });
  });
  void loadPostHogClient();
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
  const activeClient = getPostHogClient();
  if (activeClient) {
    activeClient.identify(userId, properties);
    return;
  }

  queueAction((loadedClient) => {
    loadedClient.identify(userId, properties);
  });
  void loadPostHogClient();
};

/**
 * Register UTM / marketing attribution as PostHog "super properties".
 * Super properties are automatically attached to every subsequent event
 * in the session, so individual trackEvent calls don't need to pass them.
 */
export const registerUtmProperties = (params: UtmParams): void => {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value) cleaned[key] = value;
  }
  if (Object.keys(cleaned).length === 0) return;

  const activeClient = getPostHogClient();
  if (activeClient) {
    activeClient.register(cleaned);
    return;
  }

  queueAction((loadedClient) => {
    loadedClient.register(cleaned);
  });
  void loadPostHogClient();
};

/**
 * Reset user identity (on logout).
 */
export const resetUser = (): void => {
  const activeClient = getPostHogClient();
  if (activeClient) {
    activeClient.reset();
    return;
  }

  queueAction((loadedClient) => {
    loadedClient.reset();
  });
  void loadPostHogClient();
};
