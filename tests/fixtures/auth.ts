import { test as base, Page } from '@playwright/test';

/**
 * Extended test fixtures for authenticated user scenarios.
 * 
 * This bypasses real Reddit OAuth by injecting mock cookies that
 * simulate an authenticated session. This approach is:
 * - ToS compliant (no automated Reddit logins)
 * - Fast (no OAuth redirects)
 * - Deterministic (no external dependencies)
 */

export interface AuthFixtures {
  /** Page with authenticated session cookies injected */
  authenticatedPage: Page;
}

/**
 * Extended Playwright test with authentication fixtures.
 * Use this for tests that require an authenticated user.
 * 
 * @example
 * ```typescript
 * import { test, expect } from '../fixtures/auth';
 * 
 * test('authenticated user can see dashboard', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/');
 *   await expect(authenticatedPage.getByText('TestUser')).toBeVisible();
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Inject mock cookies that mimic an authenticated Reddit session
    await page.context().addCookies([
      {
        name: 'reddit_access',
        value: process.env.TEST_REDDIT_ACCESS_TOKEN || 'mock_access_token_for_testing',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'reddit_refresh',
        value: process.env.TEST_REDDIT_REFRESH_TOKEN || 'mock_refresh_token_for_testing',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'supabase_user_id',
        value: process.env.TEST_SUPABASE_USER_ID || 'test-user-uuid-12345',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    
    await use(page);
  },
});

export { expect } from '@playwright/test';
