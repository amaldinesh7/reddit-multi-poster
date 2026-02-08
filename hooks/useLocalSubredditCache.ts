/**
 * Unified localStorage cache for subreddit data.
 * 
 * This hook provides a single source of truth for all subreddit data on the client side.
 * It uses localStorage for persistence with versioning to prevent stale data issues.
 * 
 * Cache Architecture:
 * - Key format: `subreddit_cache_v{VERSION}_{subredditName}`
 * - TTL: 24 hours for data freshness
 * - Version: Incremented when data structure changes (invalidates old cache)
 * 
 * IMPORTANT: userIsContributor is ONLY included in the cached data if Reddit explicitly
 * returns the user_is_contributor field. We NEVER default it to false to prevent
 * incorrect "needs verification" badge display.
 */

import { useCallback, useRef, useMemo } from 'react';
import { UnifiedSubredditData } from '../types/api';

// Cache configuration
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = `subreddit_cache_v${CACHE_VERSION}_`;

// Storage keys for tracking
const CACHE_INDEX_KEY = `subreddit_cache_index_v${CACHE_VERSION}`;

interface CacheEntry {
  data: UnifiedSubredditData;
  timestamp: number;
}

interface CacheIndex {
  subreddits: string[];
  lastCleanup: number;
}

/**
 * Hook for managing unified subreddit data in localStorage
 */
export function useLocalSubredditCache() {
  // Use refs to maintain stable references across renders
  const cacheRef = useRef<Map<string, UnifiedSubredditData>>(new Map());
  
  /**
   * Generate cache key for a subreddit
   */
  const getCacheKey = useCallback((subreddit: string): string => {
    return `${CACHE_KEY_PREFIX}${subreddit.toLowerCase()}`;
  }, []);

  /**
   * Check if a cache entry is still valid (not expired)
   */
  const isValidEntry = useCallback((entry: CacheEntry): boolean => {
    const now = Date.now();
    return entry.data.cacheVersion === CACHE_VERSION && 
           (now - entry.timestamp) < CACHE_TTL_MS;
  }, []);

  /**
   * Get cached data for a subreddit
   */
  const getCached = useCallback((subreddit: string): UnifiedSubredditData | null => {
    const key = getCacheKey(subreddit);
    
    // First check memory cache
    const memCached = cacheRef.current.get(subreddit.toLowerCase());
    if (memCached) {
      return memCached;
    }
    
    // Check localStorage
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const entry: CacheEntry = JSON.parse(stored);
      
      // Validate cache entry
      if (!isValidEntry(entry)) {
        // Remove stale entry
        localStorage.removeItem(key);
        return null;
      }
      
      // Populate memory cache
      cacheRef.current.set(subreddit.toLowerCase(), entry.data);
      
      return entry.data;
    } catch (error) {
      console.warn(`Failed to read cache for ${subreddit}:`, error);
      return null;
    }
  }, [getCacheKey, isValidEntry]);

  /**
   * Set cached data for a subreddit
   */
  const setCached = useCallback((subreddit: string, data: UnifiedSubredditData): void => {
    const key = getCacheKey(subreddit);
    const normalizedName = subreddit.toLowerCase();
    
    // Update memory cache
    cacheRef.current.set(normalizedName, data);
    
    if (typeof window === 'undefined') return;
    
    try {
      const entry: CacheEntry = {
        data: {
          ...data,
          cacheVersion: CACHE_VERSION,
          cachedAt: new Date().toISOString(),
        },
        timestamp: Date.now(),
      };
      
      localStorage.setItem(key, JSON.stringify(entry));
      
      // Update cache index
      updateCacheIndex(normalizedName);
    } catch (error) {
      console.warn(`Failed to cache data for ${subreddit}:`, error);
      // If localStorage is full, try to clean up old entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        cleanupOldEntries();
        // Retry once
        try {
          const entry: CacheEntry = {
            data: {
              ...data,
              cacheVersion: CACHE_VERSION,
              cachedAt: new Date().toISOString(),
            },
            timestamp: Date.now(),
          };
          localStorage.setItem(key, JSON.stringify(entry));
        } catch {
          // Give up - localStorage is full
        }
      }
    }
  }, [getCacheKey]);

  /**
   * Get multiple cached subreddits at once
   */
  const getCachedBatch = useCallback((subreddits: string[]): Map<string, UnifiedSubredditData> => {
    const result = new Map<string, UnifiedSubredditData>();
    
    for (const subreddit of subreddits) {
      const cached = getCached(subreddit);
      if (cached) {
        result.set(subreddit.toLowerCase(), cached);
      }
    }
    
    return result;
  }, [getCached]);

  /**
   * Set multiple cached subreddits at once
   */
  const setCachedBatch = useCallback((entries: Map<string, UnifiedSubredditData>): void => {
    entries.forEach((data, subreddit) => {
      setCached(subreddit, data);
    });
  }, [setCached]);

  /**
   * Remove cached data for a specific subreddit
   */
  const removeCached = useCallback((subreddit: string): void => {
    const key = getCacheKey(subreddit);
    const normalizedName = subreddit.toLowerCase();
    
    cacheRef.current.delete(normalizedName);
    
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
      removefromCacheIndex(normalizedName);
    } catch (error) {
      console.warn(`Failed to remove cache for ${subreddit}:`, error);
    }
  }, [getCacheKey]);

  /**
   * Clear all subreddit cache entries
   */
  const clearAllCache = useCallback((): void => {
    cacheRef.current.clear();
    
    if (typeof window === 'undefined') return;
    
    try {
      // Get all keys with our prefix
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_KEY_PREFIX) || key === CACHE_INDEX_KEY) {
          keysToRemove.push(key);
        }
      }
      
      // Remove all cache entries
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }, []);

  /**
   * Clear cache and remove stale sessionStorage data (migration helper)
   */
  const migrateFromSessionStorage = useCallback((): void => {
    if (typeof window === 'undefined') return;
    
    try {
      // Clear old sessionStorage keys that might have stale data
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.includes('subreddit') || key?.includes('userStatus')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      console.log(`Migrated: removed ${keysToRemove.length} old sessionStorage entries`);
    } catch (error) {
      console.warn('Failed to migrate from sessionStorage:', error);
    }
  }, []);

  /**
   * Check if we have fresh data for a subreddit
   */
  const hasFreshCache = useCallback((subreddit: string): boolean => {
    return getCached(subreddit) !== null;
  }, [getCached]);

  /**
   * Get list of all cached subreddit names
   */
  const getCachedSubreddits = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
      if (!indexStr) return [];
      
      const index: CacheIndex = JSON.parse(indexStr);
      return index.subreddits;
    } catch {
      return [];
    }
  }, []);

  return useMemo(() => ({
    getCached,
    setCached,
    getCachedBatch,
    setCachedBatch,
    removeCached,
    clearAllCache,
    migrateFromSessionStorage,
    hasFreshCache,
    getCachedSubreddits,
  }), [
    getCached,
    setCached,
    getCachedBatch,
    setCachedBatch,
    removeCached,
    clearAllCache,
    migrateFromSessionStorage,
    hasFreshCache,
    getCachedSubreddits,
  ]);
}

