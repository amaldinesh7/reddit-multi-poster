import { test, expect } from '../fixtures/auth';
import { setupMockRoutes } from '../mocks/handlers';

const pause = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

test.describe('Simple demo capture', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
  });

  test('records a deterministic walkthrough', async ({ authenticatedPage }) => {
    test.setTimeout(90_000);
    await setupMockRoutes(authenticatedPage);

    await authenticatedPage.goto('/');
    await expect(authenticatedPage.getByText('Media')).toBeVisible();
    await pause(1200);

    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await pause(700);

    const urlInput = authenticatedPage.getByPlaceholder(/paste image or video/i);
    await urlInput.click();
    await urlInput.type('https://example.com/image.jpg', { delay: 30 });
    await pause(900);

    const titleInput = authenticatedPage.getByPlaceholder(/post title/i);
    await titleInput.click();
    await titleInput.type('Launch once, reach everywhere', { delay: 30 });
    await pause(900);

    await authenticatedPage.getByRole('button', { name: /general category/i }).click();
    await pause(700);

    await authenticatedPage.getByRole('button', { name: /toggle r\/pics/i }).click();
    await pause(700);
    await authenticatedPage.getByRole('button', { name: /toggle r\/images/i }).click();
    await pause(900);

    const reviewButton = authenticatedPage.getByRole('button', { name: /review & post/i });
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();
    await pause(5000);
  });
});
