import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserDetails, isAdmin } from '../../lib/apiAuth';
import { createServerSupabaseClient, type PostLog } from '../../lib/supabase';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsResponse {
  // Summary stats
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  successRate: number;
  
  // Time-based stats
  postsLast7Days: number;
  postsLast30Days: number;
  postsToday: number;
  
  // Top subreddits
  topSubreddits: Array<{
    subreddit: string;
    count: number;
    successRate: number;
  }>;
  
  // Posts by day (for chart)
  postsByDay: Array<{
    date: string;
    success: number;
    error: number;
  }>;
  
  // Recent posts
  recentPosts: Array<{
    id: string;
    subreddit: string;
    postKind: string;
    status: string;
    errorCode: string | null;
    redditUrl: string | null;
    createdAt: string;
  }>;
  
  // Per-user stats (for comparison)
  userStats?: {
    totalPosts: number;
    successfulPosts: number;
  };
  
  // Total unique users
  totalUsers: number;
}

// ============================================================================
// API Handler
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user details for admin check
  const { redditUsername } = await getUserDetails(req, res);
  
  if (!redditUsername) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  if (!isAdmin(redditUsername)) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  try {
    const client = createServerSupabaseClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all posts for stats
    const { data: allPosts, error: postsError } = await client
      .from('post_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (postsError) {
      throw postsError;
    }

    const posts = (allPosts || []) as PostLog[];

    // Calculate summary stats
    const totalPosts = posts.length;
    const successfulPosts = posts.filter(p => p.status === 'success').length;
    const failedPosts = posts.filter(p => p.status === 'error').length;
    const successRate = totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0;

    // Time-based stats
    const postsToday = posts.filter(p => new Date(p.created_at) >= today).length;
    const postsLast7Days = posts.filter(p => new Date(p.created_at) >= sevenDaysAgo).length;
    const postsLast30Days = posts.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length;

    // Top subreddits
    const subredditCounts = posts.reduce((acc, p) => {
      if (!acc[p.subreddit_name]) {
        acc[p.subreddit_name] = { total: 0, success: 0 };
      }
      acc[p.subreddit_name].total++;
      if (p.status === 'success') {
        acc[p.subreddit_name].success++;
      }
      return acc;
    }, {} as Record<string, { total: number; success: number }>);

    const topSubreddits = Object.entries(subredditCounts)
      .map(([subreddit, data]) => ({
        subreddit,
        count: data.total,
        successRate: Math.round((data.success / data.total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Posts by day (last 30 days)
    const postsByDayMap = new Map<string, { success: number; error: number }>();
    
    // Initialize all days in the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      postsByDayMap.set(dateStr, { success: 0, error: 0 });
    }

    // Fill in actual counts
    posts
      .filter(p => new Date(p.created_at) >= thirtyDaysAgo)
      .forEach(p => {
        const dateStr = new Date(p.created_at).toISOString().split('T')[0];
        const day = postsByDayMap.get(dateStr);
        if (day) {
          if (p.status === 'success') {
            day.success++;
          } else {
            day.error++;
          }
        }
      });

    const postsByDay = Array.from(postsByDayMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Recent posts (last 50)
    const recentPosts = posts.slice(0, 50).map(p => ({
      id: p.id,
      subreddit: p.subreddit_name,
      postKind: p.post_kind,
      status: p.status,
      errorCode: p.error_code,
      redditUrl: p.reddit_post_url,
      createdAt: p.created_at,
    }));

    // Count unique users
    const uniqueUsers = new Set(posts.map(p => p.user_id));
    const totalUsers = uniqueUsers.size;

    const response: AnalyticsResponse = {
      totalPosts,
      successfulPosts,
      failedPosts,
      successRate,
      postsToday,
      postsLast7Days,
      postsLast30Days,
      topSubreddits,
      postsByDay,
      recentPosts,
      totalUsers,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
