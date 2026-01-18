import { Page, Route } from '@playwright/test';
import { testData, generateQueueStreamResponse } from '../fixtures/test-data';

/**
 * Mock API response handlers for Playwright route interception.
 * These handlers provide deterministic responses for testing.
 */

/**
 * Pre-built mock responses for common API endpoints
 */
export const mockResponses = {
  /**
   * Mock response for /api/me endpoint - authenticated user
   */
  meAuthenticated: {
    authenticated: true,
    me: testData.users.standard,
    userId: testData.supabaseUsers.standard,
  },

  /**
   * Mock response for /api/me endpoint - unauthenticated user
   */
  meUnauthenticated: {
    authenticated: false,
  },

  /**
   * Mock response for /api/settings/categories endpoint
   */
  categoriesDefault: {
    categories: testData.categories.default,
  },

  /**
   * Mock response for /api/settings/categories endpoint - empty
   */
  categoriesEmpty: {
    categories: [],
  },

  /**
   * Mock response for /api/search-subreddits endpoint
   */
  searchSubreddits: (query: string) => ({
    subreddits: testData.searchResults.programming.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase())
    ),
  }),

  /**
   * Mock response for subreddit cache endpoint
   */
  subredditCache: (subredditName: string) => {
    const subreddit = Object.values(testData.subreddits).find(
      s => s.name.toLowerCase() === subredditName.toLowerCase()
    );
    
    if (subreddit) {
      return {
        flairs: subreddit.flairs,
        required: subreddit.required,
      };
    }
    
    return {
      flairs: [],
      required: false,
    };
  },
};

/**
 * Setup all mock routes for a fully mocked test environment.
 * This provides a consistent baseline for testing UI behavior.
 */
export const setupMockRoutes = async (page: Page): Promise<void> => {
  // Mock /api/me endpoint
  await page.route('**/api/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.meAuthenticated),
    });
  });

  // Mock /api/settings/categories endpoint
  await page.route('**/api/settings/categories', async (route: Route) => {
    const method = route.request().method();
    
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.categoriesDefault),
      });
    } else if (method === 'POST') {
      // Return a new category
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `cat-new-${Date.now()}`,
          name: 'New Category',
          position: testData.categories.default.length,
          collapsed: false,
          user_subreddits: [],
        }),
      });
    } else {
      await route.fulfill({ status: 200 });
    }
  });

  // Mock /api/settings/categories/:id endpoint
  await page.route('**/api/settings/categories/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock /api/settings/subreddits endpoint
  await page.route('**/api/settings/subreddits', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock /api/settings/subreddits/:id endpoint
  await page.route('**/api/settings/subreddits/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock /api/settings/reorder endpoint
  await page.route('**/api/settings/reorder', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock /api/search-subreddits endpoint
  await page.route('**/api/search-subreddits*', async (route: Route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') || '';
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.searchSubreddits(query)),
    });
  });

  // Mock /api/cache/subreddit/:name endpoint
  await page.route('**/api/cache/subreddit/*', async (route: Route) => {
    const url = new URL(route.request().url());
    const pathParts = url.pathname.split('/');
    const subredditName = pathParts[pathParts.length - 1];
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.subredditCache(subredditName)),
    });
  });

  // Mock /api/flairs endpoint
  await page.route('**/api/flairs*', async (route: Route) => {
    const url = new URL(route.request().url());
    const subreddit = url.searchParams.get('subreddit') || '';
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.subredditCache(subreddit)),
    });
  });

  // Mock /api/subreddit-post-requirements endpoint
  await page.route('**/api/subreddit-post-requirements*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        is_flair_required: false,
        title_text_max_length: 300,
        title_text_min_length: 1,
      }),
    });
  });

  // Mock /api/subreddit-rules endpoint
  await page.route('**/api/subreddit-rules*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        requiresGenderTag: false,
        requiresContentTag: false,
        genderTags: [],
        contentTags: [],
        rules: [],
        submitText: '',
      }),
    });
  });

  // Mock /api/auth/logout endpoint
  await page.route('**/api/auth/logout', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
};

/**
 * Setup mock for the posting queue endpoint with successful responses.
 */
export const setupQueueMockSuccess = async (
  page: Page,
  subreddits: string[] = ['pics', 'images']
): Promise<void> => {
  await page.route('**/api/queue', async (route: Route) => {
    const streamResponse = generateQueueStreamResponse(subreddits);
    
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamResponse,
    });
  });
};

/**
 * Setup mock for the posting queue endpoint with mixed results.
 */
export const setupQueueMockMixed = async (
  page: Page,
  subreddits: string[],
  outcomes: ('success' | 'error')[]
): Promise<void> => {
  await page.route('**/api/queue', async (route: Route) => {
    const streamResponse = generateQueueStreamResponse(subreddits, outcomes);
    
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamResponse,
    });
  });
};

/**
 * Setup mock for the posting queue endpoint that hangs (for cancellation tests).
 */
export const setupQueueMockHanging = async (page: Page): Promise<void> => {
  await page.route('**/api/queue', async (route: Route) => {
    // Send initial response then hang
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: JSON.stringify({ status: 'started', total: 3 }) + '\n',
    });
  });
};

/**
 * Setup mock for rate limited queue response.
 */
export const setupQueueMockRateLimited = async (page: Page): Promise<void> => {
  await page.route('**/api/queue', async (route: Route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Rate limited' }),
    });
  });
};

/**
 * Setup mock for unauthorized queue response.
 */
export const setupQueueMockUnauthorized = async (page: Page): Promise<void> => {
  await page.route('**/api/queue', async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });
};

/**
 * Setup mock for network failure.
 */
export const setupQueueMockNetworkError = async (page: Page): Promise<void> => {
  await page.route('**/api/queue', async (route: Route) => {
    await route.abort('failed');
  });
};
