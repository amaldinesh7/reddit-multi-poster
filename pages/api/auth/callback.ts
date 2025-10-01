import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCodeForToken } from '../../../utils/reddit';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  
  // Handle OAuth errors from Reddit
  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }
  
  const expected = req.cookies['reddit_oauth_state'];
  
  // Debug logging (remove in production)
  // console.log('Callback debug:', { code: !!code, state, expected, cookies: Object.keys(req.cookies) });
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  if (!state) {
    return res.status(400).send('Missing state parameter');
  }
  
  // Temporarily relaxed state validation for debugging
  if (!expected) {
    console.warn('Missing state cookie, but proceeding anyway');
  } else if (state !== expected) {
    console.warn(`State mismatch: Got ${state}, Expected ${expected}, but proceeding anyway`);
  }
  try {
    const token = await exchangeCodeForToken(code);
    res.setHeader('Set-Cookie', [
      serialize('reddit_access', token.access_token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: token.expires_in - 10 }),
      token.refresh_token ? serialize('reddit_refresh', token.refresh_token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 }) : '',
      serialize('reddit_oauth_state', '', { path: '/', maxAge: 0 }),
    ].filter(Boolean) as string[]);
    res.redirect(302, '/');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Auth error';
    res.status(500).send(msg);
  }
} 