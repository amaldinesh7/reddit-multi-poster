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
   * Mock response for /api/settings/categories endpoint (matches real API shape)
   */
  categoriesDefault: {
    success: true,
    data: testData.categories.default,
  },

  /**
   * Mock response for /api/settings/categories endpoint - empty
   */
  categoriesEmpty: {
    success: true,
    data: [],
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
  generateCopy: (kind: 'title' | 'description') => ({
    success: true,
    data: {
      options:
        kind === 'title'
          ? [
              'AI title option one',
              'AI title option two',
              'AI title option three',
            ]
          : [
              'AI description option one',
              'AI description option two',
              'AI description option three',
            ],
      provider: 'fallback',
      fallbackUsed: true,
    },
  }),
};

type QueueOutcome = 'success' | 'error';

const DEFAULT_DEMO_JOB_ID = 'demo_job_1';
const NEW_CATEGORY_FALLBACK_NAME = 'New Category';

interface MockSubreddit {
  id: string;
  subreddit_name: string;
  position: number;
  category_id: string;
}

interface MockCategory {
  id: string;
  name: string;
  position: number;
  collapsed: boolean;
  user_subreddits: MockSubreddit[];
}

interface MockApiError {
  code: string;
  message: string;
}

const cloneInitialCategories = (): MockCategory[] => {
  return testData.categories.default.map((category) => ({
    id: category.id,
    name: category.name,
    position: category.position,
    collapsed: category.collapsed,
    user_subreddits: category.user_subreddits.map((subreddit) => ({
      id: subreddit.id,
      subreddit_name: subreddit.subreddit_name,
      position: subreddit.position,
      category_id: subreddit.category_id,
    })),
  }));
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
};

const fulfillApiError = async (
  route: Route,
  status: number,
  error: MockApiError
): Promise<void> => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error }),
  });
};

