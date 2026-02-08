import { FlairOption, SubredditRules, PostRequirements, SubredditSettings } from '../utils/reddit';
import { ParsedRequirements } from '../lib/parseSubredditRequirements';

export interface SubredditItem {
  id: string;
  subreddit_name: string;
  display_name?: string | null;
  position: number;
  created_at: string;
  category_id: string;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
  user_subreddits: SubredditItem[];
}

export interface SubredditData {
  categories: Category[];
}

export interface TitleTag {
  tag: string;
  label: string;
  required: boolean;
}

/**
 * Unified subreddit data structure for localStorage caching.
 * Contains ALL data needed for a subreddit (settings + user status + content).
 * This is the single source of truth for client-side subreddit data.
 */
export interface UnifiedSubredditData {
  // Identification
  subreddit: string;
  
  // Flair data
  flairs: FlairOption[];
  flairRequired: boolean;
  
  // Rules and requirements
  rules: SubredditRules;
  titleTags: TitleTag[];
  postRequirements?: PostRequirements;
  parsedRequirements?: ParsedRequirements;
  
  // Subreddit settings (non-user-specific)
  subredditType: 'public' | 'private' | 'restricted' | 'gold_restricted' | 'archived' | 'user';
  restrictPosting: boolean;
  submissionType: 'any' | 'link' | 'self';
  allowImages: boolean;
  allowVideos: boolean;
  allowGifs: boolean;
  
  // User-specific status - ONLY present if Reddit explicitly returns it
  // IMPORTANT: Do NOT default these to false - only include if Reddit returns the field
  userIsBanned?: boolean;
  userIsContributor?: boolean;  // Only present when Reddit explicitly returns user_is_contributor
  userIsSubscriber?: boolean;
  userIsModerator?: boolean;
  
  // Cache metadata
  cachedAt: string;
  cacheVersion: number;
}

/**
 * @deprecated Use UnifiedSubredditData instead. Kept for backwards compatibility.
 */
export interface CachedSubredditData {
  subreddit_name: string;
  flairs: FlairOption[];
  flair_required: boolean;
  flairRequired: boolean; // Alias for backwards compatibility
  rules: SubredditRules;
  title_tags: TitleTag[];
  post_requirements?: PostRequirements;
  // Now stores only SubredditSettings (non-user-specific data)
  // User-specific data (userIsBanned, userIsContributor, etc.) is fetched separately
  eligibility?: SubredditSettings;
  parsed_requirements?: ParsedRequirements;
  cached: boolean;
  stale?: boolean;
  cached_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
