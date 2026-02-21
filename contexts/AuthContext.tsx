import React, { createContext, useContext, useCallback, useMemo, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import axios from 'axios';
import { fetcher, SWR_KEYS } from '@/lib/swr';
import { captureClientError } from '@/lib/clientErrorHandler';
import { identifyUser, resetUser, trackEvent } from '@/lib/posthog';

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  redditUsername: string;
  redditId: string;
  avatarUrl?: string;
  userId: string; // Supabase user ID
}

export interface PlanLimits {
  maxSubreddits: number;
  maxPostItems: number;
  temporarySelectionEnabled: boolean;
}

export interface RedditMe {
  name: string;
  id: string;
  icon_img?: string;
  total_karma?: number;
  followers?: number;
  created_utc?: number;
  has_verified_email?: boolean;
}

interface MeResponse {
  authenticated: boolean;
  me?: RedditMe;
  userId?: string;
  entitlement?: 'free' | 'trial' | 'paid';
  trialEndsAt?: string | null;
  trialDaysLeft?: number | null;
  showTrialEndedPopup?: boolean;
  limits?: PlanLimits;
}

interface AuthContextValue {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  me: RedditMe | null; // Raw Reddit user data
  entitlement: 'free' | 'trial' | 'paid';
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  showTrialEndedPopup: boolean;
  limits: PlanLimits;
  error: string | null;
  // Actions
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMITS: PlanLimits = {
  maxSubreddits: 30,
  maxPostItems: 100,
  temporarySelectionEnabled: true,
};

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use SWR for caching auth data across navigations
  const { data, error, isLoading, mutate: revalidate } = useSWR<MeResponse>(
    SWR_KEYS.AUTH,
    fetcher,
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5 minutes - auth data rarely changes
      errorRetryCount: 1,
      shouldRetryOnError: (err) => {
        // Don't retry on auth errors
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 401 || status === 403) return false;
        }
        return true;
      },
      onError: (err) => {
        // Silent handling - don't show toast for auth check failures
        captureClientError(err, 'AuthContext.fetch', {
          showToast: false,
          skipSentry: axios.isAxiosError(err) && err.response?.status === 401,
        });
      },
    }
  );

  // Derive state from SWR data
  // Require both authenticated flag AND valid userId
  const hasValidUserId = Boolean(data?.userId);
  const isAuthenticated = Boolean(data?.authenticated && data?.me && hasValidUserId);
  const me = data?.me ?? null;
  const user: AuthUser | null = (me && hasValidUserId)
    ? {
        redditUsername: me.name,
        redditId: me.id,
        avatarUrl: me.icon_img,
        userId: data!.userId!, // Safe: hasValidUserId guarantees this exists
      }
    : null;
  const entitlement = data?.entitlement === 'paid'
    ? 'paid'
    : data?.entitlement === 'trial'
      ? 'trial'
      : 'free';
  const trialEndsAt = data?.trialEndsAt ?? null;
  const trialDaysLeft = data?.trialDaysLeft ?? null;
  const showTrialEndedPopup = Boolean(data?.showTrialEndedPopup);
  const limits = data?.limits ?? DEFAULT_LIMITS;
  const errorMessage = error ? 'Failed to check authentication' : null;

  // Identify the user client-side once the session is restored
  const identifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || identifiedRef.current === user.userId) return;
    identifyUser(user.userId, { reddit_username: user.redditUsername });
    identifiedRef.current = user.userId;
  }, [user]);

  // Actions
  const login = useCallback(() => {
    window.location.href = '/api/auth/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      trackEvent('logout', { source: 'header' });
      await axios.post('/api/auth/logout');
      resetUser();
      // Clear the SWR cache
      await mutate(SWR_KEYS.AUTH, { authenticated: false }, { revalidate: false });
      window.location.href = '/login';
    } catch (err) {
      captureClientError(err, 'AuthContext.logout', {
        toastTitle: 'Logout Failed',
        userMessage: 'Could not log out. Please try again.',
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    await revalidate();
  }, [revalidate]);

  // Memoize context value
  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      me,
      entitlement,
      trialEndsAt,
      trialDaysLeft,
      showTrialEndedPopup,
      limits,
      error: errorMessage,
      login,
      logout,
      refresh,
    }),
    [
      isAuthenticated,
      isLoading,
      user,
      me,
      entitlement,
      trialEndsAt,
      trialDaysLeft,
      showTrialEndedPopup,
      limits,
      errorMessage,
      login,
      logout,
      refresh,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access auth state from the context.
 * Uses SWR cache - no refetching on page navigation.
 */
export const useAuthContext = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
};

// ============================================================================
// Utility: Prefetch auth data
// ============================================================================

/**
 * Prefetch auth data into SWR cache.
 * Call this on link hover for instant page transitions.
 */
export const prefetchAuth = () => {
  mutate(SWR_KEYS.AUTH, fetcher(SWR_KEYS.AUTH), { revalidate: false });
};