const normalizeSubredditName = (value: string): string =>
  value.trim().replace(/^r\//i, '').toLowerCase();

const buildQueueProcessStreamResponse = (
  subreddits: string[],
  outcomes: QueueOutcome[] = [],
  jobId: string = DEFAULT_DEMO_JOB_ID
): string => {
  const lines: string[] = [
    JSON.stringify({
      type: 'status',
      jobId,
      status: 'processing',
      currentIndex: 0,
    }),
  ];

  subreddits.forEach((subreddit, index) => {
    lines.push(
      JSON.stringify({
        type: 'progress',
        jobId,
        currentIndex: index,
      })
    );

    const outcome = outcomes[index] ?? 'success';
    if (outcome === 'success') {
      lines.push(
        JSON.stringify({
          type: 'result',
          jobId,
          result: {
            index,
            subreddit,
            status: 'success',
            url: `https://reddit.com/r/${subreddit}/comments/test${index}`,
            postedAt: new Date().toISOString(),
          },
        })
      );
    } else {
      lines.push(
        JSON.stringify({
          type: 'result',
          jobId,
          result: {
            index,
            subreddit,
            status: 'error',
            error: 'Post failed',
          },
        })
      );
    }

    if (index < subreddits.length - 1) {
      lines.push(
        JSON.stringify({
          type: 'waiting',
          jobId,
          waitSeconds: 2,
        })
      );
    }
  });

  lines.push(
    JSON.stringify({
      type: 'complete',
      jobId,
    })
  );

  return lines.join('\n');
};

/**
 * Setup all mock routes for a fully mocked test environment.
 * This provides a consistent baseline for testing UI behavior.
 */
export const setupMockRoutes = async (page: Page): Promise<void> => {
  const categoriesState = cloneInitialCategories();
  let categoryCounter = 0;
  let subredditCounter = 0;

  // Mock /api/me endpoint
  await page.route('**/api/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.meAuthenticated),
    });
  });

  // Mock /api/admin-check endpoint
  await page.route('**/api/admin-check', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isAdmin: false }),
    });
  });

  // Mock /api/pricing endpoint
  await page.route('**/api/pricing', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pricing: {
          region: 'us_canada',
          amount: 9,
          currency: 'USD',
          formatted: '$9.00',
        },
      }),
    });
  });

  // Mock /api/settings/categories endpoint
  await page.route('**/api/settings/categories', async (route: Route) => {
    const method = route.request().method();
    
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: categoriesState,
        }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON() as { name?: string } | null;
      const requestedName = typeof body?.name === 'string' ? body.name.trim() : '';
      const name = requestedName || NEW_CATEGORY_FALLBACK_NAME;

      const nextPosition =
        categoriesState.length > 0
          ? Math.max(...categoriesState.map((category) => category.position)) + 1
          : 0;
      categoryCounter += 1;

      const newCategory: MockCategory = {
        id: `cat-new-${Date.now()}-${categoryCounter}`,
        name,
        position: nextPosition,
        collapsed: false,
        user_subreddits: [],
      };
      categoriesState.push(newCategory);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: newCategory,
        }),
      });
    } else {
      await fulfillApiError(route, 405, {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${method} not allowed`,
      });
    }
  });

  // Mock /api/settings/categories/:id endpoint
  await page.route('**/api/settings/categories/*', async (route: Route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const categoryId = url.pathname.split('/').pop();

    if (!categoryId) {
      await fulfillApiError(route, 400, {
        code: 'INVALID_INPUT',
        message: 'Category ID is required',
      });
      return;
    }

    const category = categoriesState.find((entry) => entry.id === categoryId);
    if (!category) {
      await fulfillApiError(route, 404, {
        code: 'NOT_FOUND',
        message: 'Category not found',
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON() as {
        name?: string;
        position?: number;
        collapsed?: boolean;
      } | null;
      const updates: Partial<MockCategory> = {};
      if (typeof body?.name === 'string' && body.name.trim().length > 0) {
        updates.name = body.name.trim();
      }
      if (typeof body?.position === 'number') {
        updates.position = body.position;
      }
      if (typeof body?.collapsed === 'boolean') {
        updates.collapsed = body.collapsed;
      }

      Object.assign(category, updates);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: category }),
      });
      return;
    }

    if (method === 'DELETE') {
      const categoryIndex = categoriesState.findIndex((entry) => entry.id === categoryId);
      if (categoryIndex >= 0) {
        categoriesState.splice(categoryIndex, 1);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { deleted: true } }),
      });
      return;
    }

    await fulfillApiError(route, 405, {
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${method} not allowed`,
    });
  });

  // Mock /api/settings/subreddits endpoint
  await page.route('**/api/settings/subreddits', async (route: Route) => {
    const method = route.request().method();

    if (method !== 'POST') {
      await fulfillApiError(route, 405, {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${method} not allowed`,
      });
      return;
    }

    const body = route.request().postDataJSON() as {
      category_id?: string;
      subreddit_name?: string;
    } | null;
    const categoryId = body?.category_id;
    const subredditName = typeof body?.subreddit_name === 'string' ? body.subreddit_name : '';

    if (!categoryId || !subredditName.trim()) {
      await fulfillApiError(route, 400, {
        code: 'INVALID_INPUT',
        message: 'category_id and subreddit_name are required',
      });
      return;
    }

    const targetCategory = categoriesState.find((category) => category.id === categoryId);
    if (!targetCategory) {
      await fulfillApiError(route, 404, {
        code: 'NOT_FOUND',
        message: 'Category not found',
      });
      return;
    }

    const normalizedName = normalizeSubredditName(subredditName);
    const duplicate = categoriesState.some((category) =>
      category.user_subreddits.some(
        (subreddit) => normalizeSubredditName(subreddit.subreddit_name) === normalizedName
      )
    );
    if (duplicate) {
      await fulfillApiError(route, 409, {
        code: 'DUPLICATE_SUBREDDIT',
        message: `r/${normalizedName} is already in your lists`,
      });
      return;
    }

    const nextPosition =
      targetCategory.user_subreddits.length > 0
        ? Math.max(...targetCategory.user_subreddits.map((subreddit) => subreddit.position)) + 1
        : 0;
    subredditCounter += 1;

    const newSubreddit: MockSubreddit = {
      id: `sub-new-${Date.now()}-${subredditCounter}`,
      subreddit_name: normalizedName,
      position: nextPosition,
      category_id: categoryId,
    };
    targetCategory.user_subreddits.push(newSubreddit);

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: newSubreddit }),
    });
  });

  // Mock /api/settings/subreddits/:id endpoint
  await page.route('**/api/settings/subreddits/*', async (route: Route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const subredditId = url.pathname.split('/').pop();

    if (!subredditId) {
      await fulfillApiError(route, 400, {
        code: 'INVALID_INPUT',
        message: 'Subreddit ID is required',
      });
      return;
    }

    let sourceCategory: MockCategory | undefined;
    let subredditIndex = -1;
    for (const category of categoriesState) {
      const index = category.user_subreddits.findIndex((entry) => entry.id === subredditId);
      if (index >= 0) {
        sourceCategory = category;
        subredditIndex = index;
        break;
      }
    }

    if (!sourceCategory || subredditIndex < 0) {
      await fulfillApiError(route, 404, {
        code: 'NOT_FOUND',
        message: 'Subreddit not found',
      });
      return;
    }

    const currentSubreddit = sourceCategory.user_subreddits[subredditIndex];

    if (method === 'PUT') {
      const body = route.request().postDataJSON() as {
        subreddit_name?: string;
        position?: number;
        category_id?: string;
      } | null;

      if (typeof body?.subreddit_name === 'string' && body.subreddit_name.trim().length > 0) {
        currentSubreddit.subreddit_name = normalizeSubredditName(body.subreddit_name);
      }
      if (typeof body?.position === 'number') {
        currentSubreddit.position = body.position;
      }
      if (typeof body?.category_id === 'string' && body.category_id !== sourceCategory.id) {
        const nextCategory = categoriesState.find((category) => category.id === body.category_id);
        if (!nextCategory) {
          await fulfillApiError(route, 403, {
            code: 'FORBIDDEN',
            message: 'Cannot move to that category',
          });
          return;
        }

        sourceCategory.user_subreddits.splice(subredditIndex, 1);
        currentSubreddit.category_id = nextCategory.id;
        currentSubreddit.position = nextCategory.user_subreddits.length;
        nextCategory.user_subreddits.push(currentSubreddit);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: currentSubreddit }),
      });
      return;
    }

    if (method === 'DELETE') {
      sourceCategory.user_subreddits.splice(subredditIndex, 1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { deleted: true } }),
      });
      return;
    }

    await fulfillApiError(route, 405, {
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${method} not allowed`,
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
    
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchSubreddits(query)),
      });
    } catch (error) {
      await fulfillApiError(route, 500, {
        code: 'INTERNAL_ERROR',
        message: getErrorMessage(error, 'Failed to fetch search results'),
      });
    }
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

  // Mock /api/reddit/subreddit-info endpoint
  await page.route('**/api/reddit/subreddit-info*', async (route: Route) => {
    const url = new URL(route.request().url());
    const subreddit = (url.searchParams.get('name') || '').replace(/^r\//i, '').toLowerCase();
    const cache = mockResponses.subredditCache(subreddit);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          subreddit,
          flairs: cache.flairs,
          flairRequired: cache.required,
          rules: {
            requiresGenderTag: false,
            requiresContentTag: false,
            genderTags: [],
            contentTags: [],
            rules: [],
            submitText: '',
          },
          titleTags: [],
          postRequirements: {
            is_flair_required: cache.required,
            title_text_max_length: 300,
            title_text_min_length: 1,
          },
          subredditType: 'public',
          restrictPosting: false,
          submissionType: 'any',
          allowImages: true,
          allowVideos: true,
          allowGifs: true,
          cachedAt: new Date().toISOString(),
          cacheVersion: 1,
        },
      }),
    });
  });

  // Default cancel endpoint for stop-flow tests.
  await page.route('**/api/queue/cancel/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
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

  // Mock /api/ai/generate-copy endpoint
  await page.route('**/api/ai/generate-copy', async (route: Route) => {
    const body = route.request().postDataJSON() as { kind?: 'title' | 'description' } | null;
    const kind = body?.kind === 'description' ? 'description' : 'title';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.generateCopy(kind)),
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
  await page.route('**/api/queue/submit', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, jobId: DEFAULT_DEMO_JOB_ID }),
    });
  });

  await page.route('**/api/queue/process*', async (route: Route) => {
    const streamResponse = buildQueueProcessStreamResponse(subreddits, [], DEFAULT_DEMO_JOB_ID);
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamResponse,
    });
  });

  // Backwards compatibility for tests that still mock or call /api/queue directly.
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
  await page.route('**/api/queue/submit', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, jobId: DEFAULT_DEMO_JOB_ID }),
    });
  });

  await page.route('**/api/queue/process*', async (route: Route) => {
    const streamResponse = buildQueueProcessStreamResponse(subreddits, outcomes, DEFAULT_DEMO_JOB_ID);
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamResponse,
    });
  });

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
  await page.route('**/api/queue/submit', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, jobId: DEFAULT_DEMO_JOB_ID }),
    });
  });

  await page.route('**/api/queue/process*', async (route: Route) => {
    const streamResponse =
      JSON.stringify({
        type: 'status',
        jobId: DEFAULT_DEMO_JOB_ID,
        status: 'processing',
        currentIndex: 0,
      }) +
      '\n' +
      JSON.stringify({
        type: 'progress',
        jobId: DEFAULT_DEMO_JOB_ID,
        currentIndex: 0,
      }) +
      '\n';

    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamResponse,
    });
  });

  await page.route('**/api/queue', async (route: Route) => {
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
  await page.route('**/api/queue/submit', async (route: Route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Rate limited' }),
    });
  });

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
  await page.route('**/api/queue/submit', async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    });
  });

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
  await page.route('**/api/queue/submit', async (route: Route) => {
    await route.abort('failed');
  });

  await page.route('**/api/queue', async (route: Route) => {
    await route.abort('failed');
  });
};
