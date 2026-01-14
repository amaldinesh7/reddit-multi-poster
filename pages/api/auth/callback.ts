import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCodeForToken, redditClient, getIdentity } from '../../../utils/reddit';
import { upsertUser } from '../../../lib/supabase';
import { serialize } from 'cookie';

const isProduction = process.env.NODE_ENV === 'production';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  
  // Handle OAuth errors from Reddit
  if (error) {
    console.error('OAuth error from Reddit:', error);
    return res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
  }
  
  const expected = req.cookies['reddit_oauth_state'];
  
  if (!code) {
    return res.redirect(302, '/login?error=missing_code');
  }
  
  if (!state) {
    return res.redirect(302, '/login?error=missing_state');
  }
  
  // Strict state validation in production
  if (isProduction) {
    if (!expected || state !== expected) {
      console.error('OAuth state mismatch', { state, expected });
      return res.redirect(302, '/login?error=invalid_state');
    }
  } else {
    // Development: warn but proceed
    if (!expected) {
      console.warn('Missing state cookie in development');
    } else if (state !== expected) {
      console.warn(`State mismatch in development: Got ${state}, Expected ${expected}`);
    }
  }

  try {
    // Exchange code for tokens
    const token = await exchangeCodeForToken(code);
    
    // Get user identity from Reddit
    const client = redditClient(token.access_token);
    const redditUser = await getIdentity(client);
    
    // Sync user to Supabase
    let userId: string | undefined;
    try {
      const supabaseUser = await upsertUser({
        reddit_id: redditUser.id,
        reddit_username: redditUser.name,
        reddit_avatar_url: redditUser.icon_img,
      });
      userId = supabaseUser.id;
      console.log('User synced to Supabase:', { userId, redditUsername: redditUser.name });
    } catch (supabaseError) {
      // Log but don't fail - user can still use the app without Supabase
      console.error('Failed to sync user to Supabase:', supabaseError);
    }
    
    // Set cookies with proper security settings
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
    };
    
    const cookies = [
      serialize('reddit_access', token.access_token, {
        ...cookieOptions,
        maxAge: token.expires_in - 10,
      }),
      token.refresh_token
        ? serialize('reddit_refresh', token.refresh_token, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 30, // 30 days
          })
        : '',
      // Store Supabase user ID in cookie for API routes
      userId
        ? serialize('supabase_user_id', userId, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 30, // 30 days
          })
        : '',
      // Clear the OAuth state cookie
      serialize('reddit_oauth_state', '', { path: '/', maxAge: 0 }),
    ].filter(Boolean) as string[];
    
    res.setHeader('Set-Cookie', cookies);
    res.redirect(302, '/');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Auth error';
    console.error('OAuth callback error:', msg);
    res.redirect(302, `/login?error=${encodeURIComponent(msg)}`);
  }
}
