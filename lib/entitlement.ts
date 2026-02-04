/**
 * Entitlement and plan limits (₹199 one-time via Dodo Payments).
 * Free: max 5 subreddits in settings, max 5 items per post.
 * Paid: UNLIMITED - no restrictions.
 */

import { createServerSupabaseClient } from './supabase';

export type Entitlement = 'free' | 'paid';

/** Max subreddits in settings (total across categories) for FREE users */
export const FREE_MAX_SUBREDDITS = 5;

/** Max subreddits per post for FREE users */
export const FREE_MAX_POST_ITEMS = 5;

const ENTITLEMENT_CACHE: Map<string, { entitlement: Entitlement; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Get user entitlement from DB. Uses short in-memory cache to avoid repeated queries.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const cached = ENTITLEMENT_CACHE.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entitlement;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('entitlement')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return 'free';
  }

  const entitlement = (data.entitlement === 'paid' ? 'paid' : 'free') as Entitlement;
  ENTITLEMENT_CACHE.set(userId, { entitlement, fetchedAt: Date.now() });
  return entitlement;
}

/**
 * Plan limits for a given entitlement (for API and UI).
 * Free users have hard limits; paid users have no limits (Infinity).
 */
export function getLimits(entitlement: Entitlement): {
  maxSubreddits: number;
  maxPostItems: number;
  temporarySelectionEnabled: boolean;
} {
  if (entitlement === 'free') {
    return {
      maxSubreddits: FREE_MAX_SUBREDDITS,
      maxPostItems: FREE_MAX_POST_ITEMS,
      temporarySelectionEnabled: true,
    };
  }
  // Paid users: NO LIMITS
  return {
    maxSubreddits: Infinity,
    maxPostItems: Infinity,
    temporarySelectionEnabled: true,
  };
}

/**
 * Invalidate cache for a user (e.g. after webhook sets paid).
 */
export function invalidateEntitlementCache(userId: string): void {
  ENTITLEMENT_CACHE.delete(userId);
}
