import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient } from '../../../../lib/supabase';
import { getUserId } from '../../../../lib/apiAuth';
import { addApiBreadcrumb } from '../../../../lib/apiErrorHandler';

interface ApiResponse {
  success: boolean;
  data?: {
    deletedCount: number;
    keptCount: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Bulk delete subreddits - keeps only the specified IDs and deletes all others.
 * Used when a trial expires and user needs to select which communities to keep.
 * 
 * POST /api/settings/subreddits/bulk-delete
 * Body: { keepIds: string[] }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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
    const { keepIds } = req.body;

    if (!Array.isArray(keepIds)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'keepIds must be an array of subreddit IDs' },
      });
    }

    // Get all user's category IDs
    const { data: userCategories, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId);

    if (catError) throw catError;

    if (!userCategories || userCategories.length === 0) {
      return res.status(200).json({
        success: true,
        data: { deletedCount: 0, keptCount: 0 },
      });
    }

    const categoryIds = userCategories.map((c) => c.id);

    // Get all user's subreddit IDs
    const { data: allSubreddits, error: subError } = await supabase
      .from('user_subreddits')
      .select('id')
      .in('category_id', categoryIds);

    if (subError) throw subError;

    if (!allSubreddits || allSubreddits.length === 0) {
      return res.status(200).json({
        success: true,
        data: { deletedCount: 0, keptCount: 0 },
      });
    }

    const allSubredditIds = allSubreddits.map((s) => s.id);

    // Verify that all keepIds belong to this user
    const validKeepIds = keepIds.filter((id: string) => allSubredditIds.includes(id));

    if (validKeepIds.length !== keepIds.length) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_IDS', 
          message: 'Some of the provided IDs do not belong to your communities' 
        },
      });
    }

    // Find IDs to delete (all IDs that are NOT in keepIds)
    const idsToDelete = allSubredditIds.filter((id) => !validKeepIds.includes(id));

    if (idsToDelete.length === 0) {
      return res.status(200).json({
        success: true,
        data: { deletedCount: 0, keptCount: validKeepIds.length },
      });
    }

    // Delete all subreddits NOT in the keepIds list
    const { error: deleteError, count: deletedCount } = await supabase
      .from('user_subreddits')
      .delete({ count: 'exact' })
      .in('id', idsToDelete);

    if (deleteError) throw deleteError;

    addApiBreadcrumb('Bulk delete subreddits completed', {
      keptCount: validKeepIds.length,
      deletedCount: deletedCount ?? idsToDelete.length,
    });

    return res.status(200).json({
      success: true,
      data: {
        deletedCount: deletedCount ?? idsToDelete.length,
        keptCount: validKeepIds.length,
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'settings.subreddits.bulk-delete',
        method: req.method,
      },
    });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
