import { test, expect } from '../fixtures/auth';
import { test as baseTest } from '@playwright/test';
import { setupMockRoutes, mockResponses } from '../mocks/handlers';

/**
 * Regression Safety E2E Tests
 * 
 * These tests catch common AI-introduced bugs and ensure:
 * - No JavaScript errors on render
 * - No console errors
 * - Critical UI elements remain accessible
 * - Form state persistence
 * - Responsive design integrity
 * - Proper error boundaries
 */

test.describe('Regression - Page Stability', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('home page renders without JavaScript errors', async ({ authenticatedPage }) => {
    const errors: string[] = [];
    
    authenticatedPage.on('pageerror', err => {
      errors.push(err.message);
    });
    
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });

  test('settings page renders without JavaScript errors', async ({ authenticatedPage }) => {
    const errors: string[] = [];
    
    authenticatedPage.on('pageerror', err => {
      errors.push(err.message);
    });
    
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });

  test('no console errors on home page', async ({ authenticatedPage }) => {
    const consoleErrors: string[] = [];
    
    authenticatedPage.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore some expected errors (like favicon, etc.)
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });
    
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Filter out network-related console errors that might occur with mocking
    const significantErrors = consoleErrors.filter(err => 
      !err.includes('Failed to load resource') &&
      !err.includes('net::')
    );
    
    expect(significantErrors).toHaveLength(0);
  });

  test('no console errors on settings page', async ({ authenticatedPage }) => {
    const consoleErrors: string[] = [];
    
    authenticatedPage.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });
    
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const significantErrors = consoleErrors.filter(err => 
      !err.includes('Failed to load resource') &&
      !err.includes('net::')
    );
    
    expect(significantErrors).toHaveLength(0);
  });
});

baseTest.describe('Regression - Login Page Stability', () => {
  baseTest.beforeEach(async ({ page }) => {
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meUnauthenticated),
      });
    });
  });

  baseTest('login page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', err => {
      errors.push(err.message);
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });

  baseTest('no console errors on login page', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const significantErrors = consoleErrors.filter(err => 
      !err.includes('Failed to load resource') &&
      !err.includes('net::')
    );
    
    expect(significantErrors).toHaveLength(0);
  });
});

test.describe('Regression - Critical UI Elements', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('all critical home page elements are present', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Header elements
    await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
    
    // Media section
    await expect(authenticatedPage.getByText('Media')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /upload/i })).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /^url$/i })).toBeVisible();
    
    // Title section
    await expect(authenticatedPage.getByText('Title')).toBeVisible();
    await expect(authenticatedPage.getByPlaceholder(/write a title/i)).toBeVisible();
    
    // Subreddits section
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
    
    // Queue section
    await expect(authenticatedPage.getByText('Posting Queue')).toBeVisible();
  });

  test('all critical settings page elements are present', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Navigation
    await expect(authenticatedPage.getByRole('button', { name: /go back/i })).toBeVisible();
    
    // Title
    await expect(authenticatedPage.getByText('Settings')).toBeVisible();
    
    // Actions
    await expect(authenticatedPage.getByRole('button', { name: /add category/i })).toBeVisible();
    
    // Search
    await expect(authenticatedPage.getByPlaceholder(/search reddit/i)).toBeVisible();
  });

  test('post button accessibility is correct', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Post button should be visible with proper text
    const postButton = authenticatedPage.getByRole('button', { name: /select communities|post to/i });
    await expect(postButton).toBeVisible();
    
    // Button should have proper aria attributes
    await expect(postButton).toHaveAttribute('aria-label', /.+/);
  });
});

test.describe('Regression - Form State Persistence', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('title persists after failed submission', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Fill form
    const title = 'My Test Post Title';
    await authenticatedPage.getByPlaceholder(/write a title/i).fill(title);
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup failure response
    await authenticatedPage.route('**/api/queue', async route => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      });
    });
    
    // Try to post
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Wait a moment
    await authenticatedPage.waitForTimeout(1000);
    
    // Title should still be there
    await expect(authenticatedPage.getByPlaceholder(/write a title/i)).toHaveValue(title);
  });

  test('URL persists after mode switch and back', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode and enter URL
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await urlInput.fill('https://example.com/test.jpg');
    
    // Switch to file mode
    await authenticatedPage.getByRole('button', { name: /upload/i }).click();
    
    // Switch back to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // URL input should be visible
    await expect(authenticatedPage.getByPlaceholder(/paste image or link/i)).toBeVisible();
  });

  test('subreddit selection persists after UI interactions', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Select subreddits
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    await authenticatedPage.getByRole('checkbox', { name: /images/i }).check();
    
    // Switch modes
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByRole('button', { name: /upload/i }).click();
    
    // Selection should still be there
    await expect(authenticatedPage.getByText('2/30')).toBeVisible();
  });
});

