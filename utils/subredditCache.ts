export interface FlairOption {
  id: string;
  text: string;
}

export interface TitleTag {
  tag: string;      // The actual tag text e.g., "(f)", "[OC]", "25F"
  label: string;    // Human readable label e.g., "Female", "Original Content"
  required: boolean;
}

export interface SubredditRules {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  submitText?: string;  // Raw submit text from Reddit
  titleTags?: TitleTag[]; // AI-parsed title tags
}

export interface CachedSubredditData {
  flairs: FlairOption[];
  flairRequired: boolean;
  rules: SubredditRules;
  lastFetched: number;
  version: number;
}

interface SubredditCache {
  [subredditName: string]: CachedSubredditData;
}

const CACHE_KEY = 'reddit-multi-poster-subreddit-cache';
const CACHE_VERSION = 2; // Bumped for new titleTags field
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

// Get cache expiry time in milliseconds
const getCacheExpiryTime = () => CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

// Load cache from localStorage
export function loadSubredditCache(): SubredditCache {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return {};
    
    const cache = JSON.parse(stored) as SubredditCache;
    
    // Filter out expired or old version entries
    const now = Date.now();
    const validCache: SubredditCache = {};
    
    Object.entries(cache).forEach(([subreddit, data]) => {
      if (
        data.version === CACHE_VERSION &&
        (now - data.lastFetched) < getCacheExpiryTime()
      ) {
        validCache[subreddit] = data;
      }
    });
    
    return validCache;
  } catch (e) {
    console.error('Failed to load subreddit cache:', e);
    return {};
  }
}

// Save cache to localStorage
export function saveSubredditCache(cache: SubredditCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save subreddit cache:', e);
  }
}

// Get cached data for a specific subreddit
export function getCachedSubredditData(subredditName: string): CachedSubredditData | null {
  const cache = loadSubredditCache();
  return cache[subredditName.toLowerCase()] || null;
}

// Cache data for a specific subreddit
export function cacheSubredditData(
  subredditName: string,
  flairs: FlairOption[],
  flairRequired: boolean,
  rules: SubredditRules
): void {
  const cache = loadSubredditCache();
  
  cache[subredditName.toLowerCase()] = {
    flairs,
    flairRequired,
    rules,
    lastFetched: Date.now(),
    version: CACHE_VERSION
  };
  
  saveSubredditCache(cache);
}

// Check if subreddit data is cached and valid
export function isSubredditDataCached(subredditName: string): boolean {
  const cachedData = getCachedSubredditData(subredditName);
  return cachedData !== null;
}

// Get multiple cached subreddits
export function getCachedSubredditsData(subredditNames: string[]): Record<string, CachedSubredditData> {
  const cache = loadSubredditCache();
  const result: Record<string, CachedSubredditData> = {};
  
  subredditNames.forEach(name => {
    const cached = cache[name.toLowerCase()];
    if (cached) {
      result[name] = cached;
    }
  });
  
  return result;
}

// Remove cached data for a subreddit (useful when subreddit is removed)
export function removeCachedSubredditData(subredditName: string): void {
  const cache = loadSubredditCache();
  delete cache[subredditName.toLowerCase()];
  saveSubredditCache(cache);
}

// Clear all cached data
export function clearSubredditCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.error('Failed to clear subreddit cache:', e);
  }
}

// Get cache statistics
export function getCacheStats(): { totalCached: number; oldestEntry: number | null; newestEntry: number | null } {
  const cache = loadSubredditCache();
  const entries = Object.values(cache);
  
  if (entries.length === 0) {
    return { totalCached: 0, oldestEntry: null, newestEntry: null };
  }
  
  const timestamps = entries.map(entry => entry.lastFetched);
  
  return {
    totalCached: entries.length,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps)
  };
} 