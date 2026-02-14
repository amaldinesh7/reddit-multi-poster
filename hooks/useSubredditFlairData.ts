import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useSubreddits } from './useSubreddits';
import { useLocalSubredditCache } from './useLocalSubredditCache';
import { PostRequirements, SubredditEligibility } from '../utils/reddit';
import { TitleTag, UnifiedSubredditData } from '../types/api';
import { ParsedRequirements } from '../lib/parseSubredditRequirements';
import { normalizeSubredditKey } from '@/lib/subredditKey';

// Stable empty array to prevent re-renders when no options provided
const EMPTY_ARRAY: string[] = [];

export interface SubredditRulesData {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  titleTags?: TitleTag[];
  submitText?: string;
}

interface UseSubredditFlairDataOptions {
  /** Subreddits that should be fetched immediately (e.g., selected or visible) */
  eagerSubreddits?: string[];
  /** Fetch every known subreddit on mount (previous default). Default: true */
  loadAllOnMount?: boolean;
  /** 
   * Subreddits to auto-fetch data for.
   * Pass selected subreddits here to ensure they have fresh data.
   */
  selectedSubreddits?: string[];
}

interface UseSubredditFlairDataReturn {
  allSubreddits: string[];
  categorizedSubreddits: { categoryName: string; subreddits: string[] }[];
  flairOptions: Record<string, { id: string; text: string }[]>;
  flairRequired: Record<string, boolean>;
  subredditRules: Record<string, SubredditRulesData>;
  postRequirements: Record<string, PostRequirements>;
  /** Combined eligibility data built from UnifiedSubredditData */
  eligibilityData: Record<string, SubredditEligibility>;
  parsedRequirements: Record<string, ParsedRequirements>;
  isLoaded: boolean;
  isInitialLoad: boolean;
  cacheLoading: Record<string, boolean>;
  reloadSelectedData: (selected: string[]) => Promise<void>;
  isReloading: boolean;
  refreshSubreddits: () => Promise<void>;
  addSubreddit: (categoryId: string, subredditName: string) => Promise<{ id: string; subreddit_name: string; display_name?: string | null; category_id: string; position: number } | null>;
}

/**
 * Convert UnifiedSubredditData to SubredditEligibility format
 * 
 * IMPORTANT: userIsContributor is ONLY included if it exists in the source data.
 * We NEVER default it to false - the key should not exist if Reddit didn't return it.
 */
function toEligibilityData(data: UnifiedSubredditData): SubredditEligibility {
  const eligibility: SubredditEligibility = {
    subreddit: data.subreddit,
    subredditType: data.subredditType,
    restrictPosting: data.restrictPosting,
    submissionType: data.submissionType,
    allowImages: data.allowImages,
    allowVideos: data.allowVideos,
    allowGifs: data.allowGifs,
    userIsBanned: data.userIsBanned ?? false,
    userIsSubscriber: data.userIsSubscriber ?? false,
    userIsModerator: data.userIsModerator ?? false,
  };

  // CRITICAL: Only add userIsContributor if it exists in the source data
  // This field should NOT exist if Reddit didn't explicitly return it
  if (data.userIsContributor !== undefined) {
    eligibility.userIsContributor = data.userIsContributor;
  }

  return eligibility;
}

