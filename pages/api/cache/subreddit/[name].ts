import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '../../../../lib/supabase';
import { redditClient, refreshAccessToken, getFlairs, getSubredditRules, getPostRequirements, PostRequirements } from '../../../../utils/reddit';

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

interface CachedData {
  subreddit_name: string;
  flairs: unknown[];
  flair_required: boolean;
  rules: unknown;
  title_tags: unknown[];
  post_requirements: PostRequirements | null;
  cached_at: string;
  cache_version: number;
}

const CACHE_EXPIRY_HOURS = 24;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { name } = req.query;
  const force = req.query.force === 'true';

  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Subreddit name is required' },
    });
  }

  const subredditName = name.toLowerCase().replace(/^r\//, '');
  const supabase = createServerSupabaseClient();

  try {
    switch (req.method) {
      case 'GET': {
        // Check cache first
        const { data: rawCached, error: cacheError } = await supabase
          .from('subreddit_cache')
          .select('*')
          .eq('subreddit_name', subredditName)
          .single();

        const cached = rawCached as CachedData | null;

        if (!cacheError && cached && !force) {
          // Check if cache is still fresh
          const cachedAt = new Date(cached.cached_at);
          const now = new Date();
          const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

          if (hoursDiff < CACHE_EXPIRY_HOURS) {
            return res.status(200).json({
              success: true,
              data: {
                subreddit_name: cached.subreddit_name,
                flairs: cached.flairs,
                flair_required: cached.flair_required,
                rules: cached.rules,
                title_tags: cached.title_tags,
                post_requirements: cached.post_requirements,
                cached: true,
                cached_at: cached.cached_at,
              },
            });
          }
        }

        // Cache miss or expired - need to fetch from Reddit
        // Get Reddit access token from cookies
        const access = req.cookies['reddit_access'];
        const refresh = req.cookies['reddit_refresh'];

        if (!access && !refresh) {
          // Return cached data even if expired, or empty if no cache
          if (cached) {
            return res.status(200).json({
              success: true,
              data: {
                subreddit_name: cached.subreddit_name,
                flairs: cached.flairs,
                flair_required: cached.flair_required,
                rules: cached.rules,
                title_tags: cached.title_tags,
                post_requirements: cached.post_requirements,
                cached: true,
                stale: true,
                cached_at: cached.cached_at,
              },
            });
          }
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required to fetch subreddit data' },
          });
        }

        // Get a valid Reddit client
        let token = access;
        if (!token && refresh) {
          const t = await refreshAccessToken(refresh);
          token = t.access_token;
        }

        if (!token) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Could not obtain Reddit access token' },
          });
        }

        const client = redditClient(token);

        // Fetch data from Reddit (including post requirements)
        const [flairsResult, rulesResult, postRequirementsResult] = await Promise.all([
          getFlairs(client, subredditName).catch(() => ({ flairs: [], required: false })),
          getSubredditRules(client, subredditName).catch(() => ({
            requiresGenderTag: false,
            requiresContentTag: false,
            genderTags: [],
            contentTags: [],
            rules: [],
            submitText: '',
          })),
          getPostRequirements(client, subredditName).catch(() => ({} as PostRequirements)),
        ]);

        // Parse title tags from submitText if available
        const titleTags: Array<{ tag: string; label: string; required: boolean }> = [];
        if (rulesResult.submitText) {
          // Simple parsing - can be enhanced with AI later
          const tagPatterns = [
            { pattern: /\(f\)/i, tag: '(f)', label: 'Female', required: rulesResult.requiresGenderTag },
            { pattern: /\(m\)/i, tag: '(m)', label: 'Male', required: rulesResult.requiresGenderTag },
            { pattern: /\(c\)/i, tag: '(c)', label: 'Couple', required: false },
            { pattern: /\[oc\]/i, tag: '[OC]', label: 'Original Content', required: false },
          ];
          
          for (const { pattern, tag, label, required } of tagPatterns) {
            if (pattern.test(rulesResult.submitText)) {
              titleTags.push({ tag, label, required });
            }
          }
        }

        // Upsert to cache
        const cacheData = {
          subreddit_name: subredditName,
          flairs: flairsResult.flairs,
          flair_required: flairsResult.required,
          rules: {
            requiresGenderTag: rulesResult.requiresGenderTag,
            requiresContentTag: rulesResult.requiresContentTag,
            genderTags: rulesResult.genderTags,
            contentTags: rulesResult.contentTags,
          },
          title_tags: titleTags,
          post_requirements: postRequirementsResult,
          cached_at: new Date().toISOString(),
          cache_version: 2,
        };

        const { error: upsertError } = await supabase
          .from('subreddit_cache')
          .upsert(cacheData as Record<string, unknown>, { onConflict: 'subreddit_name' });

        if (upsertError) {
          console.error('Failed to cache subreddit data:', upsertError);
        }

        return res.status(200).json({
          success: true,
          data: {
            ...cacheData,
            cached: false,
          },
        });
      }

      case 'POST': {
        // Force refresh cache
        // Redirect to GET with force=true
        return res.redirect(307, `/api/cache/subreddit/${subredditName}?force=true`);
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
        });
    }
  } catch (error) {
    console.error('Subreddit cache API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}
