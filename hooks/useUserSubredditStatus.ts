/**
 * @deprecated This hook is deprecated. Use useLocalSubredditCache instead.
 * This hook uses sessionStorage which can cause stale data issues with userIsContributor.
 * The new useLocalSubredditCache uses localStorage with proper versioning and TTL,
 * and fetches unified data from /api/reddit/subreddit-info.
 * 
 * Migration guide:
 * - Replace: import { useUserSubredditStatus } from '../hooks/useUserSubredditStatus';
 * - With: import { useLocalSubredditCache } from '../hooks/useLocalSubredditCache';
 * - The new hook combines both subreddit settings and user status in one cache entry.
 * - Use localCache.getCached(name) to get the unified data including user status fields.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { UserSubredditStatus } from '../utils/reddit';

const SESSION_STORAGE_KEY = 'user_subreddit_status';

/**
 * @deprecated Use useLocalSubredditCache instead.
 */
interface UseUserSubredditStatusReturn {
  /** Get cached user status for a subreddit (returns null if not fetched) */
  getUserStatus: (subreddit: string) => UserSubredditStatus | null;
  
  /** Fetch user status for multiple subreddits */
  fetchUserStatus: (subreddits: string[], force?: boolean) => Promise<Record<string, UserSubredditStatus>>;
  
  /** All cached user statuses */
  statusCache: Record<string, UserSubredditStatus>;
  
  /** Loading state per subreddit */
  loading: Record<string, boolean>;
  
  /** Whether any fetch is in progress */
  isLoading: boolean;
  
  /** Error message if fetch failed */
  error: string | null;
  
  /** Clear all cached status data */
  clearCache: () => void;
}

/**
 * Hook for fetching and caching user-specific subreddit status
 * This data is per-user and should NOT be cached in the server/database
 * It's stored in React state and optionally persisted to sessionStorage
 */
export function useUserSubredditStatus(): UseUserSubredditStatusReturn {
  const [statusCache, setStatusCache] = useState<Record<string, UserSubredditStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Track which subreddits we've already started fetching to prevent duplicate requests
  const fetchingRef = useRef<Set<string>>(new Set());
  
  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setStatusCache(parsed);
      }
    } catch (e) {
      // Ignore sessionStorage errors
      console.warn('Failed to load user subreddit status from sessionStorage:', e);
    }
  }, []);
  
  // Save to sessionStorage when cache changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Object.keys(statusCache).length === 0) return;
    
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(statusCache));
    } catch (e) {
      // Ignore sessionStorage errors (quota exceeded, etc.)
      console.warn('Failed to save user subreddit status to sessionStorage:', e);
    }
  }, [statusCache]);
  
  const getUserStatus = useCallback((subreddit: string): UserSubredditStatus | null => {
    return statusCache[subreddit.toLowerCase()] || null;
  }, [statusCache]);
  
  const fetchUserStatus = useCallback(async (
    subreddits: string[], 
    force: boolean = false
  ): Promise<Record<string, UserSubredditStatus>> => {
    // Filter out already cached subreddits unless force is true
    const subredditsToFetch = subreddits.filter(sub => {
      const normalized = sub.toLowerCase();
      if (!force && statusCache[normalized]) return false;
      if (fetchingRef.current.has(normalized)) return false;
      return true;
    });
    
    // If nothing to fetch, return current cache
    if (subredditsToFetch.length === 0) {
      const results: Record<string, UserSubredditStatus> = {};
      subreddits.forEach(sub => {
        const cached = statusCache[sub.toLowerCase()];
        if (cached) results[sub.toLowerCase()] = cached;
      });
      return results;
    }
    
    // Mark as fetching
    subredditsToFetch.forEach(sub => fetchingRef.current.add(sub.toLowerCase()));
    
    // Update loading state
    const loadingUpdate: Record<string, boolean> = {};
    subredditsToFetch.forEach(sub => {
      loadingUpdate[sub.toLowerCase()] = true;
    });
    setLoading(prev => ({ ...prev, ...loadingUpdate }));
    setError(null);
    
    try {
      const response = await fetch('/api/user/subreddit-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddits: subredditsToFetch }),
      });
      
      const json = await response.json();
      
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to fetch user status');
      }
      
      const newStatusData = json.data as Record<string, UserSubredditStatus>;
      
      // Update cache with new data
      setStatusCache(prev => ({ ...prev, ...newStatusData }));
      
      // Return combined results (requested subreddits from cache + new data)
      const results: Record<string, UserSubredditStatus> = { ...newStatusData };
      subreddits.forEach(sub => {
        const normalized = sub.toLowerCase();
        if (!results[normalized] && statusCache[normalized]) {
          results[normalized] = statusCache[normalized];
        }
      });
      
      return results;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to fetch user status';
      setError(errorMessage);
      console.error('Failed to fetch user subreddit status:', e);
      
      // Return what we have from cache
      const results: Record<string, UserSubredditStatus> = {};
      subreddits.forEach(sub => {
        const cached = statusCache[sub.toLowerCase()];
        if (cached) results[sub.toLowerCase()] = cached;
      });
      return results;
    } finally {
      // Clear loading and fetching states
      subredditsToFetch.forEach(sub => fetchingRef.current.delete(sub.toLowerCase()));
      
      const loadingClear: Record<string, boolean> = {};
      subredditsToFetch.forEach(sub => {
        loadingClear[sub.toLowerCase()] = false;
      });
      setLoading(prev => ({ ...prev, ...loadingClear }));
    }
  }, [statusCache]);
  
  const clearCache = useCallback(() => {
    setStatusCache({});
    setLoading({});
    setError(null);
    fetchingRef.current.clear();
    
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {
        // Ignore
      }
    }
  }, []);
  
  const isLoading = Object.values(loading).some(Boolean);
  
  return {
    getUserStatus,
    fetchUserStatus,
    statusCache,
    loading,
    isLoading,
    error,
    clearCache,
  };
}
