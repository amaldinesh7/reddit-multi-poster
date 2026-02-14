import type { NextApiRequest, NextApiResponse } from 'next';
import { redditClient, refreshAccessToken, getIdentity, getUserSubmissions } from '../../../utils/reddit';

interface ApiResponse {
  success: boolean;
  data?: {
    titles: string[];
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API endpoint to fetch user's recent Reddit post titles
 * GET /api/user/reddit-posts?limit=10
 * Returns: { success: true, data: { titles: string[] } }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
    });
  }

  const limit = Math.min(Number(req.query.limit) || 10, 25);

  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];

  if (!access && !refresh) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  try {
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

    // Get current user's username
    const identity = await getIdentity(client);
    const submissions = await getUserSubmissions(client, identity.name, limit);

    return res.status(200).json({
      success: true,
      data: {
        titles: submissions.map((s) => s.title),
      },
    });
  } catch (error) {
    console.error('Reddit posts API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
