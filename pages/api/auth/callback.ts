import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { exchangeCodeForToken, redditClient, getIdentity } from '../../../utils/reddit';
import { upsertUser, getUserByRedditId } from '../../../lib/supabase';
import { serialize } from 'cookie';
import { applyRateLimit, authRateLimit } from '../../../lib/rateLimit';
import { trackServerEvent, identifyServerUser } from '../../../lib/posthog-server';

const isProduction = process.env.NODE_ENV === 'production';

// Helper to add OAuth breadcrumbs
const addOAuthBreadcrumb = (message: string, data?: Record<string, unknown>, level: Sentry.SeverityLevel = 'info') => {
  Sentry.addBreadcrumb({
    category: 'auth.oauth',
    message,
    level,
    data,
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  // Apply rate limiting to prevent auth abuse
  if (!applyRateLimit(req, res, authRateLimit)) {
    return; // Response already sent by applyRateLimit
  }
  
  addOAuthBreadcrumb('OAuth callback started');
  const { code, state, error: redditError } = req.query as { code?: string; state?: string; error?: string };
  
  // Handle OAuth errors from Reddit
  if (redditError) {
    addOAuthBreadcrumb('OAuth error from Reddit', { error: redditError }, 'warning');
    return res.redirect(302, `/login?error=${encodeURIComponent(redditError)}`);
  }
  
  const expected = req.cookies['reddit_oauth_state'];
  addOAuthBreadcrumb('State validation', { 
    hasState: !!state, 
    hasExpected: !!expected, 
    hasCode: !!code,
  });
  
  if (!code) {
    addOAuthBreadcrumb('Missing code in callback', undefined, 'warning');
    return res.redirect(302, '/login?error=missing_code');
  }
  
  if (!state) {
    addOAuthBreadcrumb('Missing state in callback', undefined, 'warning');
    return res.redirect(302, '/login?error=missing_state');
  }
  
  // Strict state validation in production
  if (isProduction) {
    if (!expected || state !== expected) {
      addOAuthBreadcrumb('OAuth state mismatch', { stateMatch: false }, 'warning');
      return res.redirect(302, '/login?error=invalid_state');
    }
  }

  try {
    // 1. Exchange code for tokens
    addOAuthBreadcrumb('Exchanging code for token');
    const token = await exchangeCodeForToken(code);
    
    if (!token.access_token) {
      throw new Error('Failed to obtain access token from Reddit');
    }
    addOAuthBreadcrumb('Token obtained', { expiresIn: token.expires_in });
    
    // 2. Get user identity from Reddit
    addOAuthBreadcrumb('Fetching user identity');
    const client = redditClient(token.access_token);
    const redditUser = await getIdentity(client);
    
    if (!redditUser || !redditUser.id) {
      throw new Error('Failed to fetch user identity from Reddit');
    }
    addOAuthBreadcrumb('User identity fetched', { username: redditUser.name });
    
    // Set Sentry user context
    Sentry.setUser({ id: redditUser.id, username: redditUser.name });
    
    // 3. Check if this is a new user (for analytics)
    let isNewUser = false;
    try {
      const existingUser = await getUserByRedditId(redditUser.id);
      isNewUser = !existingUser;
    } catch {
      // Don't block auth if this check fails
    }
    
    // 4. Sync user to Supabase
    addOAuthBreadcrumb('Syncing user to Supabase');
    let userId: string | undefined;
    try {
      const supabaseUser = await upsertUser({
        reddit_id: redditUser.id,
        reddit_username: redditUser.name,
        reddit_avatar_url: redditUser.icon_img,
      });
      userId = supabaseUser.id;
      addOAuthBreadcrumb('User synced to Supabase', { userId });
      
      // Track signup or login completion for funnel analytics
      if (userId) {
        // Identify the user in PostHog
        identifyServerUser(userId, {
          reddit_username: redditUser.name,
          created_at: supabaseUser.created_at,
        });
        
        // Track the appropriate event
        if (isNewUser) {
          trackServerEvent(userId, 'signup_completed', {
            reddit_username: redditUser.name,
            is_new_user: true,
          });
        } else {
          trackServerEvent(userId, 'login_completed', {
            reddit_username: redditUser.name,
            is_new_user: false,
          });
        }
      }
    } catch (supabaseError) {
      // Log but don't fail - user can still use the app without Supabase features
      addOAuthBreadcrumb('Failed to sync user to Supabase', undefined, 'warning');
      Sentry.captureException(supabaseError, {
        level: 'warning',
        tags: { component: 'auth.callback', step: 'supabase_sync' },
      });
    }
    
    // 5. Set cookies
    addOAuthBreadcrumb('Setting cookies');
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
            maxAge: 60 * 60 * 24 * 7, // 7 days
          })
        : '',
      userId
        ? serialize('supabase_user_id', userId, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 7, // 7 days
          })
        : '',
      serialize('reddit_oauth_state', '', { path: '/', maxAge: 0 }),
    ].filter(Boolean) as string[];
    
    res.setHeader('Set-Cookie', cookies);
    addOAuthBreadcrumb('OAuth callback completed successfully');
    res.redirect(302, '/');
  } catch (e) {
    // Capture error to Sentry with full context
    Sentry.captureException(e, {
      tags: { component: 'auth.callback' },
      extra: {
        hasCode: !!code,
        hasState: !!state,
      },
    });
    
    const errorMsg = e instanceof Error ? e.message : 'Authentication failed';
    res.redirect(302, `/login?error=${encodeURIComponent(errorMsg)}`);
  }
}
