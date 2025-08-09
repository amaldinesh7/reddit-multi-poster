import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUrl } from '../../../utils/reddit';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const redirect = getAuthUrl(state);
  
  // Set cookie with more permissive settings for localhost
  res.setHeader('Set-Cookie', serialize('reddit_oauth_state', state, {
    path: '/', 
    httpOnly: true, 
    sameSite: 'lax', 
    maxAge: 600, // 10 minutes instead of 5
    secure: false // Allow on HTTP for localhost
  }));
  
  console.log('Login debug - setting state:', state);
  res.redirect(302, redirect);
} 