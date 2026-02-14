import { test, expect } from '../../fixtures/auth';
import { testData } from '../../fixtures/test-data';
import {
  fillCoreLinkPostForm,
  selectSubreddits,
  setupFlowPage,
  setupQueueContractMock,
} from '../helpers';
import {
  setupQueueMockRateLimited,
  setupQueueMockUnauthorized,
} from '../../mocks/handlers';

test.describe('@flow-edge Critical Edge Flows', () => {
  test('edge_auth_expired_on_submit @flow-edge', async ({ authenticatedPage }) => {
    await setupFlowPage(authenticatedPage);
    await fillCoreLinkPostForm(authenticatedPage);
    await selectSubreddits(authenticatedPage, ['pics']);

    await setupQueueMockUnauthorized(authenticatedPage);

    await authenticatedPage.getByRole('button', { name: /review.*post/i }).click();
    // Wait for the review drawer to open
    const postNowButton = authenticatedPage.getByRole('button', { name: /post now/i });
    await expect(postNowButton).toBeVisible({ timeout: 5000 });
    await postNowButton.click();

    await expect(
      authenticatedPage.getByText("You're signed out. Sign in again to continue.")
    ).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByRole('button', { name: /sign in again/i })).toBeVisible();
  });

  test('edge_flair_required_block_or_recover @flow-edge', async ({ authenticatedPage }) => {
    await setupFlowPage(authenticatedPage);

    await authenticatedPage.route('**/api/cache/subreddit/pics', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testData.subreddits.withRequiredFlair),
      });
    });

    await fillCoreLinkPostForm(authenticatedPage, 'Flair Required Test');
    await selectSubreddits(authenticatedPage, ['pics']);

    await authenticatedPage.getByRole('button', { name: /review.*post/i }).click();
    // Wait for the review drawer to open
    const postNowButton = authenticatedPage.getByRole('button', { name: /post now/i });
    await expect(postNowButton).toBeVisible({ timeout: 5000 });
    await postNowButton.click();

    await expect(authenticatedPage.getByText(/r\/pics requires a flair/i)).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByText(/fix the errors above to enable posting/i)).toBeVisible();
  });

  test('edge_rate_limited_single_target @flow-edge', async ({ authenticatedPage }) => {
    await setupFlowPage(authenticatedPage);
    await fillCoreLinkPostForm(authenticatedPage, 'Rate Limited Test');
    await selectSubreddits(authenticatedPage, ['pics']);

    await setupQueueMockRateLimited(authenticatedPage);

    await authenticatedPage.getByRole('button', { name: /review.*post/i }).click();
    // Wait for the review drawer to open
    const postNowButton = authenticatedPage.getByRole('button', { name: /post now/i });
    await expect(postNowButton).toBeVisible({ timeout: 5000 });
    await postNowButton.click();

    await expect(authenticatedPage.getByText(/something went wrong. try again in a moment./i)).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByRole('button', { name: /try again/i })).toBeVisible();
  });

  test('edge_invalid_media_pre_submit @flow-edge', async ({ authenticatedPage }) => {
    await setupFlowPage(authenticatedPage);
    await fillCoreLinkPostForm(authenticatedPage, 'Invalid URL Test', 'not-a-url');
    await selectSubreddits(authenticatedPage, ['pics']);

    const queueMock = await setupQueueContractMock(authenticatedPage, ['pics'], ['success']);

    await authenticatedPage.getByRole('button', { name: /review.*post/i }).click();
    // Wait for the review drawer to open
    const postNowButton = authenticatedPage.getByRole('button', { name: /post now/i });
    await expect(postNowButton).toBeVisible({ timeout: 5000 });
    await postNowButton.click();

    await expect(authenticatedPage.getByText(/the url is not valid/i)).toBeVisible({ timeout: 10000 });
    expect(queueMock.getPayload()).toBeNull();
  });
});