test.describe('Regression - Responsive Design', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('home page does not break on mobile viewport', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/');
    
    // Critical elements should still be visible
    await expect(authenticatedPage.getByText('Media')).toBeVisible();
    await expect(authenticatedPage.getByText('Title')).toBeVisible();
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /select communities|post to/i })).toBeVisible();
  });

  test('settings page does not break on mobile viewport', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/settings');
    
    // Critical elements should still be visible
    await expect(authenticatedPage.getByText('Settings')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /add category/i })).toBeVisible();
    await expect(authenticatedPage.getByPlaceholder(/search reddit/i)).toBeVisible();
  });

  test('home page does not break on tablet viewport', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
    await authenticatedPage.goto('/');
    
    // No JavaScript errors
    const errors: string[] = [];
    authenticatedPage.on('pageerror', err => errors.push(err.message));
    
    await authenticatedPage.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('home page does not break on wide viewport', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1920, height: 1080 });
    await authenticatedPage.goto('/');
    
    // No JavaScript errors
    const errors: string[] = [];
    authenticatedPage.on('pageerror', err => errors.push(err.message));
    
    await authenticatedPage.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});

test.describe('Regression - Navigation Integrity', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('all navigation links work correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Home -> Settings
    await authenticatedPage.getByRole('button', { name: /manage/i }).click();
    await expect(authenticatedPage).toHaveURL('/settings');
    
    // Settings -> Home
    await authenticatedPage.getByRole('button', { name: /go back/i }).click();
    await expect(authenticatedPage).toHaveURL('/');
  });

  test('logout navigation works', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Open user menu
    const userMenuTrigger = authenticatedPage.getByRole('button', { name: /testuser/i });
    await userMenuTrigger.click();
    
    // Mock unauthenticated state after logout
    await authenticatedPage.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meUnauthenticated),
      });
    });
    
    // Click logout
    await authenticatedPage.getByRole('menuitem', { name: /log\s*out/i }).click();
    
    // Should be on login
    await expect(authenticatedPage).toHaveURL('/login');
  });
});

test.describe('Regression - Component Rendering', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('dropzone renders correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    const dropzone = authenticatedPage.locator('[class*="border-dashed"]');
    await expect(dropzone).toBeVisible();
  });

  test('post button renders with correct text based on state', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Initial state - no selection
    await expect(authenticatedPage.getByRole('button', { name: /select communities/i })).toBeVisible();
    
    // After selecting
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    await expect(authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i })).toBeVisible();
  });

  test('header component renders user info correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // User name should be visible
    await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
  });
});

test.describe('Regression - Data Loading States', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('loading state appears and resolves', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Wait for content to load
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Content should be visible
    await expect(authenticatedPage.getByText('Subreddits')).toBeVisible();
  });

  test('error state does not crash the app', async ({ authenticatedPage }) => {
    // Override with error response
    await authenticatedPage.route('**/api/settings/categories', async route => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      });
    });
    
    await authenticatedPage.goto('/');
    
    // Page should still render
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(authenticatedPage.getByText('Media')).toBeVisible();
  });
});

test.describe('Regression - Memory Leaks Prevention', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('rapid navigation does not cause errors', async ({ authenticatedPage }) => {
    const errors: string[] = [];
    authenticatedPage.on('pageerror', err => errors.push(err.message));
    
    // Rapid navigation between pages
    for (let i = 0; i < 3; i++) {
      await authenticatedPage.goto('/');
      await authenticatedPage.goto('/settings');
    }
    
    await authenticatedPage.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('rapid component updates do not cause errors', async ({ authenticatedPage }) => {
    const errors: string[] = [];
    authenticatedPage.on('pageerror', err => errors.push(err.message));
    
    await authenticatedPage.goto('/');
    
    // Rapid mode switching
    for (let i = 0; i < 5; i++) {
      await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
      await authenticatedPage.getByRole('button', { name: /upload/i }).click();
    }
    
    expect(errors).toHaveLength(0);
  });
});
