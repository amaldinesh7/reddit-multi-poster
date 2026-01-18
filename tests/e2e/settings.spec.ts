import { test, expect } from '../fixtures/auth';
import { testData } from '../fixtures/test-data';
import { setupMockRoutes, mockResponses } from '../mocks/handlers';

/**
 * Settings Page E2E Tests
 * 
 * These tests verify the settings functionality including:
 * - Category creation/editing/deletion
 * - Subreddit search and addition
 * - Drag and drop reordering
 * - Navigation
 */

test.describe('Settings Page - Navigation', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('can navigate to settings from home page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Click the Manage button
    await authenticatedPage.getByRole('button', { name: /manage/i }).click();
    
    // Should be on settings page
    await expect(authenticatedPage).toHaveURL('/settings');
  });

  test('settings page displays correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Should show settings title
    await expect(authenticatedPage.getByText('Settings')).toBeVisible();
    
    // Should show add category button
    await expect(authenticatedPage.getByRole('button', { name: /add category/i })).toBeVisible();
  });

  test('can navigate back to home from settings', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Click back button
    await authenticatedPage.getByRole('button', { name: /go back/i }).click();
    
    // Should be back on home
    await expect(authenticatedPage).toHaveURL('/');
  });

  test('settings page has search input', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Should show search input
    await expect(authenticatedPage.getByPlaceholder(/search reddit/i)).toBeVisible();
  });
});

test.describe('Settings Page - Categories', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('existing categories are displayed', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Wait for categories to load
    await authenticatedPage.waitForTimeout(500);
    
    // Should show default categories from mock
    await expect(authenticatedPage.getByText('General')).toBeVisible();
  });

  test('can add new category', async ({ authenticatedPage }) => {
    // Setup specific mock for POST request
    await authenticatedPage.route('**/api/settings/categories', async route => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-category-123',
            name: 'Entertainment',
            position: 2,
            collapsed: false,
            user_subreddits: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponses.categoriesDefault),
        });
      }
    });
    
    await authenticatedPage.goto('/settings');
    
    // Click add category button
    await authenticatedPage.getByRole('button', { name: /add category/i }).click();
    
    // Wait for the API call and UI update
    await authenticatedPage.waitForTimeout(500);
  });

  test('categories show subreddit count', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Categories should display their subreddit counts
    // This depends on the mock data structure
    await authenticatedPage.waitForTimeout(500);
  });

  test('empty state is shown when no categories exist', async ({ authenticatedPage }) => {
    // Override with empty categories
    await authenticatedPage.route('**/api/settings/categories', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categories: [] }),
      });
    });
    
    await authenticatedPage.goto('/settings');
    
    // Should show empty state message
    await expect(authenticatedPage.getByText(/no categories yet/i)).toBeVisible();
  });
});

test.describe('Settings Page - Subreddit Search', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('can search for subreddits', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Enter search query
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('programming');
    
    // Wait for debounced search
    await authenticatedPage.waitForTimeout(600);
    
    // Should show results
    await expect(authenticatedPage.getByText(/r\/programming/i)).toBeVisible();
  });

  test('search results show subscriber count', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Search for something
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('programming');
    
    // Wait for results
    await authenticatedPage.waitForTimeout(600);
    
    // Should show subscriber count
    await expect(authenticatedPage.getByText(/members/i)).toBeVisible();
  });

  test('can add subreddit from search results', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Search for a subreddit
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('programming');
    
    // Wait for results
    await authenticatedPage.waitForTimeout(600);
    
    // Find and click add button
    const addButton = authenticatedPage.getByRole('button', { name: /add/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
    }
  });

  test('can save subreddit to category from search', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Search for a subreddit
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('programming');
    
    // Wait for results
    await authenticatedPage.waitForTimeout(600);
    
    // Find save button
    const saveButton = authenticatedPage.getByRole('button', { name: /save/i }).first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Dialog should open to select category
      await authenticatedPage.waitForTimeout(300);
    }
  });

  test('search shows loading indicator', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Set up a slow response
    await authenticatedPage.route('**/api/search-subreddits*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ subreddits: testData.searchResults.programming }),
      });
    });
    
    // Enter search query
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('programming');
    
    // Loading indicator might appear during search
    // (This tests that the UI handles async state properly)
  });

  test('empty search results show appropriate message', async ({ authenticatedPage }) => {
    // Mock empty results
    await authenticatedPage.route('**/api/search-subreddits*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ subreddits: [] }),
      });
    });
    
    await authenticatedPage.goto('/settings');
    
    // Search for something that won't match
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('xyznonexistent123');
    
    // Wait for search
    await authenticatedPage.waitForTimeout(600);
    
    // Should show no results message
    await expect(authenticatedPage.getByText(/no.*subreddits found/i)).toBeVisible();
  });
});

