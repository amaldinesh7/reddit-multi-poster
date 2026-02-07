import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getIdentity, redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';
import { handleApiError, addApiBreadcrumb } from '../../lib/apiErrorHandler';

/**
 * Canny SSO Token Generation Endpoint
 * 
 * Generates a signed JWT token for Canny widget authentication.
 * Uses the authenticated Reddit user's identity to create the SSO token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cannyPrivateKey = process.env.CANNY_PRIVATE_KEY;
  if (!cannyPrivateKey) {
    return res.status(500).json({ error: 'Canny SSO not configured' });
  }

  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];

  if (!access && !refresh) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let token = access;

  try {
    let client = token ? redditClient(token) : undefined as ReturnType<typeof redditClient> | undefined;

    // Try to get identity, refresh token if needed
    const getUser = async () => {
      if (!client && refresh) {
        addApiBreadcrumb('Refreshing access token for Canny SSO');
        const t = await refreshAccessToken(refresh);
        token = t.access_token;
        res.setHeader('Set-Cookie', serialize('reddit_access', token, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: t.expires_in - 10,
        }));
        client = redditClient(token);
      }
      if (!client) {
        throw new Error('Unable to create Reddit client');
      }
      return getIdentity(client);
    };

    let me;
    try {
      me = await getUser();
    } catch {
      // Token might be expired, try refreshing
      if (refresh) {
        addApiBreadcrumb('Retrying with token refresh for Canny SSO');
        const t = await refreshAccessToken(refresh);
        token = t.access_token;
        res.setHeader('Set-Cookie', serialize('reddit_access', token, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: t.expires_in - 10,
        }));
        client = redditClient(token);
        me = await getIdentity(client);
      } else {
        throw new Error('Authentication failed');
      }
    }

    if (!me) {
      return res.status(401).json({ error: 'Could not fetch user identity' });
    }

    // Generate Canny SSO token
    // Note: Reddit doesn't expose email, so we omit it
    const userData = {
      id: me.id,
      name: me.name,
      avatarURL: me.icon_img || undefined,
    };

    const ssoToken = jwt.sign(userData, cannyPrivateKey, { algorithm: 'HS256' });

    return res.status(200).json({ ssoToken });
  } catch (e: unknown) {
    return handleApiError(req, res, e, {
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      userMessage: 'Failed to generate Canny SSO token',
    });
  }
}
