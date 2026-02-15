import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAdminAuth, isAdminPassword, createAdminSessionToken } from '../../lib/apiAuth';
import { serialize } from 'cookie';

/**
 * Endpoint to check if current user is admin or validate admin password.
 * GET: Returns { isAdmin: boolean }
 * POST: Validates password and sets admin session cookie. Body: { password: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST: Validate password and set session cookie
  if (req.method === 'POST') {
    try {
      const { password } = req.body;
      
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password required' });
      }

      if (isAdminPassword(password)) {
        // Create signed session token instead of storing raw password
        const sessionToken = createAdminSessionToken(Date.now());
        
        // Set admin session cookie (httpOnly for security)
        res.setHeader('Set-Cookie', serialize('admin_session', sessionToken, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        }));
        return res.status(200).json({ isAdmin: true });
      }

      return res.status(401).json({ isAdmin: false, error: 'Invalid password' });
    } catch (error) {
      console.error('Admin check error:', error);
      return res.status(500).json({ isAdmin: false, error: 'Server error' });
    }
  }

  // GET: Check current admin status
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { isAdmin, method } = await checkAdminAuth(req, res);
    // isAdminByUsername: true only if authenticated via Reddit username (not password)
    // This is used by UI to show/hide admin menu item
    return res.status(200).json({ 
      isAdmin, 
      isAdminByUsername: method === 'reddit' 
    });
  } catch {
    return res.status(200).json({ isAdmin: false, isAdminByUsername: false });
  }
}
