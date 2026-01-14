import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertUser } from './supabase';
import { redditClient, getIdentity, refreshAccessToken } from '../utils/reddit';
import { serialize } from 'cookie';

/**
 * Get or create user ID from request.
 * First tries the supabase_user_id cookie.
 * Falls back to fetching from Reddit and syncing to Supabase.
 * Sets the cookie for future requests if missing.
 */
export async function getUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  // First try the cookie
  let userId = req.cookies['supabase_user_id'];
  if (userId) return userId;
  
  // Fallback: try to get user from Reddit token and sync to Supabase
  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  
  if (!access && !refresh) return null;
  
  try {
    let token = access;
    
    // Try to refresh if no access token
    if (!token && refresh) {
      const t = await refreshAccessToken(refresh);
      token = t.access_token;
      // Set the new access token cookie
      res.setHeader('Set-Cookie', serialize('reddit_access', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: t.expires_in - 10,
      }));
    }
    
    if (!token) return null;
    
    const client = redditClient(token);
    const redditUser = await getIdentity(client);
    
    // Sync to Supabase and get user ID
    const supabaseUser = await upsertUser({
      reddit_id: redditUser.id,
      reddit_username: redditUser.name,
      reddit_avatar_url: redditUser.icon_img,
    });
    
    userId = supabaseUser.id;
    
    // Set the cookie for future requests
    res.appendHeader('Set-Cookie', serialize('supabase_user_id', userId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    }));
    
    return userId;
  } catch (error) {
    console.error('Failed to get user ID from Reddit token:', error);
    return null;
  }
}
