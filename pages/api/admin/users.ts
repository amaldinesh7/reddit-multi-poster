import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserDetails, isAdmin } from '../../../lib/apiAuth';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { invalidateEntitlementCache } from '../../../lib/entitlement';

/**
 * Admin API for user management.
 * GET: List all users with their entitlement status.
 * PATCH: Update a user's entitlement (set to 'paid', 'trial', or 'free').
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

  // GET: List users with search, filter, sort, and post counts
  if (req.method === 'GET') {
    try {
      const { 
        search, 
        entitlement: filterEntitlement, 
        sortBy = 'created_at', 
        sortOrder = 'desc' 
      } = req.query;

      // Build query
      let query = client
        .from('users')
        .select('id, reddit_username, reddit_avatar_url, entitlement, paid_at, created_at');

      // Apply search filter (case-insensitive)
      if (search && typeof search === 'string' && search.trim()) {
        query = query.ilike('reddit_username', `%${search.trim()}%`);
      }

      // Apply entitlement filter
      if (filterEntitlement && (filterEntitlement === 'free' || filterEntitlement === 'trial' || filterEntitlement === 'paid')) {
        query = query.eq('entitlement', filterEntitlement);
      }

      // Apply sorting (for non-post_count sorts)
      const validSortFields = ['created_at', 'reddit_username'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'created_at';
      const ascending = sortOrder === 'asc';
      
      if (sortBy !== 'post_count') {
        query = query.order(sortField, { ascending });
      }

      query = query.limit(200);

      const { data: users, error } = await query;

      if (error) throw error;

      // Get post counts for all users
      const userIds = (users || []).map(u => u.id);
      let postCounts: Record<string, number> = {};

      if (userIds.length > 0) {
        const { data: postLogs } = await client
          .from('post_logs')
          .select('user_id')
          .in('user_id', userIds);

        if (postLogs) {
          postCounts = postLogs.reduce((acc, log) => {
            acc[log.user_id] = (acc[log.user_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Add post_count to each user
      let enrichedUsers = (users || []).map(user => ({
        ...user,
        post_count: postCounts[user.id] || 0,
      }));

      // Sort by post_count if requested
      if (sortBy === 'post_count') {
        enrichedUsers = enrichedUsers.sort((a, b) => {
          return ascending 
            ? a.post_count - b.post_count 
            : b.post_count - a.post_count;
        });
      }

      return res.status(200).json({ users: enrichedUsers });
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

      if (entitlement !== 'free' && entitlement !== 'trial' && entitlement !== 'paid') {
        return res.status(400).json({ error: 'entitlement must be "free", "trial", or "paid"' });
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
