import { expect, Page, Route } from '@playwright/test';
import { testData } from '../fixtures/test-data';
import { setupMockRoutes } from '../mocks/handlers';

export interface QueuePayloadItem {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  customTitle?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
}

export interface CapturedQueuePayload {
  items: QueuePayloadItem[];
  caption: string;
  prefixes?: Record<string, unknown>;
}

export const setupFlowPage = async (page: Page): Promise<void> => {
  await setupMockRoutes(page);
  await page.goto('/');
  await expect(page.getByText('Communities')).toBeVisible();
  // Wait for categories to load (they appear collapsed by default)
  await expect(page.getByRole('button', { name: /General category/i })).toBeVisible({ timeout: 5000 });
  // Expand the General category to show subreddits like pics, images, gifs
  await page.getByRole('button', { name: /General category/i }).click();
  // Wait for subreddits to be visible after expansion
  await expect(page.getByText('pics')).toBeVisible({ timeout: 5000 });
};

export const fillCoreLinkPostForm = async (
  page: Page,
  title: string = testData.posts.simple.title,
  url: string = testData.posts.simple.url
): Promise<void> => {
  await page.getByRole('button', { name: /^url$/i }).click();
  await page
    .getByPlaceholder(/paste image or (video|link)/i)
    .fill(url);
  await page.getByPlaceholder(/(write a title|post title)/i).fill(title);
};

export const selectSubreddits = async (page: Page, subreddits: string[]): Promise<void> => {
  for (const subreddit of subreddits) {
    // The checkbox is nested inside a button labeled "Toggle r/{subreddit}"
    await page.getByRole('button', { name: new RegExp(`Toggle r/${subreddit}`, 'i') }).click();
  }
};

/**
 * Sets up mocks for the new job-based queue system.
 * 
 * The new queue flow:
 * 1. POST /api/queue/submit → returns { success: true, jobId: "..." }
 * 2. POST /api/queue/process?jobId=... → triggers processing
 * 3. GET /api/queue/status/{jobId} → polled for results
 */
export const setupQueueContractMock = async (
  page: Page,
  subreddits: string[],
  outcomes: ('success' | 'error')[]
): Promise<{ getPayload: () => CapturedQueuePayload | null }> => {
  let payload: CapturedQueuePayload | null = null;
  const mockJobId = `mock-job-${Date.now()}`;
  let pollCount = 0;

  // Generate results based on outcomes
  const generateResults = () => {
    return subreddits.map((subreddit, index) => ({
      index,
      subreddit,
      status: outcomes[index] || 'success',
      url: outcomes[index] === 'success' ? `https://reddit.com/r/${subreddit}/comments/mock123/test_post` : undefined,
      error: outcomes[index] === 'error' ? 'Failed to post' : undefined,
    }));
  };

  // Mock /api/queue/submit - captures payload and returns job ID
  await page.route('**/api/queue/submit', async (route: Route) => {
    // For FormData requests, we can't easily parse the payload, but we can still mock the response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        jobId: mockJobId,
      }),
    });
  });

  // Mock /api/queue/process - triggers processing
  await page.route('**/api/queue/process*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock /api/queue/status/{jobId} - returns job status and results
  // Simulate progression: first call = processing, second call = completed
  await page.route('**/api/queue/status/*', async (route: Route) => {
    pollCount++;
    const results = generateResults();
    
    // On first poll, return in-progress status; on subsequent polls, return completed
    const isCompleted = pollCount > 1;
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        job: {
          id: mockJobId,
          status: isCompleted ? 'completed' : 'processing',
          current_index: isCompleted ? subreddits.length : Math.min(pollCount, subreddits.length - 1),
          results: isCompleted ? results : results.slice(0, pollCount),
          items: subreddits.map((subreddit, index) => ({
            index,
            subreddit,
            kind: 'link',
          })),
        },
      }),
    });
  });

  return {
    getPayload: () => payload,
  };
};
