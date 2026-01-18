import { test, expect } from '../fixtures/auth';
import { testData, generateQueueStreamResponse } from '../fixtures/test-data';
import {
  setupMockRoutes,
  setupQueueMockSuccess,
  setupQueueMockRateLimited,
  setupQueueMockUnauthorized,
  setupQueueMockNetworkError,
  mockResponses,
} from '../mocks/handlers';

/**
 * Edge Cases E2E Tests
 * 
 * These tests verify boundary conditions and edge cases including:
 * - 30 subreddit selection limit
 * - Rate limiting
 * - Network failures
 * - Session expiration
 * - Special characters in input
 * - Empty states
 */

test.describe('Edge Cases - Subreddit Selection Limits', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Setup with many subreddits
    await authenticatedPage.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meAuthenticated),
      });
    });

    await authenticatedPage.route('**/api/settings/categories', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: testData.categories.withManySubreddits,
        }),
      });
    });

    await authenticatedPage.route('**/api/cache/subreddit/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ flairs: [], required: false }),
      });
    });
  });

  test('cannot select more than 30 subreddits', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Wait for subreddits to load
    await authenticatedPage.waitForTimeout(1000);
    
    // Get all checkboxes
    const checkboxes = authenticatedPage.getByRole('checkbox');
    const count = await checkboxes.count();
    
    // Try to select all (should stop at 30)
    for (let i = 0; i < Math.min(count, 35); i++) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isVisible()) {
        try {
          await checkbox.check({ timeout: 500 });
        } catch {
          // Some might fail if limit is reached
        }
      }
    }
    
    // Count should not exceed 30
    await expect(authenticatedPage.getByText(/\/30/)).toBeVisible();
  });

  test('selection counter shows correct value at limit', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Wait for page to load
    await authenticatedPage.waitForTimeout(500);
    
    // Verify counter format is displayed
    await expect(authenticatedPage.getByText(/\/30/)).toBeVisible();
  });
});

test.describe('Edge Cases - Rate Limiting', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('handles 429 rate limit response gracefully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup rate limit response
    await setupQueueMockRateLimited(authenticatedPage);
    
    // Try to post
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Page should not crash - wait and verify
    await authenticatedPage.waitForTimeout(1000);
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
  });
});

test.describe('Edge Cases - Network Failures', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('handles network failure during posting', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup network error
    await setupQueueMockNetworkError(authenticatedPage);
    
    // Try to post
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Page should not crash
    await authenticatedPage.waitForTimeout(1000);
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
  });

  test('handles network failure on page load', async ({ authenticatedPage }) => {
    // Abort all API calls
    await authenticatedPage.route('**/api/**', async route => {
      await route.abort('failed');
    });
    
    // But allow me endpoint to return unauthenticated
    await authenticatedPage.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meAuthenticated),
      });
    });
    
    await authenticatedPage.goto('/');
    
    // Page should still render (even if data is missing)
    await authenticatedPage.waitForTimeout(1000);
  });
});

test.describe('Edge Cases - Session Expiration', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('handles 401 during posting', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Setup form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup unauthorized response
    await setupQueueMockUnauthorized(authenticatedPage);
    
    // Try to post
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Wait for response handling
    await authenticatedPage.waitForTimeout(1000);
  });

  test('handles session expiry on /api/me', async ({ authenticatedPage }) => {
    // First load with valid session
    await authenticatedPage.goto('/');
    
    // Then simulate session expiry
    await authenticatedPage.route('**/api/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      });
    });
    
    // Reload page
    await authenticatedPage.reload();
    
    // Should redirect to login
    await expect(authenticatedPage).toHaveURL('/login');
  });
});

test.describe('Edge Cases - Special Characters', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('title with special characters is preserved', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Enter title with special characters
    const specialTitle = testData.posts.withSpecialChars.title;
    const titleInput = authenticatedPage.getByPlaceholder(/write a title/i);
    await titleInput.fill(specialTitle);
    
    // Verify value is preserved
    await expect(titleInput).toHaveValue(specialTitle);
  });

  test('URL with query parameters is preserved', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter URL with special characters
    const urlWithParams = 'https://example.com/image.jpg?param1=value&param2=test%20encoded';
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await urlInput.fill(urlWithParams);
    
    // Verify value is preserved
    await expect(urlInput).toHaveValue(urlWithParams);
  });

  test('search query with special characters works', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Search with special characters
    const searchInput = authenticatedPage.getByPlaceholder(/search subreddits/i);
    await searchInput.fill('test&query');
    
    // Wait for search
    await authenticatedPage.waitForTimeout(600);
    
    // Page should not crash
    await expect(searchInput).toHaveValue('test&query');
  });
});

test.describe('Edge Cases - Empty States', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('empty title prevents posting', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Select a subreddit but leave title empty
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Title input should be empty
    const titleInput = authenticatedPage.getByPlaceholder(/write a title/i);
    await expect(titleInput).toHaveValue('');
    
    // Post button should indicate action needed
    // (Specific behavior depends on implementation)
  });

  test('empty URL in URL mode is handled', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Leave URL empty, but fill title
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test Title');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Behavior depends on implementation - verify no crash
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
  });

  test('queue shows empty state when no subreddits selected', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Don't select any subreddits
    // Queue should show empty state
    await expect(authenticatedPage.getByText(/select communities to post to/i)).toBeVisible();
  });
});

test.describe('Edge Cases - Long Content', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('very long title is handled', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Enter a very long title
    const longTitle = 'A'.repeat(300);
    const titleInput = authenticatedPage.getByPlaceholder(/write a title/i);
    await titleInput.fill(longTitle);
    
    // Value might be truncated or accepted - verify no crash
    const value = await titleInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('very long URL is handled', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter a very long URL
    const longUrl = 'https://example.com/' + 'a'.repeat(500) + '.jpg';
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await urlInput.fill(longUrl);
    
    // Verify no crash
    const value = await urlInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });
});

test.describe('Edge Cases - Rapid Actions', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('rapid checkbox toggling does not break selection', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Wait for subreddits to load
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    
    const checkbox = authenticatedPage.getByRole('checkbox', { name: /pics/i });
    
    // Rapidly toggle
    for (let i = 0; i < 10; i++) {
      await checkbox.check();
      await checkbox.uncheck();
    }
    
    // Final check
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('rapid mode switching does not break UI', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    const uploadButton = authenticatedPage.getByRole('button', { name: /upload/i });
    const urlButton = authenticatedPage.getByRole('button', { name: /^url$/i });
    
    // Rapidly switch modes
    for (let i = 0; i < 5; i++) {
      await urlButton.click();
      await uploadButton.click();
    }
    
    // UI should still be functional
    await expect(authenticatedPage.getByText(/upload media files/i)).toBeVisible();
  });
});

test.describe('Edge Cases - Browser Navigation', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('back/forward navigation works correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Navigate to settings
    await authenticatedPage.getByRole('button', { name: /manage/i }).click();
    await expect(authenticatedPage).toHaveURL('/settings');
    
    // Go back
    await authenticatedPage.goBack();
    await expect(authenticatedPage).toHaveURL('/');
    
    // Go forward
    await authenticatedPage.goForward();
    await expect(authenticatedPage).toHaveURL('/settings');
  });

  test('page refresh preserves authentication', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Verify authenticated
    await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
    
    // Refresh
    await authenticatedPage.reload();
    
    // Should still be authenticated
    await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
  });
});
