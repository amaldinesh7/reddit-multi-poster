import posthog from 'posthog-js';

// ============================================================================
// Configuration
// ============================================================================

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Environment detection for filtering dev vs prod events
const getEnvironment = (): 'production' | 'development' | 'preview' => {
  // Vercel provides NEXT_PUBLIC_VERCEL_ENV
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  
  // Fallback to NODE_ENV
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
};

export const ANALYTICS_ENVIRONMENT = getEnvironment();

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
// Event Types (shared)
// ============================================================================

export type AnalyticsEvent = 
  // Auth events
  | 'login_clicked'
  | 'oauth_started'
  | 'signup_completed'
  | 'login_completed'
  | 'logout'
  // Tier 1: Revenue & Conversion
  | 'upgrade_modal_opened'
  | 'upgrade_clicked'
  | 'checkout_started'
  | 'checkout_completed'
  | 'free_limit_reached'
  // Tier 2: Core Engagement
  | 'first_post_created'
  | 'post_submitted'
  | 'post_success'
  | 'post_failed'
  | 'media_uploaded'
  // Tier 3: Feature Discovery
  | 'settings_visited'
  | 'category_created'
  | 'subreddit_search_used'
  | 'customize_post_clicked';

export interface EventProperties {
  // Common properties
  source?: string;
  
  // User properties (for signup/login)
  reddit_username?: string;
  is_new_user?: boolean;
  
  // Post properties
  subreddit_count?: number;
  post_kind?: string;
  success_count?: number;
  failed_count?: number;
  error_category?: string;
  
  // Media properties
  media_type?: 'image' | 'video' | 'gallery';
  file_count?: number;
  
  // Upgrade/Checkout properties
  plan?: string;
  amount?: number;
  currency?: string;
  
  // Feature properties
  category_name?: string;
  search_query?: string;
}

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