export const useSubredditFlairData = (options: UseSubredditFlairDataOptions = {}): UseSubredditFlairDataReturn => {
  const { 
    eagerSubreddits = EMPTY_ARRAY, 
    loadAllOnMount = true, 
    selectedSubreddits = EMPTY_ARRAY 
  } = options;
  const { getSubredditsByCategory, getAllSubreddits, isLoaded, refresh, addSubreddit } = useSubreddits();
  const localCache = useLocalSubredditCache();

  // State for derived data
  const [flairOptions, setFlairOptions] = useState<Record<string, { id: string; text: string }[]>>({});
  const [flairRequired, setFlairRequired] = useState<Record<string, boolean>>({});
  const [subredditRules, setSubredditRules] = useState<Record<string, SubredditRulesData>>({});
  const [postRequirements, setPostRequirements] = useState<Record<string, PostRequirements>>({});
  const [eligibilityData, setEligibilityData] = useState<Record<string, SubredditEligibility>>({});
  const [parsedRequirements, setParsedRequirements] = useState<Record<string, ParsedRequirements>>({});
  const [cacheLoading, setCacheLoading] = useState<Record<string, boolean>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isReloading, setIsReloading] = useState(false);

  const allSubreddits = useMemo(() => getAllSubreddits(), [getAllSubreddits]);
  const categorizedSubreddits = useMemo(() => getSubredditsByCategory(), [getSubredditsByCategory]);

  // Track which subreddits we've already started loading to prevent duplicate fetches
  const loadingStartedRef = useRef<Set<string>>(new Set());
  const migrationDoneRef = useRef(false);

  // Migrate from old sessionStorage on first mount
  useEffect(() => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    
    // Clear stale sessionStorage data that may have incorrect userIsContributor values
    localCache.migrateFromSessionStorage();
  }, [localCache]);

  /**
   * Fetch unified data for a subreddit from the new API endpoint
   */
  const fetchSubredditData = useCallback(async (
    subreddit: string, 
    force: boolean = false
  ): Promise<UnifiedSubredditData | null> => {
    const normalizedName = normalizeSubredditKey(subreddit);
    
    // Check localStorage cache first
    if (!force) {
      const cached = localCache.getCached(normalizedName);
      if (cached) {
        return cached;
      }
    }

    // Fetch from API
    try {
      const response = await fetch(`/api/reddit/subreddit-info?name=${encodeURIComponent(normalizedName)}`);
      const json = await response.json();

      if (!json.success || !json.data) {
        console.warn(`Failed to fetch data for r/${subreddit}:`, json.error);
        return null;
      }

      const data = json.data as UnifiedSubredditData;
      
      // Cache in localStorage
      localCache.setCached(normalizedName, data);
      
      return data;
    } catch (error) {
      console.error(`Error fetching data for r/${subreddit}:`, error);
      Sentry.addBreadcrumb({
        category: 'subreddit.fetch',
        message: `Failed to fetch unified data for ${subreddit}`,
        level: 'warning',
        data: { subreddit, error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return null;
    }
  }, [localCache]);

  /**
   * Process fetched data and update component state
   */
  const processData = useCallback((subreddit: string, data: UnifiedSubredditData) => {
    const key = normalizeSubredditKey(subreddit);

    setFlairOptions(prev => ({ ...prev, [key]: data.flairs }));
    setFlairRequired(prev => ({ ...prev, [key]: data.flairRequired }));
    
    // Safely handle missing rules data (can happen with old cached data or API errors)
    if (data.rules) {
      setSubredditRules(prev => ({ 
        ...prev, 
        [key]: {
          requiresGenderTag: data.rules.requiresGenderTag ?? false,
          requiresContentTag: data.rules.requiresContentTag ?? false,
          genderTags: data.rules.genderTags ?? [],
          contentTags: data.rules.contentTags ?? [],
          titleTags: data.titleTags,
          submitText: data.rules.submitText,
        }
      }));
    }
    
    if (data.postRequirements) {
      setPostRequirements(prev => ({ ...prev, [key]: data.postRequirements! }));
    }
    
    // Build eligibility data from unified data
    setEligibilityData(prev => ({ ...prev, [key]: toEligibilityData(data) }));
    
    if (data.parsedRequirements) {
      setParsedRequirements(prev => ({ ...prev, [key]: data.parsedRequirements! }));
    }
  }, []);

  /**
   * Load data for a list of subreddits (from cache or fetch)
   */
  const loadFlairData = useCallback(async (subredditsToLoad: string[]) => {
    const normalizedTargets = Array.from(
      new Set(subredditsToLoad.map((name) => normalizeSubredditKey(name)).filter(Boolean))
    );
    if (normalizedTargets.length === 0) return;

    // First, load from localStorage cache
    const cachedBatch = localCache.getCachedBatch(normalizedTargets);
    
    // Process cached data immediately
    cachedBatch.forEach((data, subreddit) => {
      processData(subreddit, data);
    });

    // Find subreddits that need fetching
    const needsFetching = normalizedTargets.filter(name => {
      return !cachedBatch.has(name) && !loadingStartedRef.current.has(name);
    });

    if (needsFetching.length === 0) {
      return;
    }

    // Mark as loading
    needsFetching.forEach(name => loadingStartedRef.current.add(name));
    
    const loadingUpdate: Record<string, boolean> = {};
    needsFetching.forEach(name => { loadingUpdate[name] = true; });
    setCacheLoading(prev => ({ ...prev, ...loadingUpdate }));

    // Fetch in batches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < needsFetching.length; i += batchSize) {
      const batch = needsFetching.slice(i, i + batchSize);

      const batchPromises = batch.map(async (subreddit) => {
        try {
          const data = await fetchSubredditData(subreddit);
          return { subreddit, data };
        } catch (error) {
          Sentry.addBreadcrumb({
            category: 'subreddit.cache',
            message: `Failed to fetch data for ${subreddit}`,
            level: 'warning',
            data: { subreddit },
          });
          return { subreddit, data: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Process batch results
      batchResults.forEach(({ subreddit, data }) => {
        if (data) {
          processData(subreddit, data);
        }
      });

      // Clear loading state for this batch
      const loadingClear: Record<string, boolean> = {};
      batch.forEach(name => { loadingClear[name] = false; });
      setCacheLoading(prev => ({ ...prev, ...loadingClear }));

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < needsFetching.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [localCache, fetchSubredditData, processData]);

  // Initial load effect
  useEffect(() => {
    if (!isLoaded) return;

    const initialTargets = loadAllOnMount 
      ? allSubreddits 
      : Array.from(new Set([...(eagerSubreddits || [])]));
    
    loadFlairData(initialTargets).finally(() => setIsInitialLoad(false));

    // Load remaining subreddits in the background
    if (!loadAllOnMount) {
      const remaining = allSubreddits.filter(
        (name) => !initialTargets.includes(name)
      );
      if (remaining.length > 0) {
        const run = () => loadFlairData(remaining);
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
        } else {
          setTimeout(run, 500);
        }
      }
    }
  }, [isLoaded, allSubreddits, eagerSubreddits, loadAllOnMount, loadFlairData]);

  // Auto-fetch selected subreddits when they change
  const previousSelectedRef = useRef<string[]>([]);
  
  useEffect(() => {
    if (selectedSubreddits.length === 0 || !isLoaded) return;

    const selectedCanonical = Array.from(
      new Set(selectedSubreddits.map((subreddit) => normalizeSubredditKey(subreddit)).filter(Boolean))
    );
    
    // Find newly selected subreddits that aren't in cache
    const newlySelected = selectedCanonical.filter(sub => {
      return !localCache.hasFreshCache(sub);
    });
    
    // Check if we have new selections
    const hasNewSelections = selectedCanonical.some(
      sub => !previousSelectedRef.current.includes(sub)
    );
    
    previousSelectedRef.current = selectedCanonical;
    
    if (newlySelected.length > 0 && hasNewSelections) {
      // Debounce slightly to avoid rapid-fire requests during multi-select
      const timeoutId = setTimeout(() => {
        loadFlairData(newlySelected).catch(err => {
          Sentry.addBreadcrumb({
            category: 'subreddit.selected',
            message: 'Failed to auto-fetch selected subreddit data',
            level: 'warning',
            data: { subreddits: newlySelected },
          });
        });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedSubreddits, isLoaded, localCache, loadFlairData]);

  // Reload flair data for selected subreddits (force refresh)
  const reloadSelectedData = useCallback(async (selected: string[]) => {
    const selectedCanonical = Array.from(
      new Set(selected.map((subreddit) => normalizeSubredditKey(subreddit)).filter(Boolean))
    );
    if (selectedCanonical.length === 0 || isReloading) return;

    setIsReloading(true);

    try {
      const batchSize = 3;
      for (let i = 0; i < selectedCanonical.length; i += batchSize) {
        const batch = selectedCanonical.slice(i, i + batchSize);

        const batchPromises = batch.map(async (subreddit) => {
          try {
            const data = await fetchSubredditData(subreddit, true); // force refresh
            return { subreddit, data };
          } catch (error) {
            Sentry.addBreadcrumb({
              category: 'subreddit.reload',
              message: `Failed to reload data for ${subreddit}`,
              level: 'warning',
              data: { subreddit },
            });
            return { subreddit, data: null };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(({ subreddit, data }) => {
          if (data) {
            processData(subreddit, data);
          }
        });

        if (i + batchSize < selectedCanonical.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      setIsReloading(false);
    }
  }, [isReloading, fetchSubredditData, processData]);

  return {
    allSubreddits,
    categorizedSubreddits,
    flairOptions,
    flairRequired,
    subredditRules,
    postRequirements,
    eligibilityData,
    parsedRequirements,
    isLoaded,
    isInitialLoad,
    cacheLoading,
    reloadSelectedData,
    isReloading,
    refreshSubreddits: refresh,
    addSubreddit,
  };
};
