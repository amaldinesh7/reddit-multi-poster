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
      error: { code: 'INVALID_INPUT', message: 'Category ID is required' },
    });
  }

  const supabase = createServerSupabaseClient();

  try {
    // Verify the category belongs to this user
    const { data: existing, error: fetchError } = await supabase
      .from('categories')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Category not found' },
      });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    switch (req.method) {
      case 'PUT': {
        // Update category
        const { name, position, collapsed } = req.body;
        const updates: Record<string, unknown> = {};

        if (name !== undefined) updates.name = name.trim();
        if (typeof position === 'number') updates.position = position;
        if (typeof collapsed === 'boolean') updates.collapsed = collapsed;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'No valid fields to update' },
          });
        }

        const { data: category, error } = await supabase
          .from('categories')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({ success: true, data: category });
      }

      case 'DELETE': {
        // Delete category (cascades to subreddits)
        const { error } = await supabase
          .from('categories')
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
    console.error('Category API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
