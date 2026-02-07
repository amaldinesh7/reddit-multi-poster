/**
 * Server-side PostHog tracking utilities.
 * 
 * IMPORTANT: Only import this file in API routes or server-side code.
 * Do NOT import in client-side components or pages.
 */
import { PostHog } from 'posthog-node';
import type { AnalyticsEvent, EventProperties } from './posthog';

// ============================================================================
// Configuration
// ============================================================================

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Environment detection for filtering dev vs prod events
const getEnvironment = (): 'production' | 'development' | 'preview' => {
  // Vercel provides VERCEL_ENV on server-side
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  
  // Fallback to NODE_ENV
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
};

const ANALYTICS_ENVIRONMENT = getEnvironment();

// Check if PostHog is configured
const isPostHogEnabled = (): boolean => {
  return Boolean(POSTHOG_KEY);
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
// Server-side Event Tracking
// ============================================================================

/**
 * Track an analytics event on the server side.
 * Use this in API routes.
 * Automatically adds environment property for filtering.
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
    properties: {
      ...properties,
      environment: ANALYTICS_ENVIRONMENT,
    },
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
