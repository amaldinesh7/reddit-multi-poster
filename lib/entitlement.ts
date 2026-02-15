/**
 * Entitlement and plan limits (₹199 one-time via Dodo Payments + 7-day trial).
 * Free: max 5 subreddits in settings, max 5 items per post.
 * Trial/Paid: UNLIMITED - no restrictions.
 * 
 * NOTE: This file contains server-only code (Supabase, PostHog server).
 * For client-safe constants, import from lib/entitlement-constants.ts instead.
 */

import { createServerSupabaseClient } from './supabase';
import { trackServerEvent } from './posthog-server';
// Re-export client-safe types and constants
export { type Entitlement, FREE_MAX_SUBREDDITS, FREE_MAX_POST_ITEMS } from './entitlement-constants';

interface EntitlementRow {
  entitlement: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_used_at: string | null;
  trial_ended_notified_at: string | null;
}

export interface EntitlementState {
  entitlement: Entitlement;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  showTrialEndedPopup: boolean;
}

// Import for local use
import { type Entitlement, FREE_MAX_SUBREDDITS, FREE_MAX_POST_ITEMS } from './entitlement-constants';

const ENTITLEMENT_CACHE: Map<string, { entitlement: Entitlement; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

const toEntitlement = (value: string | null | undefined): Entitlement => {
  if (value === 'paid') return 'paid';
  if (value === 'trial') return 'trial';
  return 'free';
};

const getTrialDaysLeft = (trialEndsAt: string | null): number | null => {
  if (!trialEndsAt) return null;
  const endsAt = new Date(trialEndsAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(endsAt) || endsAt <= now) return 0;
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.ceil((endsAt - now) / dayMs));
};

const isTrialExpired = (trialEndsAt: string | null): boolean => {
  if (!trialEndsAt) return false;
  const endsAt = new Date(trialEndsAt).getTime();
  return Number.isFinite(endsAt) && endsAt <= Date.now();
};

/**
 * Get entitlement details and auto-downgrade expired trial users to free.
 */
export async function getEntitlementState(userId: string): Promise<EntitlementState> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('entitlement, trial_started_at, trial_ends_at, trial_used_at, trial_ended_notified_at')
    .eq('id', userId)
    .single<EntitlementRow>();

  if (error || !data) {
    if (error) {
      console.warn('getEntitlementState: DB query failed, defaulting to free', { userId, error: error.message });
    }
    return {
      entitlement: 'free',
      trialEndsAt: null,
      trialDaysLeft: null,
      showTrialEndedPopup: false,
    };
  }

  const trialExpired = isTrialExpired(data.trial_ends_at);
  const shouldShowTrialEndedPopup = Boolean(
    data.trial_used_at &&
    trialExpired &&
    !data.trial_ended_notified_at
  );

  if (data.entitlement === 'trial' && trialExpired) {
    const { error: downgradeError } = await supabase
      .from('users')
      .update({ entitlement: 'free' })
      .eq('id', userId)
      .eq('entitlement', 'trial');

    if (downgradeError) {
      console.warn('getEntitlementState: failed to auto-downgrade expired trial', {
        userId,
        error: downgradeError.message,
      });
    } else {
      trackServerEvent(userId, 'trial_expired', { plan: 'pro_trial' });
    }
  }

  const normalizedEntitlement = data.entitlement === 'trial' && trialExpired
    ? 'free'
    : toEntitlement(data.entitlement);

  ENTITLEMENT_CACHE.set(userId, { entitlement: normalizedEntitlement, fetchedAt: Date.now() });

  return {
    entitlement: normalizedEntitlement,
    trialEndsAt: data.trial_ends_at,
    trialDaysLeft: normalizedEntitlement === 'trial' ? getTrialDaysLeft(data.trial_ends_at) : null,
    showTrialEndedPopup: shouldShowTrialEndedPopup,
  };
}

/**
 * Get user entitlement from DB. Uses short in-memory cache to avoid repeated queries.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const cached = ENTITLEMENT_CACHE.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entitlement;
  }

  const state = await getEntitlementState(userId);
  return state.entitlement;
}

/**
 * Plan limits for a given entitlement (for API and UI).
 * Free users have hard limits; trial/paid users have no limits (Infinity).
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
  // Trial/Paid users: NO LIMITS
  return {
    maxSubreddits: Infinity,
    maxPostItems: Infinity,
    temporarySelectionEnabled: true,
  };
}

export async function markTrialEndedNotified(userId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('users')
    .update({ trial_ended_notified_at: new Date().toISOString() })
    .eq('id', userId)
    .is('trial_ended_notified_at', null);

  if (error) {
    console.warn('markTrialEndedNotified: failed', { userId, error: error.message });
  }
}

/**
 * Invalidate cache for a user (e.g. after webhook sets paid).
 */
export function invalidateEntitlementCache(userId: string): void {
  ENTITLEMENT_CACHE.delete(userId);
}
