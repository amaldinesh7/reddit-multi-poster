import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCodeForToken, redditClient, getIdentity } from '../../../utils/reddit';
import { upsertUser } from '../../../lib/supabase';
import { serialize } from 'cookie';

const isProduction = process.env.NODE_ENV === 'production';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  console.log('--- Reddit OAuth Callback Started ---');
  const { code, state, error: redditError } = req.query as { code?: string; state?: string; error?: string };
  
  // Handle OAuth errors from Reddit
  if (redditError) {
    console.error('OAuth error from Reddit:', redditError);
    return res.redirect(302, `/login?error=${encodeURIComponent(redditError)}`);
  }
  
  const expected = req.cookies['reddit_oauth_state'];
  console.log('OAuth State Debug:', { 
    receivedState: state, 
    expectedState: expected, 
    hasCode: !!code,
    isProduction 
  });
  
  if (!code) {
    console.error('Missing code in callback');
    return res.redirect(302, '/login?error=missing_code');
  }
  
  if (!state) {
    console.error('Missing state in callback');
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
    // 1. Exchange code for tokens
    console.log('Step 1: Exchanging code for token...');
    const token = await exchangeCodeForToken(code);
    
    if (!token.access_token) {
      console.error('No access token received from Reddit', token);
      throw new Error('Failed to obtain access token from Reddit');
    }
    console.log('Step 1 Success: Token obtained (expires in ' + token.expires_in + 's)');
    
    // 2. Get user identity from Reddit
    console.log('Step 2: Fetching user identity from Reddit...');
    const client = redditClient(token.access_token);
    const redditUser = await getIdentity(client);
    
    if (!redditUser || !redditUser.id) {
      console.error('Failed to fetch user identity', redditUser);
      throw new Error('Failed to fetch user identity from Reddit');
    }
    console.log('Step 2 Success: User identity fetched:', { name: redditUser.name, id: redditUser.id });
    
    // 3. Sync user to Supabase
    console.log('Step 3: Syncing user to Supabase...');
    let userId: string | undefined;
    try {
      const supabaseUser = await upsertUser({
        reddit_id: redditUser.id,
        reddit_username: redditUser.name,
        reddit_avatar_url: redditUser.icon_img,
      });
      userId = supabaseUser.id;
      console.log('Step 3 Success: User synced to Supabase:', { userId, redditUsername: redditUser.name });
    } catch (supabaseError) {
      // Log but don't fail - user can still use the app without Supabase features
      console.error('Step 3 Error: Failed to sync user to Supabase:', supabaseError);
    }
    
    // 4. Set cookies
    console.log('Step 4: Setting cookies and redirecting...');
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
      userId
        ? serialize('supabase_user_id', userId, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 30, // 30 days
          })
        : '',
      serialize('reddit_oauth_state', '', { path: '/', maxAge: 0 }),
    ].filter(Boolean) as string[];
    
    res.setHeader('Set-Cookie', cookies);
    console.log('Step 4 Success: Cookies set. Redirecting to home...');
    res.redirect(302, '/');
  } catch (e: any) {
    console.error('--- OAuth Callback Error ---');
    console.error('Error Details:', {
      message: e.message,
      stack: e.stack,
      name: e.name,
      code: e.code
    });
    
    const errorMsg = e instanceof Error ? e.message : 'Authentication failed';
    res.redirect(302, `/login?error=${encodeURIComponent(errorMsg)}`);
  }
}
