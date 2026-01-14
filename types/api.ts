import { FlairOption, SubredditRules, PostRequirements } from '../utils/reddit';

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

export interface CachedSubredditData {
  subreddit_name: string;
  flairs: FlairOption[];
  flair_required: boolean;
  flairRequired: boolean; // Alias for backwards compatibility
  rules: SubredditRules;
  title_tags: TitleTag[];
  post_requirements?: PostRequirements;
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
