import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '../../../../lib/supabase';
import { getUserId } from '../../../../lib/apiAuth';

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const userId = await getUserId(req, res);
  const { id } = req.query;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Subreddit ID is required' },
    });
  }

  const supabase = createServerSupabaseClient();

  try {
    // Verify the subreddit belongs to a category owned by this user
    const { data: existing, error: fetchError } = await supabase
      .from('user_subreddits')
      .select(`
        id,
        category_id,
        categories!inner (user_id)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subreddit not found' },
      });
    }

    const categoryUserId = ((existing.categories as unknown) as { user_id: string }).user_id;
    if (categoryUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    switch (req.method) {
      case 'PUT': {
        // Update subreddit
        const { subreddit_name, display_name, position, category_id } = req.body;
        const updates: Record<string, unknown> = {};

        if (subreddit_name !== undefined) {
          updates.subreddit_name = subreddit_name.trim().replace(/^r\//, '');
        }
        if (display_name !== undefined) updates.display_name = display_name;
        if (typeof position === 'number') updates.position = position;
        
        // If moving to a different category, verify ownership
        if (category_id && category_id !== existing.category_id) {
          const { data: newCategory, error: catError } = await supabase
            .from('categories')
            .select('id, user_id')
            .eq('id', category_id)
            .single();

          if (catError || !newCategory || newCategory.user_id !== userId) {
            return res.status(403).json({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Cannot move to that category' },
            });
          }
          updates.category_id = category_id;
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'No valid fields to update' },
          });
        }

        const { data: subreddit, error } = await supabase
          .from('user_subreddits')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({ success: true, data: subreddit });
      }

      case 'DELETE': {
        // Delete subreddit
        const { error } = await supabase
          .from('user_subreddits')
          .delete()
          .eq('id', id);

        if (error) throw error;

        return res.status(200).json({ success: true, data: { deleted: true } });
      }

      default:
        res.setHeader('Allow', ['PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
        });
    }
  } catch (error) {
    console.error('Subreddit API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
