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
      case 'GET': {
        // Get all categories with their subreddits for this user
        const { data: categories, error } = await supabase
          .from('categories')
          .select(`
            *,
            user_subreddits (*)
          `)
          .eq('user_id', userId)
          .order('position', { ascending: true });

        if (error) throw error;

        // Sort subreddits within each category
        const sortedCategories = (categories as unknown as Array<{
          user_subreddits?: Array<{ position: number }>;
          [key: string]: unknown;
        }>)?.map(cat => ({
          ...cat,
          user_subreddits: (cat.user_subreddits || []).sort(
            (a, b) => a.position - b.position
          ),
        }));

        return res.status(200).json({ success: true, data: sortedCategories });
      }

      case 'POST': {
        // Create a new category
        const { name, position } = req.body;

        if (!name || typeof name !== 'string') {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'Category name is required' },
          });
        }

        // Get the next position if not provided
        let newPosition = position;
        if (typeof newPosition !== 'number') {
          const { data: maxPos } = await supabase
            .from('categories')
            .select('position')
            .eq('user_id', userId)
            .order('position', { ascending: false })
            .limit(1)
            .single();
          const maxPosData = maxPos as { position: number } | null;
          newPosition = (maxPosData?.position ?? -1) + 1;
        }

        const { data: category, error } = await supabase
          .from('categories')
          .insert({
            user_id: userId,
            name: name.trim(),
            position: newPosition,
          } as Record<string, unknown>)
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({ success: true, data: category });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
        });
    }
  } catch (error) {
    console.error('Categories API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
