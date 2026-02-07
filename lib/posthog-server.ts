/**
 * Server-side PostHog tracking utilities.
 * 
 * IMPORTANT: Only import this file in API routes or server-side code.
 * Do NOT import in client-side components or pages.
 */
import { PostHog } from 'posthog-node';
import {
  POSTHOG_KEY,
  POSTHOG_HOST,
  ANALYTICS_ENVIRONMENT,
  isPostHogEnabled,
  type AnalyticsEvent,
  type EventProperties,
} from './posthog-types';

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
 * Alias an anonymous ID to a user ID.
 * Use this to link pre-login events (like oauth_started) to the authenticated user.
 * @param userId - The authenticated user's ID
 * @param anonymousId - The anonymous ID used before authentication (e.g., oauth state)
 */
export const aliasServerUser = (
  userId: string,
  anonymousId: string
): void => {
  const client = getPostHogServer();
  if (!client) return;
  
  client.alias({
    distinctId: userId,
    alias: anonymousId,
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
 * Flush all pending events immediately.
 * Call this before ending API responses to ensure events are sent.
 */
export const flushPostHogServer = async (): Promise<void> => {
  if (serverClient) {
    await serverClient.flush();
  }
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
