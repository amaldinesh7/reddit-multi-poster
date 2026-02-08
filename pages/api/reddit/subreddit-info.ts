import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '../../../lib/supabase';
import {
  redditClient,
  refreshAccessToken,
  getFlairs,
  getSubredditRules,
  getPostRequirements,
  PostRequirements,
  SubredditRules,
} from '../../../utils/reddit';
import { parseRequirementsFromText, ParsedRequirements } from '../../../lib/parseSubredditRequirements';
import { UnifiedSubredditData, TitleTag } from '../../../types/api';

interface ApiResponse {
  success: boolean;
  data?: UnifiedSubredditData;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Unified API endpoint that fetches ALL subreddit data including user-specific status.
 * This is the single source of truth for client-side subreddit data.
 * 
 * GET /api/reddit/subreddit-info?name=subredditName
 * 
 * Returns: UnifiedSubredditData with:
 * - Subreddit settings (type, posting restrictions, media allowances)
 * - User-specific status (banned, subscriber, moderator, contributor)
 * - Flairs, rules, post requirements
 * - Parsed requirements
 * 
 * IMPORTANT: userIsContributor is ONLY included if Reddit explicitly returns
 * the user_is_contributor field. We NEVER default it to false.
 * 
 * This endpoint also updates the Supabase cache for AI features (server-side only).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
    });
  }

  const { name } = req.query;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Subreddit name is required' },
    });
  }

  const subredditName = name.toLowerCase().replace(/^r\//, '');

  // Get Reddit access token from cookies
  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];

  if (!access && !refresh) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  try {
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

    // Fetch all data from Reddit in parallel
    const [aboutResult, flairsResult, rulesResult, postRequirementsResult] = await Promise.all([
      // Main subreddit about data (includes settings AND user status)
      client.get(`/r/${subredditName}/about`, { params: { raw_json: 1 } })
        .then(({ data }) => {
          const result = data?.data || {};
          // #region agent log
          const fs = require('fs');
          const logEntry = JSON.stringify({
            location: 'subreddit-info.ts:96',
            message: 'Raw Reddit /about response',
            data: {
              subreddit: subredditName,
              user_is_contributor: result.user_is_contributor,
              user_is_contributor_type: typeof result.user_is_contributor,
              user_is_contributor_in_response: 'user_is_contributor' in result,
              user_is_banned: result.user_is_banned,
              user_is_subscriber: result.user_is_subscriber,
              user_is_moderator: result.user_is_moderator,
              subreddit_type: result.subreddit_type,
              restrict_posting: result.restrict_posting,
            },
            hypothesisId: 'D',
            timestamp: Date.now(),
          }) + '\n';
          fs.appendFileSync('/Users/amal.dinesh@postman.com/Teststation/reddit-multi-poster/.cursor/debug.log', logEntry);
          // #endregion
          return result;
        })
        .catch((error) => {
          console.error(`Failed to fetch /r/${subredditName}/about:`, error?.message);
          return {};
        }),
      // Flairs
      getFlairs(client, subredditName).catch(() => ({ flairs: [], required: false })),
      // Rules
      getSubredditRules(client, subredditName).catch(() => ({
        requiresGenderTag: false,
        requiresContentTag: false,
        genderTags: [],
        contentTags: [],
        rules: [],
        submitText: '',
      } as SubredditRules)),
      // Post requirements
      getPostRequirements(client, subredditName).catch(() => ({} as PostRequirements)),
    ]);

    // Extract subreddit settings (non-user-specific)
    const subredditType = aboutResult.subreddit_type || 'public';
    const restrictPosting = aboutResult.restrict_posting || false;
    const submissionType = aboutResult.submission_type || 'any';
    const allowImages = aboutResult.allow_images !== false;
    const allowVideos = aboutResult.allow_videos !== false;
    const allowGifs = aboutResult.allow_videogifs !== false;

    // Build user status - ONLY include fields that Reddit explicitly returns
    // CRITICAL: Do NOT default userIsContributor to false
    const userStatus: Pick<UnifiedSubredditData, 'userIsBanned' | 'userIsContributor' | 'userIsSubscriber' | 'userIsModerator'> = {};
    
    // Always include these if present or default to false (they're always relevant)
    if (aboutResult.user_is_banned !== undefined) {
      userStatus.userIsBanned = aboutResult.user_is_banned;
    }
    
    if (aboutResult.user_is_subscriber !== undefined) {
      userStatus.userIsSubscriber = aboutResult.user_is_subscriber;
    }
    
    if (aboutResult.user_is_moderator !== undefined) {
      userStatus.userIsModerator = aboutResult.user_is_moderator;
    }
    
    // CRITICAL: Only include userIsContributor if Reddit explicitly returns it
    // This field indicates "approved submitter" status for restricted/private subreddits
    // If this field is not returned by Reddit, the subreddit doesn't require verification
    if (aboutResult.user_is_contributor !== undefined) {
      userStatus.userIsContributor = aboutResult.user_is_contributor;
    }

    // #region agent log
    {
      const fs = require('fs');
      const logEntry = JSON.stringify({
        location: 'subreddit-info.ts:170',
        message: 'Transformed userStatus object',
        data: {
          subreddit: subredditName,
          userStatusKeys: Object.keys(userStatus),
          userIsContributorIncluded: 'userIsContributor' in userStatus,
          userIsContributorValue: (userStatus as Record<string, unknown>).userIsContributor,
          flairCount: flairsResult.flairs?.length || 0,
          flairRequired: flairsResult.required,
        },
        hypothesisId: 'D',
        timestamp: Date.now(),
      }) + '\n';
      fs.appendFileSync('/Users/amal.dinesh@postman.com/Teststation/reddit-multi-poster/.cursor/debug.log', logEntry);
    }
    // #endregion

    // Parse requirements from submit text
    let parsedRequirements: ParsedRequirements | null = null;
    if (rulesResult.submitText) {
      parsedRequirements = parseRequirementsFromText(rulesResult.submitText, 'submit_text');
    }

    // Parse title tags from submitText
    const titleTags: TitleTag[] = [];
    if (rulesResult.submitText) {
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

    // Build the unified response
    const unifiedData: UnifiedSubredditData = {
      subreddit: subredditName,
      flairs: flairsResult.flairs,
      flairRequired: flairsResult.required,
      rules: rulesResult,
      titleTags,
      postRequirements: Object.keys(postRequirementsResult).length > 0 ? postRequirementsResult : undefined,
      parsedRequirements: parsedRequirements || undefined,
      subredditType,
      restrictPosting,
      submissionType,
      allowImages,
      allowVideos,
      allowGifs,
      // Spread user status fields (only those that exist)
      ...userStatus,
      cachedAt: new Date().toISOString(),
      cacheVersion: 1,
    };

    // Update Supabase cache for AI features (server-side, non-user-specific data only)
    // This runs in the background and doesn't block the response
    updateSupabaseCache(subredditName, {
      flairs: flairsResult.flairs,
      flairRequired: flairsResult.required,
      rules: rulesResult,
      titleTags,
      postRequirements: postRequirementsResult,
      parsedRequirements,
      subredditType,
      restrictPosting,
      submissionType,
      allowImages,
      allowVideos,
      allowGifs,
    }).catch((error) => {
      console.warn(`Failed to update Supabase cache for ${subredditName}:`, error);
    });

    return res.status(200).json({
      success: true,
      data: unifiedData,
    });
  } catch (error) {
    console.error('Subreddit info API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}

/**
 * Update Supabase cache with non-user-specific data for AI features
 * This preserves the server-side cache for future AI use cases
 */
async function updateSupabaseCache(
  subredditName: string,
  data: {
    flairs: unknown[];
    flairRequired: boolean;
    rules: SubredditRules;
    titleTags: TitleTag[];
    postRequirements?: PostRequirements;
    parsedRequirements?: ParsedRequirements | null;
    subredditType: string;
    restrictPosting: boolean;
    submissionType: string;
    allowImages: boolean;
    allowVideos: boolean;
    allowGifs: boolean;
  }
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const cacheData = {
    subreddit_name: subredditName,
    flairs: data.flairs,
    flair_required: data.flairRequired,
    rules: {
      requiresGenderTag: data.rules.requiresGenderTag,
      requiresContentTag: data.rules.requiresContentTag,
      genderTags: data.rules.genderTags,
      contentTags: data.rules.contentTags,
    },
    title_tags: data.titleTags,
    post_requirements: data.postRequirements || null,
    // Store only non-user-specific settings in eligibility
    eligibility: {
      subreddit: subredditName,
      subredditType: data.subredditType,
      restrictPosting: data.restrictPosting,
      submissionType: data.submissionType,
      allowImages: data.allowImages,
      allowVideos: data.allowVideos,
      allowGifs: data.allowGifs,
    },
    parsed_requirements: data.parsedRequirements || null,
    cached_at: new Date().toISOString(),
    cache_version: 6, // New version for unified cache architecture
  };

  const { error } = await supabase
    .from('subreddit_cache')
    .upsert(cacheData, { onConflict: 'subreddit_name' });

  if (error) {
    // Handle missing column error gracefully
    if (error.code === 'PGRST204' && error.message?.includes('parsed_requirements')) {
      const { parsed_requirements, ...cacheDataWithoutParsed } = cacheData;
      await supabase
        .from('subreddit_cache')
        .upsert(cacheDataWithoutParsed, { onConflict: 'subreddit_name' });
    } else {
      throw error;
    }
  }
}
