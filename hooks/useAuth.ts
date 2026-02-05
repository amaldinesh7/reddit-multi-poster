/**
 * useAuth Hook
 * 
 * This hook now uses the AuthContext which is backed by SWR for caching.
 * Auth data is cached globally and shared across all pages/components.
 * No redundant API calls on page navigation.
 */

// Re-export types from AuthContext for backward compatibility
export type { AuthUser, PlanLimits } from '@/contexts/AuthContext';

// Re-export the hook from AuthContext
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Hook to access authentication state.
 * Uses SWR cache - no refetching on page navigation.
 * 
 * @example
 * const { isAuthenticated, user, login, logout, refresh } = useAuth();
 */
export function useAuth() {
  return useAuthContext();
}
