import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { redditClient, refreshAccessToken } from '../../utils/reddit';
import { serialize } from 'cookie';
import { addApiBreadcrumb, handleRedditApiError } from '../../lib/apiErrorHandler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const { q, limit = '4' } = req.query as { q?: string; limit?: string };
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  
  let access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  
  try {
    if (!access && refresh) {
      addApiBreadcrumb('Refreshing access token');
      const t = await refreshAccessToken(refresh);
      access = t.access_token;
      res.setHeader('Set-Cookie', serialize('reddit_access', access, { 
        path: '/', 
        httpOnly: true, 
        sameSite: 'lax', 
        maxAge: t.expires_in - 10 
      }));
    }
    
    if (!access) return res.status(401).json({ error: 'Unauthorized' });
    
    const client = redditClient(access);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let subreddits: any[] = [];
    
    // Validate and clamp limit
    const DEFAULT_LIMIT = 25;
    const MAX_LIMIT = 100;
    let parsedLimit = parseInt(limit as string, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      parsedLimit = DEFAULT_LIMIT;
    } else if (parsedLimit > MAX_LIMIT) {
      parsedLimit = MAX_LIMIT;
    }
    
    // Sanitize search query: trim, validate characters, and prepare for URL usage
    const rawSearchQuery = q.trim();
    // Reject queries containing path traversal sequences or invalid characters for subreddit names
    // Valid subreddit names contain only alphanumeric characters and underscores
    const sanitizedSearchQuery = rawSearchQuery.replace(/[^a-zA-Z0-9_\s-]/g, '');
    if (sanitizedSearchQuery.length < 2) {
      return res.status(400).json({ error: 'Query contains invalid characters' });
    }
    const searchQuery = sanitizedSearchQuery;
    
    try {
      // Try multiple search approaches
      const searchMethods = [
        // Method 1: Standard subreddit search (relevance)
        {
          endpoint: '/subreddits/search',
          params: {
            q: searchQuery,
            type: 'sr',
            limit: parsedLimit,
            include_over_18: 'on',
            sort: 'relevance',
            raw_json: 1
          }
        },
        // Method 2: Search with activity sort
        {
          endpoint: '/subreddits/search',
          params: {
            q: searchQuery,
            limit: parsedLimit,
            include_over_18: 'on',
            sort: 'activity',
            raw_json: 1
          }
        },
        // Method 3: Autocomplete-style search (prefix matching)
        {
          endpoint: '/api/subreddit_autocomplete_v2',
          params: {
            query: searchQuery,
            limit: parsedLimit,
            include_over_18: true,
            include_profiles: false,
            typeahead_active: true,
            raw_json: 1
          }
        }
      ];
      
      for (const method of searchMethods) {
        try {
          addApiBreadcrumb('Trying search method', { endpoint: method.endpoint });
          const response = await client.get(method.endpoint, { params: method.params });
          
          // Handle autocomplete response format (different structure)
          if (method.endpoint.includes('autocomplete') && response.data?.data?.children?.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subreddits = response.data.data.children.map((child: any) => ({
              name: child.data.display_name,
              title: child.data.title || child.data.display_name,
              description: child.data.public_description || child.data.description || '',
              subscribers: child.data.subscribers || 0,
              over18: child.data.over18 || false,
              icon: child.data.icon_img || child.data.community_icon || '',
              url: `https://reddit.com${child.data.url || `/r/${child.data.display_name}`}`
            }));
            
            addApiBreadcrumb('Subreddits found via autocomplete', { count: subreddits.length });
            break;
          }
          
          if (response.data?.data?.children?.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subreddits = response.data.data.children.map((child: any) => ({
              name: child.data.display_name,
              title: child.data.title || child.data.display_name,
              description: child.data.public_description || child.data.description || '',
              subscribers: child.data.subscribers || 0,
              over18: child.data.over18 || false,
              icon: child.data.icon_img || child.data.community_icon || '',
              url: `https://reddit.com${child.data.url}`
            }));
            
            addApiBreadcrumb('Subreddits found', { count: subreddits.length });
            break; // Stop if we found results
          }
        } catch {
          // Try next method
          continue;
        }
      }
      
      // If no results found, try direct subreddit check
      if (subreddits.length === 0) {
        try {
          // Use encodeURIComponent to ensure the subreddit name is safely URL-encoded
          const encodedSubreddit = encodeURIComponent(searchQuery);
          addApiBreadcrumb('Trying direct subreddit check', { query: searchQuery });
          const directResponse = await client.get(`/r/${encodedSubreddit}/about`, { params: { raw_json: 1 } });
          
          if (directResponse.data?.data) {
            const subData = directResponse.data.data;
            subreddits = [{
              name: subData.display_name,
              title: subData.title || subData.display_name,
              description: subData.public_description || subData.description || '',
              subscribers: subData.subscribers || 0,
              over18: subData.over18 || false,
              icon: subData.icon_img || subData.community_icon || '',
              url: `https://reddit.com${subData.url}`
            }];
            addApiBreadcrumb('Found via direct check', { name: subData.display_name });
          }
        } catch {
          addApiBreadcrumb('Direct subreddit check failed', {}, 'warning');
        }
      }
      
    } catch (searchError) {
      addApiBreadcrumb('All search methods failed', {}, 'warning');
      Sentry.captureException(searchError, {
        tags: { component: 'search-subreddits' },
        extra: { query: q },
      });
    }
    
    res.status(200).json({ subreddits });
  } catch (e: unknown) {
    return handleRedditApiError(req, res, e, 'searchSubreddits');
  }
} 