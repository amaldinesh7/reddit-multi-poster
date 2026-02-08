import type { NextApiRequest, NextApiResponse } from 'next';
import { redditClient, refreshAccessToken, getUserSubredditStatusBatch, UserSubredditStatus } from '../../../utils/reddit';

interface ApiResponse {
  success: boolean;
  data?: Record<string, UserSubredditStatus>;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API endpoint to fetch user-specific subreddit status
 * This returns per-user data (banned, subscriber, moderator, contributor status)
 * that should NOT be cached globally - it's specific to the authenticated user.
 * 
 * POST /api/user/subreddit-status
 * Body: { subreddits: string[] }
 * Returns: { success: true, data: Record<string, UserSubredditStatus> }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
    });
  }

  const { subreddits } = req.body;

  if (!subreddits || !Array.isArray(subreddits) || subreddits.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'subreddits array is required' },
    });
  }

  // Limit the number of subreddits per request to prevent abuse
  const MAX_SUBREDDITS = 50;
  if (subreddits.length > MAX_SUBREDDITS) {
    return res.status(400).json({
      success: false,
      error: { 
        code: 'TOO_MANY_SUBREDDITS', 
        message: `Maximum ${MAX_SUBREDDITS} subreddits per request` 
      },
    });
  }

  // Get Reddit access token from cookies
  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];

  if (!access && !refresh) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  try {
    // Get a valid Reddit client
    let token = access;
    if (!token && refresh) {
      const t = await refreshAccessToken(refresh);
      token = t.access_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Could not obtain Reddit access token' },
      });
    }

    const client = redditClient(token);

    // Fetch user status for all requested subreddits
    const statusData = await getUserSubredditStatusBatch(
      client, 
      subreddits,
      3,  // batch size
      300 // delay between batches in ms
    );

    return res.status(200).json({
      success: true,
      data: statusData,
    });
  } catch (error) {
    console.error('User subreddit status API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
