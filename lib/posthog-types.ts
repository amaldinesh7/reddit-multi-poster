/**
 * Shared PostHog types and configuration.
 * Import this in both client and server PostHog modules.
 */

// ============================================================================
// Configuration
// ============================================================================

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Check if PostHog is configured
export const isPostHogEnabled = (): boolean => {
  return Boolean(POSTHOG_KEY);
};

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Get the current environment for analytics filtering.
 * Works on both client and server.
 */
export const getEnvironment = (): 'production' | 'development' | 'preview' => {
  // Client-side: use NEXT_PUBLIC_VERCEL_ENV
  const vercelEnv = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_VERCEL_ENV 
    : process.env.VERCEL_ENV;
  
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  
  // Fallback to NODE_ENV
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
};

export const ANALYTICS_ENVIRONMENT = getEnvironment();

// ============================================================================
// Event Types
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
  | 'trial_cta_clicked'
  | 'trial_started'
  | 'trial_expired'
  | 'trial_ended_popup_shown'
  | 'trial_converted_to_paid'
  | 'checkout_started'
  | 'checkout_completed'
  | 'free_limit_reached'
  | 'community_selection_required'
  | 'community_selection_modal_opened'
  | 'community_selection_confirmed'
  | 'community_selection_upgrade_clicked'
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
  pricing_region?: 'india' | 'us_canada' | 'rest_of_world';
  
  // Feature properties
  category_name?: string;
  search_query?: string;
  
  // Community selection properties (trial expiry flow)
  total_communities?: number;
  max_to_keep?: number;
  max_allowed?: number;
  kept?: number;
  removed?: number;
  
  // Marketing attribution (UTM)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  initial_referrer?: string;
  referring_domain?: string;

  // Anonymous ID linking (for funnel continuity)
  $anon_distinct_id?: string;
}
