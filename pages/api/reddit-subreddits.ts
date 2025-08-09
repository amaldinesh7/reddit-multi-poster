import type { NextApiRequest, NextApiResponse } from 'next';
import { listMySubreddits, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';

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
    
    return res.status(200).json({ subreddits: subs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error fetching subreddits';
    return res.status(500).json({ error: msg });
  }
} 