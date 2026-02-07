/**
 * Client-side PostHog tracking utilities.
 * 
 * IMPORTANT: Only import this file in client-side components and pages.
 * For API routes, use lib/posthog-server.ts instead.
 */
import posthog, { PostHog } from 'posthog-js';
import {
  POSTHOG_KEY,
  POSTHOG_HOST,
  ANALYTICS_ENVIRONMENT,
  isPostHogEnabled,
  type AnalyticsEvent,
  type EventProperties,
} from './posthog-types';

// Re-export types and utilities for convenience
export { isPostHogEnabled, ANALYTICS_ENVIRONMENT };
export type { AnalyticsEvent, EventProperties };

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
export const getPostHogClient = (): PostHog | null => {
  if (typeof window === 'undefined') return null;
  if (!clientInitialized) return null;
  return posthog;
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
  const client = getPostHogClient();
  if (!client) return;
  
  client.capture(event, {
    ...properties,
    environment: ANALYTICS_ENVIRONMENT,
  });
};

/**
 * Track a page view on the client side.
 * Automatically adds environment property for filtering.
 */
export const trackPageView = (url?: string): void => {
  const client = getPostHogClient();
  if (!client) return;
  
  client.capture('$pageview', {
    ...(url ? { $current_url: url } : {}),
    environment: ANALYTICS_ENVIRONMENT,
  });
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
