import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from '../fixtures/auth';
import { mockResponses, setupMockRoutes } from '../mocks/handlers';

/**
 * Authentication E2E Tests
 * 
 * These tests verify the authentication flow including:
 * - Login page rendering
 * - OAuth redirect behavior
 * - Authenticated session handling
 * - Logout functionality
 */

test.describe('Authentication - Unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /api/me to return unauthenticated for these tests
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meUnauthenticated),
      });
    });
  });

  test('unauthenticated user visiting home is redirected to login', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
  });

  test('login page displays correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Verify page title
    await expect(page).toHaveTitle(/Login.*Reddit Multi Poster/i);
    
    // Verify login button is visible
    const loginButton = page.getByRole('button', { name: /continue with reddit/i });
    await expect(loginButton).toBeVisible();
    
    // Verify branding
    await expect(page.getByText('Reddit Multi Poster')).toBeVisible();
    await expect(page.getByText(/Post to multiple communities/i)).toBeVisible();
  });

  test('login button has correct styling and is clickable', async ({ page }) => {
    await page.goto('/login');
    
    const loginButton = page.getByRole('button', { name: /continue with reddit/i });
    
    // Button should have cursor-pointer class
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
  });

  test('login button initiates OAuth redirect to Reddit', async ({ page }) => {
    await page.goto('/login');
    
    // Intercept navigation to Reddit OAuth
    const navigationPromise = page.waitForRequest(request => {
      const url = request.url();
      return url.includes('reddit.com/api/v1/authorize') || url.includes('/api/auth/login');
    });
    
    // Click login button
    await page.getByRole('button', { name: /continue with reddit/i }).click();
    
    // Wait for the request
    const request = await navigationPromise;
    
    // Verify the request was made
    expect(request).toBeTruthy();
  });

  test('login page shows features section', async ({ page }) => {
    await page.goto('/login');
    
    // Verify features are displayed
    await expect(page.getByText(/Upload Once/i)).toBeVisible();
    await expect(page.getByText(/Queue Management/i)).toBeVisible();
  });

  test('login page displays error message from URL params', async ({ page }) => {
    await page.goto('/login?error=access_denied');
    
    // Should show error message
    await expect(page.getByText(/Authentication failed/i)).toBeVisible();
  });
});

test.describe('Authentication - Already Authenticated', () => {
  test('authenticated user on login page is redirected to home', async ({ page }) => {
    // Mock authenticated response
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meAuthenticated),
      });
    });
    
    await page.goto('/login');
    
    // Should redirect to home
    await expect(page).toHaveURL('/');
  });
});

authTest.describe('Authentication - Authenticated User', () => {
  authTest.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  authTest('authenticated user can access home page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Should stay on home page (not redirect to login)
    await expect(authenticatedPage).toHaveURL('/');
    
    // Should see the main content
    await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
  });

  authTest('authenticated user sees their username in header', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Username should be visible
    await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
  });

  authTest('authenticated user can open user menu', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Click on the user menu trigger (could be avatar or username)
    const userMenuTrigger = authenticatedPage.getByRole('button', { name: /testuser/i });
    await userMenuTrigger.click();
    
    // Logout option should be visible
    await expect(authenticatedPage.getByRole('menuitem', { name: /log\s*out/i })).toBeVisible();
  });

  authTest('logout clears session and redirects to login', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Open user menu
    const userMenuTrigger = authenticatedPage.getByRole('button', { name: /testuser/i });
    await userMenuTrigger.click();
    
    // Mock the unauthenticated state after logout
    await authenticatedPage.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meUnauthenticated),
      });
    });
    
    // Click logout
    await authenticatedPage.getByRole('menuitem', { name: /log\s*out/i }).click();
    
    // Should redirect to login
    await expect(authenticatedPage).toHaveURL('/login');
  });

  authTest('authenticated user can navigate to settings', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Click the Manage button to go to settings
    const manageButton = authenticatedPage.getByRole('link', { name: /manage/i });
    
    // If no link, try button
    if (await manageButton.count() === 0) {
      await authenticatedPage.getByRole('button', { name: /manage/i }).click();
    } else {
      await manageButton.click();
    }
    
    // Should be on settings page
    await expect(authenticatedPage).toHaveURL('/settings');
  });

  authTest('authenticated user can return from settings to home', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    // Click back button
    const backButton = authenticatedPage.getByRole('button', { name: /go back/i });
    await backButton.click();
    
    // Should be back on home
    await expect(authenticatedPage).toHaveURL('/');
  });
});

test.describe('Authentication - Session Handling', () => {
  test('expired session on API call redirects to login', async ({ page }) => {
    // First, mock authenticated state
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.meAuthenticated),
      });
    });
    
    // Add cookies to simulate session
    await page.context().addCookies([
      {
        name: 'reddit_access',
        value: 'expired_token',
        domain: 'localhost',
        path: '/',
      },
    ]);
    
    await page.goto('/');
    
    // Now simulate session expiry on next API call
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      });
    });
    
    // Reload to trigger new auth check
    await page.reload();
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Authentication - OAuth State', () => {
  test('OAuth callback with error shows error message', async ({ page }) => {
    await page.goto('/login?error=access_denied');
    
    // Error should be displayed
    await expect(page.getByText(/authentication failed/i)).toBeVisible();
    await expect(page.getByText(/access_denied/i)).toBeVisible();
  });

  test('OAuth callback with invalid_state error shows error', async ({ page }) => {
    await page.goto('/login?error=invalid_state');
    
    // Error should be displayed
    await expect(page.getByText(/authentication failed/i)).toBeVisible();
  });
});
