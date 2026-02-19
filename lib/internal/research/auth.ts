import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { refreshAccessToken } from '@/utils/reddit';

export const getResearchAccessToken = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<string | null> => {
  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  if (access) return access;
  if (!refresh) return null;

  try {
    const token = await refreshAccessToken(refresh);
    res.setHeader(
      'Set-Cookie',
      serialize('reddit_access', token.access_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: token.expires_in - 10,
      })
    );
    return token.access_token;
  } catch {
    return null;
  }
};