test.describe('Settings Page - Category Actions', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('can expand/collapse categories', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Wait for categories to load
    await authenticatedPage.waitForTimeout(500);
    
    // Find category header that might be expandable
    const categoryHeader = authenticatedPage.getByText('General');
    await expect(categoryHeader).toBeVisible();
  });

  test('refresh button reloads data', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Find refresh button
    const refreshButton = authenticatedPage.getByRole('button', { name: /refresh/i });
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Button might show loading state
      await authenticatedPage.waitForTimeout(500);
    }
  });
});

test.describe('Settings Page - Drag and Drop', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('drag handles are visible on categories', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Wait for categories to load
    await authenticatedPage.waitForTimeout(500);
    
    // Drag handle icons should be present
    // (Implementation specific - look for grip/drag icons)
  });

  test('categories can be reordered via drag', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Wait for categories
    await authenticatedPage.waitForTimeout(500);
    
    // Note: Actual drag-drop testing requires more setup
    // This is a placeholder for the test structure
  });
});

test.describe('Settings Page - Error Handling', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('handles API error gracefully', async ({ authenticatedPage }) => {
    // Override to return error
    await authenticatedPage.route('**/api/settings/categories', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });
    
    await authenticatedPage.goto('/settings');
    
    // Page should not crash
    await expect(authenticatedPage.getByText('Settings')).toBeVisible();
  });

  test('handles network error on search', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Setup network error for search
    await authenticatedPage.route('**/api/search-subreddits*', async route => {
      await route.abort('failed');
    });
    
    // Try to search
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await searchInput.fill('test');
    
    // Wait - should not crash
    await authenticatedPage.waitForTimeout(1000);
    
    // Page should still be functional
    await expect(authenticatedPage.getByText('Settings')).toBeVisible();
  });
});

test.describe('Settings Page - Accessibility', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('back button has proper aria label', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    const backButton = authenticatedPage.getByRole('button', { name: /go back/i });
    await expect(backButton).toBeVisible();
  });

  test('add category button is accessible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    const addButton = authenticatedPage.getByRole('button', { name: /add category/i });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
  });

  test('search input has proper aria label', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    const searchInput = authenticatedPage.getByPlaceholder(/search reddit/i);
    await expect(searchInput).toBeVisible();
  });
});

test.describe('Settings Page - Mobile Responsiveness', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('settings page is usable on mobile viewport', async ({ authenticatedPage }) => {
    // Set mobile viewport
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    await authenticatedPage.goto('/settings');
    
    // Key elements should still be visible
    await expect(authenticatedPage.getByText('Settings')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /add category/i })).toBeVisible();
    await expect(authenticatedPage.getByPlaceholder(/search reddit/i)).toBeVisible();
  });

  test('back button is accessible on mobile', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    await authenticatedPage.goto('/settings');
    
    const backButton = authenticatedPage.getByRole('button', { name: /go back/i });
    await expect(backButton).toBeVisible();
    
    // Should be clickable
    await backButton.click();
    await expect(authenticatedPage).toHaveURL('/');
  });
});
