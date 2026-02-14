import { test, expect } from '../fixtures/auth';
import { setupMockRoutes } from '../mocks/handlers';

const pause = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

test.describe('Product Hunt demo video capture', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
  });

  test('records a safe, simulated end-to-end flow', async ({ authenticatedPage }) => {
    test.setTimeout(120_000);

    if (
      process.env.NEXT_PUBLIC_QUEUE_DEMO_MODE !== 'true' &&
      process.env.NEXT_PUBLIC_QUEUE_DEMO_MODE !== '1'
    ) {
      throw new Error('Set NEXT_PUBLIC_QUEUE_DEMO_MODE=1 when running this demo capture test.');
    }

    await setupMockRoutes(authenticatedPage);

    // Title cards (edit-free intro/outro baked into the capture)
    await authenticatedPage.goto('/demo/cards?variant=hook');
    await pause(3000);

    await authenticatedPage.goto('/demo/cards?variant=problem');
    await pause(6000);

    // Live product flow (all API calls mocked except the demo queue stream)
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.getByText('Media')).toBeVisible();
    await pause(1200);

    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await pause(1100);

    const urlInput = authenticatedPage.getByPlaceholder(/paste image or video/i);
    await urlInput.click();
    await urlInput.type('https://example.com/image.jpg', { delay: 35 });
    await pause(1100);

    const titleInput = authenticatedPage.getByPlaceholder(/post title/i);
    await titleInput.click();
    await titleInput.type('Launch once, reach everywhere', { delay: 35 });
    await pause(1100);

    await authenticatedPage.getByRole('button', { name: /general category/i }).click();
    await pause(800);

    await expect(authenticatedPage.getByRole('button', { name: /toggle r\/pics/i })).toBeVisible({ timeout: 10_000 });
    await authenticatedPage.getByRole('button', { name: /toggle r\/pics/i }).click();
    await pause(900);
    await authenticatedPage.getByRole('button', { name: /toggle r\/images/i }).click();
    await pause(900);
    await authenticatedPage.getByRole('button', { name: /toggle r\/gifs/i }).click();
    await pause(1200);

    await authenticatedPage.getByRole('button', { name: /more actions/i }).click();
    await pause(500);
    await authenticatedPage.getByRole('menuitem', { name: /post now/i }).click();
    await pause(1500);

    await expect(authenticatedPage.getByText(/all done/i)).toBeVisible({ timeout: 60_000 });
    await pause(4000);

    await authenticatedPage.goto('/demo/cards?variant=cta');
    await pause(10_000);
  });
});
