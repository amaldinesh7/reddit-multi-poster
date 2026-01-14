import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { getUserId } from '../../../lib/apiAuth';

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
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  const supabase = createServerSupabaseClient();

  try {
    switch (req.method) {
      case 'POST': {
        // Add a subreddit to a category
        const { category_id, subreddit_name, display_name, position } = req.body;

        if (!category_id || !subreddit_name) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'category_id and subreddit_name are required' },
          });
        }

        // Verify the category belongs to this user
        const { data: category, error: catError } = await supabase
          .from('categories')
          .select('id, user_id')
          .eq('id', category_id)
          .single();

        if (catError || !category) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Category not found' },
          });
        }

        if (category.user_id !== userId) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied' },
          });
        }

        // Get the next position if not provided
        let newPosition = position;
        if (typeof newPosition !== 'number') {
          const { data: maxPos } = await supabase
            .from('user_subreddits')
            .select('position')
            .eq('category_id', category_id)
            .order('position', { ascending: false })
            .limit(1)
            .single();
          newPosition = (maxPos?.position ?? -1) + 1;
        }

        // Clean subreddit name (remove r/ prefix if present)
        const cleanName = subreddit_name.trim().replace(/^r\//, '');

        const { data: subreddit, error } = await supabase
          .from('user_subreddits')
          .insert({
            category_id,
            subreddit_name: cleanName,
            display_name: display_name || null,
            position: newPosition,
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({ success: true, data: subreddit });
      }

      default:
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
        });
    }
  } catch (error) {
    console.error('Subreddits API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
