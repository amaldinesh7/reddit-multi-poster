import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUrl } from '../../../utils/reddit';
import { serialize } from 'cookie';
import { applyRateLimit, authRateLimit } from '../../../lib/rateLimit';
import { trackServerEvent, flushPostHogServer } from '../../../lib/posthog-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  // Apply rate limiting to prevent auth abuse
  if (!applyRateLimit(req, res, authRateLimit)) {
    return; // Response already sent by applyRateLimit
  }
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const redirect = getAuthUrl(state);
  
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 600, // 10 minutes
    secure: isProduction,
  };

  // Persist UTM params from the Referer page into a short-lived cookie
  // so the OAuth callback can attribute signups to marketing channels.
  const referer = req.headers.referer ?? '';
  let utmCookie = '';
  try {
    const refUrl = referer ? new URL(referer) : null;
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const utmData: Record<string, string> = {};
    let hasUtm = false;

    if (refUrl) {
      for (const key of utmKeys) {
        const val = refUrl.searchParams.get(key);
        if (val) {
          utmData[key] = val;
          hasUtm = true;
        }
      }
    }

    // Also check query params on the login API URL itself (e.g. /api/auth/login?utm_source=reddit)
    for (const key of utmKeys) {
      const val = req.query[key];
      if (typeof val === 'string' && val && !utmData[key]) {
        utmData[key] = val;
        hasUtm = true;
      }
    }

    if (hasUtm) {
      utmCookie = serialize('rmp_utm', JSON.stringify(utmData), cookieOptions);
    }
  } catch {
    // Non-critical — proceed without UTM cookie
  }

  const cookies = [
    serialize('reddit_oauth_state', state, cookieOptions),
    utmCookie,
  ].filter(Boolean);

  res.setHeader('Set-Cookie', cookies);
  
  // Track OAuth initiation (use state as anonymous distinct ID)
  // This will be aliased to the real user ID in callback.ts
  trackServerEvent(state, 'oauth_started', { source: 'login_api' });
  
  // Flush PostHog events before redirecting to ensure they're sent
  await flushPostHogServer();
  
  res.redirect(302, redirect);
}