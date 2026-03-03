import { test, expect } from '../fixtures/auth';
import { setupMockRoutes } from '../mocks/handlers';
import { setupQueueContractMock } from '../flows/helpers';

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const demoSubreddits = ['pics', 'images'];

test.describe('Full product demo', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('records the complete post creation flow', async ({ authenticatedPage }) => {
    test.setTimeout(120_000);
    await setupMockRoutes(authenticatedPage);

    // 1 - Land on dashboard
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.getByText('Communities')).toBeVisible();
    await pause(2000);

    // 2 - Expand General category to reveal subreddits
    await authenticatedPage
      .getByRole('button', { name: /General category/i })
      .click();
    await expect(authenticatedPage.getByText('pics')).toBeVisible({ timeout: 5000 });
    await pause(1000);

    // 3 - Select subreddits
    for (const sub of demoSubreddits) {
      await authenticatedPage
        .getByRole('button', { name: new RegExp(`Toggle r/${sub}`, 'i') })
        .click();
      await pause(700);
    }

    // 4 - Switch to URL mode and fill the post form
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await pause(500);

    const urlInput = authenticatedPage.getByPlaceholder(
      /paste image or (video|link)/i,
    );
    await urlInput.click();
    await urlInput.type('https://example.com/my-awesome-project', { delay: 30 });
    await pause(800);

    const titleInput = authenticatedPage.getByPlaceholder(/(write a title|post title)/i);
    await titleInput.click();
    await titleInput.type('Launch once, reach every subreddit', { delay: 40 });
    await pause(1200);

    // 5 - Set up queue mock so posting succeeds
    await setupQueueContractMock(authenticatedPage, demoSubreddits, [
      'success',
      'success',
    ]);

    // 6 - Review & post
    const reviewBtn = authenticatedPage.getByRole('button', {
      name: /review.*post/i,
    });
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();
    await pause(1500);

    // 7 - Confirm post
    const postNowBtn = authenticatedPage.getByRole('button', {
      name: /post now/i,
    });
    await expect(postNowBtn).toBeVisible({ timeout: 5000 });
    await postNowBtn.click();

    // 8 - Wait for success state
    await expect(authenticatedPage.getByText('All done!')).toBeVisible({
      timeout: 15000,
    });
    await expect(authenticatedPage.getByText('2/2')).toBeVisible();
    await pause(3000);
  });
});
