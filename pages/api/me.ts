import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { getIdentity, listMySubreddits, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';
import { getEntitlement, getLimits } from '../../lib/entitlement';
import { handleApiError, addApiBreadcrumb } from '../../lib/apiErrorHandler';

/** Normalize non-finite values for JSON serialization (Infinity becomes MAX_SAFE_INTEGER) */
const normalizeForJson = (value: number): number => 
  Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;

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
        addApiBreadcrumb('Refreshing access token');
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
      
      // Set Sentry user context
      if (me) {
        Sentry.setUser({ id: me.id, username: me.name });
      }
      
      // Only fetch subreddits if explicitly requested (for settings page, etc.)
      const fetchSubs = req.query.include_subs === 'true';
      const subs = fetchSubs ? await listMySubreddits(client) : [];
      
      const entitlement = supabaseUserId ? await getEntitlement(supabaseUserId) : 'free';
      const limits = getLimits(entitlement);

      return res.status(200).json({
        authenticated: true,
        me,
        subs,
        userId: supabaseUserId || null,
        entitlement,
        limits: {
          maxSubreddits: normalizeForJson(limits.maxSubreddits),
          maxPostItems: normalizeForJson(limits.maxPostItems),
          temporarySelectionEnabled: limits.temporarySelectionEnabled,
        },
      });
    } catch (e: unknown) {
      if (refresh) {
        addApiBreadcrumb('Retrying with token refresh');
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
        
        // Set Sentry user context
        if (me) {
          Sentry.setUser({ id: me.id, username: me.name });
        }
        
        // Only fetch subreddits if explicitly requested
        const fetchSubs = req.query.include_subs === 'true';
        const subs = fetchSubs ? await listMySubreddits(client2) : [];
        
        const entitlement = supabaseUserId ? await getEntitlement(supabaseUserId) : 'free';
        const limits = getLimits(entitlement);

        return res.status(200).json({
          authenticated: true,
          me,
          subs,
          userId: supabaseUserId || null,
          entitlement,
          limits: {
            maxSubreddits: normalizeForJson(limits.maxSubreddits),
            maxPostItems: normalizeForJson(limits.maxPostItems),
            temporarySelectionEnabled: limits.temporarySelectionEnabled,
          },
        });
      }
      throw e;
    }
  } catch (e: unknown) {
    return handleApiError(req, res, e, {
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      userMessage: 'Failed to fetch user information',
    });
  }
}
