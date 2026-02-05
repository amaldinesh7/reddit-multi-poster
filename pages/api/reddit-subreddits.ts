import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { listMySubreddits, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';
import { addApiBreadcrumb, handleRedditApiError } from '../../lib/apiErrorHandler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  let access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  
  if (!access && !refresh) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Refresh token if needed
    if (!access && refresh) {
      addApiBreadcrumb('Refreshing access token');
      const t = await refreshAccessToken(refresh);
      access = t.access_token;
      res.setHeader('Set-Cookie', serialize('reddit_access', access, { 
        path: '/', 
        httpOnly: true, 
        sameSite: 'lax', 
        maxAge: t.expires_in - 10 
      }));
    }
    
    if (!access) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = redditClient(access);
    const subs = await listMySubreddits(client);
    
    addApiBreadcrumb('Subreddits fetched', { count: subs.length });
    
    return res.status(200).json({ subreddits: subs });
  } catch (e: unknown) {
    return handleRedditApiError(req, res, e, 'listMySubreddits');
  }
} 