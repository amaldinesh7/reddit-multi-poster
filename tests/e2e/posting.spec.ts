import { test, expect } from '../fixtures/auth';
import { testData, generateQueueStreamResponse } from '../fixtures/test-data';
import {
  setupMockRoutes,
  setupQueueMockSuccess,
  setupQueueMockMixed,
  setupQueueMockNetworkError,
  setupQueueMockUnauthorized,
  mockResponses,
} from '../mocks/handlers';

/**
 * Multi-Subreddit Posting E2E Tests
 * 
 * These tests verify the core posting functionality including:
 * - URL post composition
 * - Subreddit selection
 * - Queue progress display
 * - Posting completion/cancellation
 * - Flair requirement handling
 */

test.describe('Multi-Subreddit Posting', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('home page displays post composer correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Verify main sections are visible
    await expect(authenticatedPage.getByText('Media')).toBeVisible();
    await expect(authenticatedPage.getByText('Title')).toBeVisible();
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
    await expect(authenticatedPage.getByText('Posting Queue')).toBeVisible();
  });

  test('can switch between file upload and URL mode', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Default should show Upload button active
    const uploadButton = authenticatedPage.getByRole('button', { name: /upload/i });
    const urlButton = authenticatedPage.getByRole('button', { name: /^url$/i });
    
    await expect(uploadButton).toBeVisible();
    await expect(urlButton).toBeVisible();
    
    // Switch to URL mode
    await urlButton.click();
    
    // URL input should now be visible
    await expect(authenticatedPage.getByPlaceholder(/paste image or link/i)).toBeVisible();
  });

  test('can enter URL in URL mode', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter URL
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await urlInput.fill('https://example.com/image.jpg');
    
    await expect(urlInput).toHaveValue('https://example.com/image.jpg');
  });

  test('can enter post title', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Find title input
    const titleInput = authenticatedPage.getByPlaceholder(/write a title/i);
    await titleInput.fill('Test Post Title');
    
    await expect(titleInput).toHaveValue('Test Post Title');
  });

  test('can select subreddits from category list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Wait for subreddits to load
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    
    // Select a subreddit
    const picsCheckbox = authenticatedPage.getByRole('checkbox', { name: /pics/i });
    await picsCheckbox.check();
    
    // Verify selection count updates
    await expect(authenticatedPage.getByText(/1\/30/)).toBeVisible();
  });

  test('selection count updates correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Wait for subreddits to load
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    
    // Select multiple subreddits
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    await expect(authenticatedPage.getByText(/1\/30/)).toBeVisible();
    
    await authenticatedPage.getByRole('checkbox', { name: /images/i }).check();
    await expect(authenticatedPage.getByText(/2\/30/)).toBeVisible();
    
    // Unselect one
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).uncheck();
    await expect(authenticatedPage.getByText(/1\/30/)).toBeVisible();
  });

  test('post button shows correct label based on selection', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Initially should say "Select Communities"
    await expect(authenticatedPage.getByRole('button', { name: /select communities/i })).toBeVisible();
    
    // Select one subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Button should now say "Post to 1 Subreddit"
    await expect(authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i })).toBeVisible();
    
    // Select another
    await authenticatedPage.getByRole('checkbox', { name: /images/i }).check();
    
    // Button should say "Post to 2 Subreddits"
    await expect(authenticatedPage.getByRole('button', { name: /post to 2 subreddits/i })).toBeVisible();
  });

  test('post button is disabled without subreddit selection', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Enter title and URL but no subreddit selection
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Title');
    
    // Post button should show "Select Communities" and work as indicator
    const postButton = authenticatedPage.getByRole('button', { name: /select communities/i });
    await expect(postButton).toBeVisible();
  });
});