// Helper functions (outside hook to avoid recreating)

function updateCacheIndex(subreddit: string): void {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    const index: CacheIndex = indexStr 
      ? JSON.parse(indexStr) 
      : { subreddits: [], lastCleanup: Date.now() };
    
    if (!index.subreddits.includes(subreddit)) {
      index.subreddits.push(subreddit);
    }
    
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore index update failures
  }
}

function removefromCacheIndex(subreddit: string): void {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    if (!indexStr) return;
    
    const index: CacheIndex = JSON.parse(indexStr);
    index.subreddits = index.subreddits.filter(s => s !== subreddit);
    
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore index update failures
  }
}

function cleanupOldEntries(): void {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    if (!indexStr) return;
    
    const index: CacheIndex = JSON.parse(indexStr);
    const now = Date.now();
    
    // Only cleanup once per hour
    if ((now - index.lastCleanup) < 3600000) return;
    
    const validSubreddits: string[] = [];
    
    for (const subreddit of index.subreddits) {
      const key = `${CACHE_KEY_PREFIX}${subreddit}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        try {
          const entry: CacheEntry = JSON.parse(stored);
          if ((now - entry.timestamp) < CACHE_TTL_MS) {
            validSubreddits.push(subreddit);
          } else {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
    
    index.subreddits = validSubreddits;
    index.lastCleanup = now;
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore cleanup failures
  }
}

// Export cache version for external use (e.g., migration scripts)
export const SUBREDDIT_CACHE_VERSION = CACHE_VERSION;
