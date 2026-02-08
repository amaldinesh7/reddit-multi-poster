import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { getUserId } from '../../../lib/apiAuth';
import { getEntitlement, FREE_MAX_SUBREDDITS } from '../../../lib/entitlement';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';

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

        // Only enforce limit for FREE users - paid users have no limit
        const entitlement = await getEntitlement(userId);
        if (entitlement === 'free') {
          const { data: userCategoryIds } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', userId);
          const categoryIds = (userCategoryIds || []).map((c) => c.id);
          if (categoryIds.length > 0) {
            const { count: subredditCount } = await supabase
              .from('user_subreddits')
              .select('id', { count: 'exact', head: true })
              .in('category_id', categoryIds);

            if (subredditCount !== null && subredditCount >= FREE_MAX_SUBREDDITS) {
              return res.status(403).json({
                success: false,
                error: {
                  code: 'LIMIT_REACHED',
                  message: `Free plan allows ${FREE_MAX_SUBREDDITS} saved subreddits. Upgrade for unlimited.`,
                },
              });
            }
          }
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

        // Check if subreddit already exists in any of the user's categories
        const { data: userCategoryIdsForDupeCheck } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', userId);
        
        const userCatIds = (userCategoryIdsForDupeCheck || []).map((c) => c.id);
        if (userCatIds.length > 0) {
          const { data: existingSub } = await supabase
            .from('user_subreddits')
            .select('id, subreddit_name, category_id')
            .in('category_id', userCatIds)
            .ilike('subreddit_name', cleanName)
            .limit(1)
            .maybeSingle();

          if (existingSub) {
            return res.status(409).json({
              success: false,
              error: {
                code: 'DUPLICATE_SUBREDDIT',
                message: `r/${cleanName} is already in your lists`,
              },
            });
          }
        }

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

        addApiBreadcrumb('Subreddit added to category', {
          categoryId: category_id,
          subredditName: cleanName,
        });

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
    Sentry.captureException(error, {
      tags: {
        component: 'settings.subreddits',
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
