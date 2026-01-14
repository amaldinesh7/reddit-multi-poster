export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          reddit_id: string;
          reddit_username: string;
          reddit_avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reddit_id: string;
          reddit_username: string;
          reddit_avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reddit_id?: string;
          reddit_username?: string;
          reddit_avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: number;
          collapsed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          position?: number;
          collapsed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          position?: number;
          collapsed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_subreddits: {
        Row: {
          id: string;
          category_id: string;
          subreddit_name: string;
          display_name: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          subreddit_name: string;
          display_name?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          subreddit_name?: string;
          display_name?: string | null;
          position?: number;
          created_at?: string;
        };
      };
      subreddit_cache: {
        Row: {
          subreddit_name: string;
          flairs: Json;
          flair_required: boolean;
          rules: Json;
          title_tags: Json;
          subscribers: number | null;
          over_18: boolean;
          cached_at: string;
          cache_version: number;
        };
        Insert: {
          subreddit_name: string;
          flairs?: Json;
          flair_required?: boolean;
          rules?: Json;
          title_tags?: Json;
          subscribers?: number | null;
          over_18?: boolean;
          cached_at?: string;
          cache_version?: number;
        };
        Update: {
          subreddit_name?: string;
          flairs?: Json;
          flair_required?: boolean;
          rules?: Json;
          title_tags?: Json;
          subscribers?: number | null;
          over_18?: boolean;
          cached_at?: string;
          cache_version?: number;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier use
export type User = Database['public']['Tables']['users']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type UserSubreddit = Database['public']['Tables']['user_subreddits']['Row'];
export type SubredditCache = Database['public']['Tables']['subreddit_cache']['Row'];

// Extended types with relations
export interface CategoryWithSubreddits extends Category {
  user_subreddits: UserSubreddit[];
}
