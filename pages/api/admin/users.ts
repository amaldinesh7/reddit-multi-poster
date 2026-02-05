import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserDetails, isAdmin } from '../../../lib/apiAuth';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { invalidateEntitlementCache } from '../../../lib/entitlement';

/**
 * Admin API for user management.
 * GET: List all users with their entitlement status.
 * PATCH: Update a user's entitlement (set to 'paid' or 'free').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify admin access
  const { redditUsername } = await getUserDetails(req, res);
  
  if (!redditUsername) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isAdmin(redditUsername)) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  const client = createServerSupabaseClient();

  // GET: List users
  if (req.method === 'GET') {
    try {
      const { data: users, error } = await client
        .from('users')
        .select('id, reddit_username, reddit_avatar_url, entitlement, paid_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return res.status(200).json({ users: users || [] });
    } catch (error) {
      console.error('Admin users GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // PATCH: Update user entitlement
  if (req.method === 'PATCH') {
    try {
      const { userId, entitlement } = req.body;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId is required' });
      }

      if (entitlement !== 'free' && entitlement !== 'paid') {
        return res.status(400).json({ error: 'entitlement must be "free" or "paid"' });
      }

      const updateData: { entitlement: string; paid_at?: string | null } = {
        entitlement,
      };

      // Set or clear paid_at timestamp
      if (entitlement === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }

      const { data, error } = await client
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, reddit_username, entitlement, paid_at')
        .single();

      if (error) throw error;

      // Invalidate entitlement cache so changes take effect immediately
      invalidateEntitlementCache(userId);

      return res.status(200).json({ user: data });
    } catch (error) {
      console.error('Admin users PATCH error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
