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

interface ReorderItem {
  id: string;
  position: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
    });
  }

  const userId = await getUserId(req, res);
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  const supabase = createServerSupabaseClient();

  try {
    const { type, items } = req.body as { type: 'categories' | 'subreddits'; items: ReorderItem[] };

    if (!type || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'type and items array are required' },
      });
    }

    if (type === 'categories') {
      // Verify all categories belong to this user
      const categoryIds = items.map(i => i.id);
      const { data: categories, error: fetchError } = await supabase
        .from('categories')
        .select('id, user_id')
        .in('id', categoryIds);

      if (fetchError) throw fetchError;

      const allOwned = categories?.every(cat => cat.user_id === userId);
      if (!allOwned) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied to some categories' },
        });
      }

      // Update positions
      for (const item of items) {
        await supabase
          .from('categories')
          .update({ position: item.position })
          .eq('id', item.id);
      }
    } else if (type === 'subreddits') {
      // Verify all subreddits belong to categories owned by this user
      const subredditIds = items.map(i => i.id);
      const { data: subreddits, error: fetchError } = await supabase
        .from('user_subreddits')
        .select(`
          id,
          categories!inner (user_id)
        `)
        .in('id', subredditIds);

      if (fetchError) throw fetchError;

      const allOwned = subreddits?.every(
        sub => ((sub.categories as unknown) as { user_id: string }).user_id === userId
      );
      if (!allOwned) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied to some subreddits' },
        });
      }

      // Update positions
      for (const item of items) {
        await supabase
          .from('user_subreddits')
          .update({ position: item.position })
          .eq('id', item.id);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'type must be "categories" or "subreddits"' },
      });
    }

    return res.status(200).json({ success: true, data: { updated: items.length } });
  } catch (error) {
    console.error('Reorder API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
