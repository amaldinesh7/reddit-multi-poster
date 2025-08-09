import type { NextApiRequest, NextApiResponse } from 'next';
import { getFlairs, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { subreddit } = req.query as { subreddit?: string };
  if (!subreddit) return res.status(400).json({ error: 'Missing subreddit' });
  let access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  try {
    if (!access && refresh) {
      const t = await refreshAccessToken(refresh);
      access = t.access_token;
      res.setHeader('Set-Cookie', serialize('reddit_access', access, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: t.expires_in - 10 }));
    }
    if (!access) return res.status(401).json({ error: 'Unauthorized' });
    const client = redditClient(access);
    const { flairs, required } = await getFlairs(client, subreddit);
    res.status(200).json({ flairs, required });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(500).json({ error: msg });
  }
} 