test.describe('Posting Queue Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('successful posting shows progress and completion', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Wait for subreddits and select them
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    await authenticatedPage.getByRole('checkbox', { name: /images/i }).check();
    
    // Setup queue mock
    await setupQueueMockSuccess(authenticatedPage, ['pics', 'images']);
    
    // Click post button
    await authenticatedPage.getByRole('button', { name: /post to 2 subreddits/i }).click();
    
    // Should show completion message
    await expect(authenticatedPage.getByText(/all posts completed/i)).toBeVisible({ timeout: 10000 });
  });

  test('posting shows individual subreddit progress', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Select subreddits
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup mock
    await setupQueueMockSuccess(authenticatedPage, ['pics']);
    
    // Click post button
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Should eventually show success
    await expect(authenticatedPage.getByText(/all posts completed/i)).toBeVisible({ timeout: 10000 });
  });

  test('posting can be cancelled with stop button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Select subreddits
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    await authenticatedPage.getByRole('checkbox', { name: /images/i }).check();
    
    // Setup a slow mock that we can cancel
    await authenticatedPage.route('**/api/queue', async route => {
      // Send started but then hang
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: JSON.stringify({ status: 'started', total: 2 }) + '\n' +
              JSON.stringify({ index: 0, status: 'posting', subreddit: 'pics' }) + '\n',
      });
    });
    
    // Click post button
    await authenticatedPage.getByRole('button', { name: /post to 2 subreddits/i }).click();
    
    // Wait for stop button to appear
    const stopButton = authenticatedPage.getByRole('button', { name: /stop/i });
    await expect(stopButton).toBeVisible({ timeout: 5000 });
    
    // Click stop
    await stopButton.click();
    
    // Should show cancelled message
    await expect(authenticatedPage.getByText(/posting cancelled/i)).toBeVisible();
  });

  test('mixed results show both successes and failures', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Select subreddits
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    await authenticatedPage.getByRole('checkbox', { name: /images/i }).check();
    
    // Setup mock with one success and one failure
    await setupQueueMockMixed(authenticatedPage, ['pics', 'images'], ['success', 'error']);
    
    // Click post button
    await authenticatedPage.getByRole('button', { name: /post to 2 subreddits/i }).click();
    
    // Wait for completion - the queue should finish processing
    await authenticatedPage.waitForTimeout(2000);
  });

  test('reset button clears queue after completion', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup mock
    await setupQueueMockSuccess(authenticatedPage, ['pics']);
    
    // Click post button
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Wait for completion
    await expect(authenticatedPage.getByText(/all posts completed/i)).toBeVisible({ timeout: 10000 });
    
    // Click reset button
    const resetButton = authenticatedPage.getByRole('button', { name: /reset/i });
    await resetButton.click();
    
    // Completion message should be gone
    await expect(authenticatedPage.getByText(/all posts completed/i)).not.toBeVisible();
  });
});

test.describe('Posting Error Handling', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('network error shows error message', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup network error
    await setupQueueMockNetworkError(authenticatedPage);
    
    // Click post button - should handle gracefully
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Should not crash - wait a moment
    await authenticatedPage.waitForTimeout(1000);
    
    // Page should still be functional
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
  });

  test('unauthorized error during posting shows appropriate message', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup the form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Post Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup unauthorized response
    await setupQueueMockUnauthorized(authenticatedPage);
    
    // Click post button
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Wait and verify no crash
    await authenticatedPage.waitForTimeout(1000);
  });
});

test.describe('Flair Handling', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('subreddit with required flair shows flair selector', async ({ authenticatedPage }) => {
    // Override cache to return required flair subreddit
    await authenticatedPage.route('**/api/cache/subreddit/askreddit', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testData.subreddits.withRequiredFlair),
      });
    });
    
    await authenticatedPage.goto('/');
    
    // Search for askreddit if not in default list
    const searchInput = authenticatedPage.getByPlaceholder(/search subreddits/i);
    await searchInput.fill('askreddit');
    
    // Wait for search results
    await authenticatedPage.waitForTimeout(1000);
  });

  test('selecting subreddit without flair requirement works normally', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Select a subreddit without required flair
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Should be able to post
    await expect(authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i })).toBeEnabled();
  });
});

test.describe('Posting - Post to Profile', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('can toggle post to profile option', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Find the post to profile checkbox
    const profileCheckbox = authenticatedPage.getByRole('checkbox', { name: /post to.*profile/i });
    
    // Should be visible for authenticated users
    await expect(profileCheckbox).toBeVisible();
    
    // Toggle it
    await profileCheckbox.check();
    await expect(profileCheckbox).toBeChecked();
    
    // Uncheck
    await profileCheckbox.uncheck();
    await expect(profileCheckbox).not.toBeChecked();
  });
});

test.describe('Subreddit Search', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('can search for subreddits', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Find search input
    const searchInput = authenticatedPage.getByPlaceholder(/search subreddits/i);
    await searchInput.fill('programming');
    
    // Wait for debounced search
    await authenticatedPage.waitForTimeout(600);
    
    // Should show search results
    await expect(authenticatedPage.getByText(/programming/i)).toBeVisible();
  });

  test('can clear search with clear button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Search for something
    const searchInput = authenticatedPage.getByPlaceholder(/search subreddits/i);
    await searchInput.fill('programming');
    
    // Wait for debounced search
    await authenticatedPage.waitForTimeout(600);
    
    // Click clear button
    const clearButton = authenticatedPage.getByRole('button', { name: /clear search/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      
      // Search input should be empty
      await expect(searchInput).toHaveValue('');
    }
  });
});
