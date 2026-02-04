import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserDetails, isAdmin } from '../../lib/apiAuth';

/**
 * Simple endpoint to check if current user is admin.
 * Returns { isAdmin: boolean }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { redditUsername } = await getUserDetails(req, res);
    
    if (!redditUsername) {
      return res.status(200).json({ isAdmin: false });
    }

    return res.status(200).json({ isAdmin: isAdmin(redditUsername) });
  } catch {
    return res.status(200).json({ isAdmin: false });
  }
}
