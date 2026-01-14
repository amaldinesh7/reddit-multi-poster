import type { NextApiRequest, NextApiResponse } from 'next';
import { getIdentity, listMySubreddits, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  const supabaseUserId = req.cookies['supabase_user_id'];
  
  if (!access && !refresh) return res.status(401).json({ authenticated: false });

  let token = access;
  try {
    let client = token ? redditClient(token) : undefined as ReturnType<typeof redditClient> | undefined;
    try {
      if (!client && refresh) {
        const t = await refreshAccessToken(refresh);
        token = t.access_token;
        res.setHeader('Set-Cookie', serialize('reddit_access', token, { 
          path: '/', 
          httpOnly: true, 
          sameSite: 'lax', 
          secure: process.env.NODE_ENV === 'production',
          maxAge: t.expires_in - 10 
        }));
        client = redditClient(token);
      }
      if (!client) return res.status(401).json({ authenticated: false });
      const me = await getIdentity(client);
      
      // Only fetch subreddits if explicitly requested (for settings page, etc.)
      const fetchSubs = req.query.include_subs === 'true';
      const subs = fetchSubs ? await listMySubreddits(client) : [];
      
      return res.status(200).json({ 
        authenticated: true, 
        me, 
        subs,
        userId: supabaseUserId || null,
      });
    } catch (e: unknown) {
      if (refresh) {
        const t = await refreshAccessToken(refresh);
        token = t.access_token;
        res.setHeader('Set-Cookie', serialize('reddit_access', token, { 
          path: '/', 
          httpOnly: true, 
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: t.expires_in - 10 
        }));
        const client2 = redditClient(token);
        const me = await getIdentity(client2);
        
        // Only fetch subreddits if explicitly requested
        const fetchSubs = req.query.include_subs === 'true';
        const subs = fetchSubs ? await listMySubreddits(client2) : [];
        
        return res.status(200).json({ 
          authenticated: true, 
          me, 
          subs,
          userId: supabaseUserId || null,
        });
      }
      throw e;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    return res.status(500).json({ error: msg });
  }
}
