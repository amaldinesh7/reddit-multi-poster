import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAdminAuth, isAdminPassword } from '../../lib/apiAuth';
import { serialize } from 'cookie';

/**
 * Endpoint to check if current user is admin or validate admin password.
 * GET: Returns { isAdmin: boolean }
 * POST: Validates password and sets admin cookie. Body: { password: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST: Validate password and set cookie
  if (req.method === 'POST') {
    try {
      const { password } = req.body;
      
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password required' });
      }

      if (isAdminPassword(password)) {
        // Set admin password cookie (httpOnly for security)
        res.setHeader('Set-Cookie', serialize('admin_password', password, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        }));
        return res.status(200).json({ isAdmin: true });
      }

      return res.status(401).json({ isAdmin: false, error: 'Invalid password' });
    } catch {
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
