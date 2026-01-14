import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSubreddits } from './useSubreddits';
import { useSubredditCache } from './useSubredditCache';
import { PostRequirements } from '../utils/reddit';
import { TitleTag } from '../utils/subredditCache';

export interface SubredditRulesData {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  titleTags?: TitleTag[];
  submitText?: string;
}

interface UseSubredditFlairDataReturn {
  allSubreddits: string[];
  categorizedSubreddits: { categoryName: string; subreddits: string[] }[];
  flairOptions: Record<string, { id: string; text: string }[]>;
  flairRequired: Record<string, boolean>;
  subredditRules: Record<string, SubredditRulesData>;
  postRequirements: Record<string, PostRequirements>;
  isLoaded: boolean;
  isInitialLoad: boolean;
  cacheLoading: Record<string, boolean>;
  reloadSelectedData: (selected: string[]) => Promise<void>;
  isReloading: boolean;
  refreshSubreddits: () => Promise<void>;
  addSubreddit: (categoryId: string, subredditName: string) => Promise<{ id: string; subreddit_name: string; display_name?: string | null; category_id: string; position: number } | null>;
}

export const useSubredditFlairData = (): UseSubredditFlairDataReturn => {
  const { getSubredditsByCategory, getAllSubreddits, isLoaded, refresh, addSubreddit } = useSubreddits();
  const { getCachedData, fetchAndCache, loading: cacheLoading } = useSubredditCache();

  const [flairOptions, setFlairOptions] = useState<Record<string, { id: string; text: string }[]>>({});
  const [flairRequired, setFlairRequired] = useState<Record<string, boolean>>({});
  const [subredditRules, setSubredditRules] = useState<Record<string, SubredditRulesData>>({});
  const [postRequirements, setPostRequirements] = useState<Record<string, PostRequirements>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isReloading, setIsReloading] = useState(false);

  const allSubreddits = useMemo(() => getAllSubreddits(), [getAllSubreddits]);
  const categorizedSubreddits = useMemo(() => getSubredditsByCategory(), [getSubredditsByCategory]);

  // Store refs for functions that change frequently
  const getCachedDataRef = useRef(getCachedData);
  const fetchAndCacheRef = useRef(fetchAndCache);
  
  useEffect(() => {
    getCachedDataRef.current = getCachedData;
    fetchAndCacheRef.current = fetchAndCache;
  });

  // Track which subreddits we've already started loading to prevent duplicate fetches
  const loadingStartedRef = useRef<Set<string>>(new Set());

  // Load cached data and fetch missing data
  useEffect(() => {
    if (!isLoaded) return;

    const loadFlairData = async () => {
      const newFlairOptions: Record<string, { id: string; text: string }[]> = {};
      const newFlairRequired: Record<string, boolean> = {};
      const newSubredditRules: Record<string, SubredditRulesData> = {};
      const newPostRequirements: Record<string, PostRequirements> = {};

      for (const subreddit of allSubreddits) {
        const cached = getCachedDataRef.current(subreddit);
        if (cached) {
          newFlairOptions[subreddit] = cached.flairs;
          newFlairRequired[subreddit] = cached.flairRequired;
          newSubredditRules[subreddit] = cached.rules;
          if (cached.post_requirements) {
            newPostRequirements[subreddit] = cached.post_requirements;
          }
        }
      }

      if (Object.keys(newFlairOptions).length > 0) {
        setFlairOptions(prev => ({ ...prev, ...newFlairOptions }));
        setFlairRequired(prev => ({ ...prev, ...newFlairRequired }));
        setSubredditRules(prev => ({ ...prev, ...newSubredditRules }));
        setPostRequirements(prev => ({ ...prev, ...newPostRequirements }));
      }

      const needsFetching = allSubreddits.filter(name => 
        !getCachedDataRef.current(name) && !loadingStartedRef.current.has(name.toLowerCase())
      );

      if (needsFetching.length === 0) {
        setIsInitialLoad(false);
        return;
      }

      // Mark all as loading started
      needsFetching.forEach(name => loadingStartedRef.current.add(name.toLowerCase()));

      const batchSize = 3;
      for (let i = 0; i < needsFetching.length; i += batchSize) {
        const batch = needsFetching.slice(i, i + batchSize);

        const batchPromises = batch.map(async (subreddit) => {
          try {
            const cached = await fetchAndCacheRef.current(subreddit);
            return { subreddit, cached };
          } catch (error) {
            console.error(`Failed to fetch data for ${subreddit}:`, error);
            return {
              subreddit,
              cached: {
                flairs: [] as { id: string; text: string }[],
                flairRequired: false,
                rules: {
                  requiresGenderTag: false,
                  requiresContentTag: false,
                  genderTags: [] as string[],
                  contentTags: [] as string[]
                },
                post_requirements: undefined as PostRequirements | undefined,
                lastFetched: Date.now(),
                version: 1
              }
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        const batchFlairOptions: Record<string, { id: string; text: string }[]> = {};
        const batchFlairRequired: Record<string, boolean> = {};
        const batchSubredditRules: Record<string, SubredditRulesData> = {};
        const batchPostRequirements: Record<string, PostRequirements> = {};

        batchResults.forEach(({ subreddit, cached }) => {
          batchFlairOptions[subreddit] = cached.flairs;
          batchFlairRequired[subreddit] = cached.flairRequired;
          batchSubredditRules[subreddit] = cached.rules;
          if (cached.post_requirements) {
            batchPostRequirements[subreddit] = cached.post_requirements;
          }
        });

        setFlairOptions(prev => ({ ...prev, ...batchFlairOptions }));
        setFlairRequired(prev => ({ ...prev, ...batchFlairRequired }));
        setSubredditRules(prev => ({ ...prev, ...batchSubredditRules }));
        setPostRequirements(prev => ({ ...prev, ...batchPostRequirements }));

        if (i + batchSize < needsFetching.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setIsInitialLoad(false);
    };

    loadFlairData();
  }, [isLoaded, allSubreddits]);

  // Reload flair data for selected subreddits
  const reloadSelectedData = useCallback(async (selected: string[]) => {
    if (selected.length === 0 || isReloading) return;

    setIsReloading(true);

    try {
      const batchSize = 3;
      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);

        const batchPromises = batch.map(async (subreddit) => {
          try {
            const cached = await fetchAndCacheRef.current(subreddit, true);
            return { subreddit, cached };
          } catch (error) {
            console.error(`Failed to reload data for ${subreddit}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);

        const batchFlairOptions: Record<string, { id: string; text: string }[]> = {};
        const batchFlairRequired: Record<string, boolean> = {};
        const batchSubredditRules: Record<string, SubredditRulesData> = {};
        const batchPostRequirements: Record<string, PostRequirements> = {};

        batchResults.forEach((result) => {
          if (result) {
            batchFlairOptions[result.subreddit] = result.cached.flairs;
            batchFlairRequired[result.subreddit] = result.cached.flairRequired;
            batchSubredditRules[result.subreddit] = result.cached.rules;
            if (result.cached.post_requirements) {
              batchPostRequirements[result.subreddit] = result.cached.post_requirements;
            }
          }
        });

        setFlairOptions(prev => ({ ...prev, ...batchFlairOptions }));
        setFlairRequired(prev => ({ ...prev, ...batchFlairRequired }));
        setSubredditRules(prev => ({ ...prev, ...batchSubredditRules }));
        setPostRequirements(prev => ({ ...prev, ...batchPostRequirements }));

        if (i + batchSize < selected.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      setIsReloading(false);
    }
  }, [isReloading]);

  return {
    allSubreddits,
    categorizedSubreddits,
    flairOptions,
    flairRequired,
    subredditRules,
    postRequirements,
    isLoaded,
    isInitialLoad,
    cacheLoading,
    reloadSelectedData,
    isReloading,
    refreshSubreddits: refresh,
    addSubreddit,
  };
};
