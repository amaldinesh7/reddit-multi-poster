/**
 * Client-safe entitlement constants.
 * These can be safely imported in both client and server code.
 * 
 * Note: For server-side entitlement logic (DB queries, caching),
 * use lib/entitlement.ts instead.
 */

export type Entitlement = 'free' | 'trial' | 'paid';

/** Max subreddits in settings (total across categories) for FREE users */
export const FREE_MAX_SUBREDDITS = 5;

/** Max subreddits per post for FREE users */
export const FREE_MAX_POST_ITEMS = 5;
