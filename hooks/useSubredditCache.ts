import { useState, useCallback } from 'react';
import axios from 'axios';

import { PostRequirements, SubredditRules, FlairOption } from '../utils/reddit';
import { TitleTag, CachedSubredditData, ApiResponse } from '../types/api';
import { fetchSubredditCache } from '../lib/api/reddit';

interface UseSubredditCacheReturn {
  // Get cached data for a subreddit
  getCachedData: (subredditName: string) => CachedSubredditData | null;
  
  // Fetch and cache data for a subreddit
  fetchAndCache: (subredditName: string, force?: boolean) => Promise<CachedSubredditData>;
  
  // Fetch and cache data for multiple subreddits
  fetchAndCacheMultiple: (subredditNames: string[], force?: boolean) => Promise<Record<string, CachedSubredditData>>;
  
  // Get loading states
  loading: Record<string, boolean>;
  
  // Get error states
  errors: Record<string, string>;
  
  // Local cache of fetched data (for quick access within session)
  cache: Record<string, CachedSubredditData>;
}

export function useSubredditCache(): UseSubredditCacheReturn {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cache, setCache] = useState<Record<string, CachedSubredditData>>({});

  const setLoadingState = useCallback((subreddit: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [subreddit.toLowerCase()]: isLoading }));
  }, []);

  const setErrorState = useCallback((subreddit: string, error: string | null) => {
    setErrors(prev => {
      const key = subreddit.toLowerCase();
      if (error) {
        return { ...prev, [key]: error };
      } else {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
    });
  }, []);

  const getCachedData = useCallback((subredditName: string): CachedSubredditData | null => {
    return cache[subredditName.toLowerCase()] || null;
  }, [cache]);

  const fetchAndCache = useCallback(async (
    subredditName: string, 
    force: boolean = false
  ): Promise<CachedSubredditData> => {
    const normalizedName = subredditName.toLowerCase();
    
    // Return from local cache if available and not forcing
    if (!force && cache[normalizedName]) {
      return cache[normalizedName];
    }

    setLoadingState(normalizedName, true);
    setErrorState(normalizedName, null);

    try {
      const cachedData = await fetchSubredditCache(normalizedName, force);

      // Store in local cache
      setCache(prev => ({ ...prev, [normalizedName]: cachedData }));
      setLoadingState(normalizedName, false);

      return cachedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subreddit data';
      setErrorState(normalizedName, errorMessage);
      setLoadingState(normalizedName, false);
      
      throw new Error(errorMessage);
    }
  }, [cache, setLoadingState, setErrorState]);

  const fetchAndCacheMultiple = useCallback(async (
    subredditNames: string[], 
    force: boolean = false
  ): Promise<Record<string, CachedSubredditData>> => {
    const results: Record<string, CachedSubredditData> = {};
    
    // Get already cached data if not forcing
    if (!force) {
      for (const name of subredditNames) {
        const normalizedName = name.toLowerCase();
        if (cache[normalizedName]) {
          results[name] = cache[normalizedName];
        }
      }
    }
    
    // Find subreddits that need to be fetched
    const needsFetching = subredditNames.filter(name => 
      force || !cache[name.toLowerCase()]
    );
    
    if (needsFetching.length === 0) {
      return results;
    }
    
    // Fetch missing data in parallel with rate limiting
    const batchSize = 3;
    const batches: string[][] = [];
    
    for (let i = 0; i < needsFetching.length; i += batchSize) {
      batches.push(needsFetching.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (subredditName) => {
        try {
          const data = await fetchAndCache(subredditName, force);
          return { subredditName, data };
        } catch (error) {
          console.error(`Failed to fetch data for ${subredditName}:`, error);
          return { subredditName, data: null };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ subredditName, data }) => {
        if (data) {
          results[subredditName] = data;
        }
      });
      
      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return results;
  }, [cache, fetchAndCache]);

  return {
    getCachedData,
    fetchAndCache,
    fetchAndCacheMultiple,
    loading,
    errors,
    cache,
  };
}
