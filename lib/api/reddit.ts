import axios from 'axios';
import { PostRequirements } from '../../utils/reddit';
import { CachedSubredditData, ApiResponse } from '../../types/api';

export async function fetchSubredditRequirements(subreddit: string): Promise<Record<string, PostRequirements>> {
  const { data } = await axios.get<{ requirements: Record<string, PostRequirements> }>(`/api/subreddit-post-requirements`, {
    params: { subreddit }
  });
  return data.requirements;
}

export async function searchSubreddits(query: string, limit: number = 5): Promise<Array<{
  name: string;
  subscribers: number;
  over18: boolean;
  url: string;
}>> {
  if (!query.trim() || query.length < 2) return [];
  
  const { data } = await axios.get<{ subreddits: Array<{ name: string; subscribers: number; over18: boolean; url: string }> }>('/api/search-subreddits', {
    params: { q: query.trim(), limit }
  });
  
  return data.subreddits || [];
}

export async function fetchSubredditCache(subreddit: string, force: boolean = false): Promise<CachedSubredditData> {
  const normalizedName = subreddit.toLowerCase();
  
  const { data: response } = await axios.get<ApiResponse<CachedSubredditData>>(
    `/api/cache/subreddit/${normalizedName}`,
    { params: force ? { force: 'true' } : {} }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch subreddit data');
  }

  // Normalize data to include both formats for backwards compatibility
  return {
    ...response.data,
    flairRequired: response.data.flair_required, // Add alias
  };
}
