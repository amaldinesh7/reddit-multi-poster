import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  getCachedSubredditData,
  cacheSubredditData,
  isSubredditDataCached,
  getCachedSubredditsData,
  removeCachedSubredditData,
  FlairOption,
  SubredditRules,
  CachedSubredditData,
  TitleTag
} from '../utils/subredditCache';

interface UseSubredditCacheReturn {
  // Get cached data for a subreddit
  getCachedData: (subredditName: string) => CachedSubredditData | null;
  
  // Check if subreddit is cached
  isCached: (subredditName: string) => boolean;
  
  // Fetch and cache data for a subreddit
  fetchAndCache: (subredditName: string, force?: boolean) => Promise<CachedSubredditData>;
  
  // Fetch and cache data for multiple subreddits
  fetchAndCacheMultiple: (subredditNames: string[], force?: boolean) => Promise<Record<string, CachedSubredditData>>;
  
  // Remove cached data for a subreddit
  removeFromCache: (subredditName: string) => void;
  
  // Get loading states
  loading: Record<string, boolean>;
  
  // Get error states
  errors: Record<string, string>;
}

export function useSubredditCache(): UseSubredditCacheReturn {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setLoadingState = useCallback((subreddit: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [subreddit]: isLoading }));
  }, []);

  const setErrorState = useCallback((subreddit: string, error: string | null) => {
    setErrors(prev => {
      if (error) {
        return { ...prev, [subreddit]: error };
      } else {
        const { [subreddit]: _, ...rest } = prev;
        return rest;
      }
    });
  }, []);

  const getCachedData = useCallback((subredditName: string): CachedSubredditData | null => {
    return getCachedSubredditData(subredditName);
  }, []);

  const isCached = useCallback((subredditName: string): boolean => {
    return isSubredditDataCached(subredditName);
  }, []);

  const fetchAndCache = useCallback(async (subredditName: string, force: boolean = false): Promise<CachedSubredditData> => {
    const normalizedName = subredditName.toLowerCase();
    
    // If not forcing and data is cached, return cached data
    if (!force && isSubredditDataCached(normalizedName)) {
      const cached = getCachedSubredditData(normalizedName);
      if (cached) {
        return cached;
      }
    }

    setLoadingState(normalizedName, true);
    setErrorState(normalizedName, null);

    try {
      // Fetch both flairs and rules in parallel
      const [flairsResponse, rulesResponse] = await Promise.all([
        axios.get('/api/flairs', { 
          params: { subreddit: normalizedName, force: force ? '1' : undefined } 
        }),
        axios.get('/api/subreddit-rules', { 
          params: { subreddit: normalizedName, force: force ? '1' : undefined } 
        }).catch(() => ({
          data: {
            requiresGenderTag: false,
            requiresContentTag: false,
            genderTags: [],
            contentTags: [],
            submitText: ''
          }
        }))
      ]);

      const flairs: FlairOption[] = flairsResponse.data.flairs || [];
      const flairRequired: boolean = flairsResponse.data.required || false;
      let rules: SubredditRules = rulesResponse.data;

      // Parse title tags from submitText if available
      if (rules.submitText) {
        try {
          const tagsResponse = await axios.post('/api/parse-title-tags', {
            submitText: rules.submitText,
            subreddit: normalizedName
          });
          rules = {
            ...rules,
            titleTags: tagsResponse.data.titleTags || []
          };
        } catch (tagError) {
          console.error('Failed to parse title tags:', tagError);
          // Continue without title tags
        }
      }

      // Cache the data
      cacheSubredditData(normalizedName, flairs, flairRequired, rules);

      const cachedData: CachedSubredditData = {
        flairs,
        flairRequired,
        rules,
        lastFetched: Date.now(),
        version: 2
      };

      setLoadingState(normalizedName, false);
      return cachedData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subreddit data';
      setErrorState(normalizedName, errorMessage);
      setLoadingState(normalizedName, false);
      
      // Return empty data structure on error
      const emptyData: CachedSubredditData = {
        flairs: [],
        flairRequired: false,
        rules: {
          requiresGenderTag: false,
          requiresContentTag: false,
          genderTags: [],
          contentTags: []
        },
        lastFetched: Date.now(),
        version: 2
      };
      
      throw new Error(errorMessage);
    }
  }, [setLoadingState, setErrorState]);

  const fetchAndCacheMultiple = useCallback(async (
    subredditNames: string[], 
    force: boolean = false
  ): Promise<Record<string, CachedSubredditData>> => {
    const results: Record<string, CachedSubredditData> = {};
    
    // Get already cached data if not forcing
    if (!force) {
      const cached = getCachedSubredditsData(subredditNames);
      Object.assign(results, cached);
    }
    
    // Find subreddits that need to be fetched
    const needsFetching = subredditNames.filter(name => 
      force || !isSubredditDataCached(name.toLowerCase())
    );
    
    if (needsFetching.length === 0) {
      return results;
    }
    
    // Fetch missing data in parallel (with some rate limiting)
    const batchSize = 3; // Limit concurrent requests to avoid rate limits
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
      
      // Small delay between batches to be respectful to Reddit's API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }, [fetchAndCache]);

  const removeFromCache = useCallback((subredditName: string) => {
    removeCachedSubredditData(subredditName);
  }, []);

  return {
    getCachedData,
    isCached,
    fetchAndCache,
    fetchAndCacheMultiple,
    removeFromCache,
    loading,
    errors
  };
} 