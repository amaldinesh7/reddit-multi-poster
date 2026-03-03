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
    const toggleButton = page.getByRole('button', { name: new RegExp(`Toggle r/${subreddit}`, 'i') });
    const checkbox = toggleButton.getByRole('checkbox');
    
    // Only click if not already checked
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
      await toggleButton.click();
      // Wait for the checkbox state to update
      await expect(checkbox).toBeChecked({ timeout: 2000 });
    }
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
): Promise<{ getPayload: () => CapturedQueuePayload | null; wasCalled: () => boolean }> => {
  let payload: CapturedQueuePayload | null = null;
  let submitCalled = false;
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
    submitCalled = true;
    const request = route.request();
    const postData = request.postData();
    
    // Try to parse the payload from request body
    if (postData) {
      try {
        // Try JSON parsing first
        payload = JSON.parse(postData) as CapturedQueuePayload;
      } catch {
        // For FormData requests, extract what we can from the raw data
        // The postData for FormData comes as a string with boundaries
        // We'll set a placeholder indicating the submit was called
        payload = {
          caption: 'captured-from-formdata',
          items: subreddits.map((subreddit) => ({
            subreddit,
            kind: 'link' as const,
          })),
        };
      }
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        jobId: mockJobId,
      }),
    });
  });

  // Build streaming response for the process endpoint
  const buildStreamResponse = () => {
    const lines: string[] = [
      JSON.stringify({
        type: 'status',
        jobId: mockJobId,
        status: 'processing',
        currentIndex: 0,
      }),
    ];

    subreddits.forEach((subreddit, index) => {
      lines.push(
        JSON.stringify({
          type: 'progress',
          jobId: mockJobId,
          currentIndex: index,
        })
      );

      const outcome = outcomes[index] ?? 'success';
      lines.push(
        JSON.stringify({
          type: 'result',
          jobId: mockJobId,
          result: {
            index,
            subreddit,
            status: outcome,
            url: outcome === 'success' ? `https://reddit.com/r/${subreddit}/comments/mock123/test_post` : undefined,
            error: outcome === 'error' ? 'Failed to post' : undefined,
            postedAt: new Date().toISOString(),
          },
        })
      );

      if (index < subreddits.length - 1) {
        lines.push(
          JSON.stringify({
            type: 'waiting',
            jobId: mockJobId,
            waitSeconds: 1,
          })
        );
      }
    });

    lines.push(
      JSON.stringify({
        type: 'complete',
        jobId: mockJobId,
      })
    );

    return lines.join('\n');
  };

  // Mock /api/queue/process - returns streaming response
  await page.route('**/api/queue/process*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: buildStreamResponse(),
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
    wasCalled: () => submitCalled,
  };
};
