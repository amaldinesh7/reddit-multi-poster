import { test, expect } from '../fixtures/auth';
import { setupMockRoutes } from '../mocks/handlers';
import type { Locator } from '@playwright/test';

const pause = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const typeSlow = async (locator: Locator, text: string, delayMs: number = 35): Promise<void> => {
  await locator.click();
  await locator.fill('');
  await locator.type(text, { delay: delayMs });
};

test.describe('Settings management demo video capture', () => {
  test.use({
    viewport: { width: 834, height: 1194 },
  });

  test('records list and community management flow', async ({ authenticatedPage }) => {
    test.setTimeout(120_000);

    await setupMockRoutes(authenticatedPage);

    await authenticatedPage.goto('/demo/cards?variant=hook');
    await pause(3000);

    await authenticatedPage.goto('/settings');
    await expect(authenticatedPage.getByRole('button', { name: /new list/i })).toBeVisible();
    await pause(700);

    await authenticatedPage.getByRole('button', { name: /new list/i }).click();
    await pause(700);

    const editCategoryInput = authenticatedPage.getByLabel(/edit category name/i);
    await expect(editCategoryInput).toBeVisible();
    await editCategoryInput.blur();
    await pause(600);

    const searchInput = authenticatedPage.getByPlaceholder(/search and add communities/i);
    await typeSlow(searchInput, 'programming', 35);
    await pause(800);

    await expect(authenticatedPage.getByText('Communities found')).toBeVisible();
    await pause(600);

    await authenticatedPage
      .getByLabel('Add r/learnprogramming to list')
      .selectOption({ label: 'Entertainment' });
    await pause(700);

    await authenticatedPage
      .getByLabel('Add r/programminghumor to list')
      .selectOption({ label: 'Entertainment' });
    await pause(700);

    await expect(
      authenticatedPage.getByRole('button', { name: 'Entertainment category, 2 subreddits', exact: true })
    ).toBeVisible();
    await expect(authenticatedPage.getByText('r/learnprogramming').first()).toBeVisible();
    await expect(authenticatedPage.getByText('r/programminghumor').first()).toBeVisible();
    await pause(2200);

    await authenticatedPage.goto('/demo/cards?variant=cta');
    await pause(6000);
  });
});
