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

type QueueOutcome = 'success' | 'error';

const DEFAULT_DEMO_JOB_ID = 'demo_job_1';

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
