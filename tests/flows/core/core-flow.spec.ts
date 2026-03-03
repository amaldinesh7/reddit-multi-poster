import { test, expect } from '../../fixtures/auth';
import {
  fillCoreLinkPostForm,
  selectSubreddits,
  setupFlowPage,
  setupQueueContractMock,
} from '../helpers';

const coreSubreddits = ['pics', 'images', 'gifs'];

test.describe('@flow-core Core Posting Flow', () => {
  test('core_post_to_three_subreddits_success @flow-core', async ({ authenticatedPage }) => {
    await setupFlowPage(authenticatedPage);
    await fillCoreLinkPostForm(authenticatedPage);
    await selectSubreddits(authenticatedPage, coreSubreddits);

    const queueMock = await setupQueueContractMock(authenticatedPage, coreSubreddits, [
      'success',
      'success',
      'success',
    ]);

    await authenticatedPage.getByRole('button', { name: /review.*post/i }).click();
    // Wait for the review drawer to open (it renders as a dialog)
    await expect(authenticatedPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    const postNowButton = authenticatedPage.getByRole('button', { name: /post to \d+ communit/i });
    await expect(postNowButton).toBeVisible({ timeout: 5000 });
    await postNowButton.click();

    // Wait for all posts to complete - look for the "View post" links
    for (const subreddit of coreSubreddits) {
      await expect(
        authenticatedPage.getByRole('link', { name: new RegExp(`View post on r/${subreddit}`, 'i') })
      ).toBeVisible({ timeout: 15000 });
    }

    const payload = queueMock.getPayload();
    expect(payload).not.toBeNull();
    expect(payload?.caption).toBeTruthy();
    expect(payload?.items).toHaveLength(3);

    for (const item of payload?.items || []) {
      expect(item).toEqual(
        expect.objectContaining({
          subreddit: expect.any(String),
          kind: 'link',
          url: expect.stringMatching(/^https?:\/\//),
        })
      );
    }
  });

  test('core_post_partial_failure_one_subreddit @flow-core', async ({ authenticatedPage }) => {
    await setupFlowPage(authenticatedPage);
    await fillCoreLinkPostForm(authenticatedPage, 'Partial Result Test');
    await selectSubreddits(authenticatedPage, coreSubreddits);

    await setupQueueContractMock(authenticatedPage, coreSubreddits, ['success', 'error', 'success']);

    await authenticatedPage.getByRole('button', { name: /review.*post/i }).click();
    // Wait for the review drawer to open (it renders as a dialog)
    await expect(authenticatedPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    const postNowButton = authenticatedPage.getByRole('button', { name: /post to \d+ communit/i });
    await expect(postNowButton).toBeVisible({ timeout: 5000 });
    await postNowButton.click();

    // Wait for partial results - 2/3 successful
    await expect(authenticatedPage.getByText('2/3')).toBeVisible({ timeout: 15000 });
  });
});
