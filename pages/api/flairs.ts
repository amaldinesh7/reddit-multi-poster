import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { getFlairs, getPostRequirements, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';
import { addApiBreadcrumb, handleRedditApiError } from '../../lib/apiErrorHandler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const { subreddit } = req.query as { subreddit?: string };
  if (!subreddit) return res.status(400).json({ error: 'Missing subreddit' });
  
  let access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  
  try {
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
    
    if (!access) return res.status(401).json({ error: 'Unauthorized' });
    
    const client = redditClient(access);
    
    // Fetch flairs and post requirements in parallel
    const [flairsResult, postRequirements] = await Promise.all([
      getFlairs(client, subreddit),
      getPostRequirements(client, subreddit).catch(() => ({})),
    ]);
    
    // Use is_flair_required from post_requirements as the authoritative source
    const required = postRequirements.is_flair_required === true;
    
    addApiBreadcrumb('Flairs fetched', { subreddit, flairCount: flairsResult.flairs.length, required });
    
    res.status(200).json({ 
      flairs: flairsResult.flairs, 
      required,
      subreddit: subreddit.toLowerCase(),
      fetchedAt: Date.now()
    });
  } catch (e: unknown) {
    return handleRedditApiError(req, res, e, 'getFlairs');
  }
} 