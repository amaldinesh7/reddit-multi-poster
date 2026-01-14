import { Category, SubredditItem } from '../../types/api';

export interface SettingsContextType {
  addSubreddit: (categoryId: string, name: string) => Promise<SubredditItem | null>;
  updateCategory: (categoryId: string, updates: { name?: string; collapsed?: boolean }) => Promise<boolean>;
  deleteCategory: (categoryId: string) => Promise<boolean>;
  updateSubreddit: (subredditId: string, updates: { subreddit_name?: string; category_id?: string }) => Promise<boolean>;
  deleteSubreddit: (subredditId: string) => Promise<boolean>;
  fetchAndCache: (name: string) => Promise<unknown>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  dragOverCategoryId: string | null;
}

export type { Category, SubredditItem };
