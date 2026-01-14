import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

const isProduction = process.env.NODE_ENV === 'production';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Clear all auth-related cookies with proper security settings
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 0,
  };
  
  res.setHeader('Set-Cookie', [
    serialize('reddit_access', '', cookieOptions),
    serialize('reddit_refresh', '', cookieOptions),
    serialize('supabase_user_id', '', cookieOptions),
    serialize('reddit_oauth_state', '', { path: '/', maxAge: 0 }),
  ]);
  
  res.status(200).json({ success: true });
}
