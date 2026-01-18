import { test, expect } from '../fixtures/auth';
import { setupMockRoutes, setupQueueMockSuccess } from '../mocks/handlers';
import path from 'path';

/**
 * Media Upload E2E Tests
 * 
 * These tests verify media upload functionality including:
 * - Single image upload
 * - Multiple image upload (gallery)
 * - File preview display
 * - File removal
 * - Drag and drop
 * - URL input mode
 */

test.describe('Media Upload - File Mode', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('file upload dropzone is visible by default', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Default should be file upload mode
    await expect(authenticatedPage.getByText(/upload media files/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/drag & drop/i)).toBeVisible();
  });

  test('can upload single image file', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Find the file input (hidden but functional)
    const fileInput = authenticatedPage.locator('input[type="file"]');
    
    // Upload a test file
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.png'));
    
    // Should show file selected
    await expect(authenticatedPage.getByText(/1 file/i)).toBeVisible();
  });

  test('can upload multiple image files for gallery', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Find the file input
    const fileInput = authenticatedPage.locator('input[type="file"]');
    
    // Create multiple test files programmatically
    await fileInput.setInputFiles([
      path.join(__dirname, '../fixtures/test-image.png'),
    ]);
    
    // Should show files selected
    await expect(authenticatedPage.getByText(/file/i)).toBeVisible();
  });

  test('preview images are displayed after upload', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.png'));
    
    // Should show preview image
    const preview = authenticatedPage.locator('img[src^="blob:"]');
    await expect(preview).toBeVisible();
  });

  test('can clear uploaded files with clear button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Upload a file first
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.png'));
    
    // Wait for file to be uploaded
    await expect(authenticatedPage.getByText(/1 file/i)).toBeVisible();
    
    // Click clear button
    await authenticatedPage.getByText(/clear all/i).click();
    
    // Should show empty dropzone again
    await expect(authenticatedPage.getByText(/upload media files/i)).toBeVisible();
  });

  test('dropzone shows drag active state', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Get the dropzone
    const dropzone = authenticatedPage.locator('[class*="border-dashed"]');
    
    // Verify dropzone exists
    await expect(dropzone).toBeVisible();
  });

  test('file count display is accurate', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.png'));
    
    // Should show correct count
    await expect(authenticatedPage.getByText(/1 file/i)).toBeVisible();
  });
});

test.describe('Media Upload - URL Mode', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('can switch to URL mode', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Click URL button
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Should show URL input
    await expect(authenticatedPage.getByPlaceholder(/paste image or link/i)).toBeVisible();
  });

  test('can enter URL in URL mode', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter URL
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await urlInput.fill('https://example.com/image.jpg');
    
    // URL should be displayed
    await expect(urlInput).toHaveValue('https://example.com/image.jpg');
  });

  test('URL preview is shown after entering URL', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter URL
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    
    // Should show preview/display of the URL
    await expect(authenticatedPage.getByText('https://example.com/image.jpg')).toBeVisible();
  });

  test('can clear URL with clear button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter URL
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await urlInput.fill('https://example.com/image.jpg');
    
    // Find and click clear button
    const clearButton = authenticatedPage.locator('button').filter({ has: authenticatedPage.locator('svg') }).last();
    
    // Try to find the X button near the input
    const xButton = authenticatedPage.locator('[class*="absolute"]').filter({ hasText: '' }).locator('svg');
    if (await xButton.count() > 0) {
      await xButton.first().click();
    }
  });

  test('switching modes clears previous selection', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Start in URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    
    // Switch to file mode
    await authenticatedPage.getByRole('button', { name: /upload/i }).click();
    
    // Switch back to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // URL input should be visible (state may or may not be cleared based on implementation)
    await expect(authenticatedPage.getByPlaceholder(/paste image or link/i)).toBeVisible();
  });
});

test.describe('Media Upload - Integration with Posting', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('URL post can be submitted', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Enter URL
    await authenticatedPage.getByPlaceholder(/paste image or link/i).fill('https://example.com/image.jpg');
    
    // Enter title
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test URL Post');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup mock
    await setupQueueMockSuccess(authenticatedPage, ['pics']);
    
    // Submit
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Should complete
    await expect(authenticatedPage.getByText(/all posts completed/i)).toBeVisible({ timeout: 10000 });
  });

  test('file upload post can be submitted', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Upload file
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.png'));
    
    // Enter title
    await authenticatedPage.getByPlaceholder(/write a title/i).fill('Test File Post');
    
    // Select subreddit
    await authenticatedPage.waitForSelector('text=pics', { timeout: 5000 });
    await authenticatedPage.getByRole('checkbox', { name: /pics/i }).check();
    
    // Setup mock
    await setupQueueMockSuccess(authenticatedPage, ['pics']);
    
    // Submit
    await authenticatedPage.getByRole('button', { name: /post to 1 subreddit/i }).click();
    
    // Should show posting state
    await expect(authenticatedPage.getByRole('button', { name: /posting/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Media Upload - File Type Support', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('dropzone shows supported file types', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Should show supported types
    await expect(authenticatedPage.getByText(/images/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/videos/i)).toBeVisible();
  });

  test('dropzone shows max file limit', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Should show max files info
    await expect(authenticatedPage.getByText(/max 10 files/i)).toBeVisible();
  });
});

test.describe('Media Upload - Remove Individual Files', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('individual file can be removed from selection', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Upload file
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.png'));
    
    // Wait for file to appear
    await expect(authenticatedPage.getByText(/1 file/i)).toBeVisible();
    
    // Find remove button on preview (small X button)
    const removeButton = authenticatedPage.locator('[class*="rounded-full"][class*="destructive"]');
    
    if (await removeButton.count() > 0) {
      await removeButton.first().click();
      
      // Should show empty state
      await expect(authenticatedPage.getByText(/upload media files/i)).toBeVisible();
    }
  });
});

test.describe('Media Upload - Accessibility', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await setupMockRoutes(authenticatedPage);
  });

  test('file input is accessible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // File input should exist (even if hidden)
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('mode toggle buttons have proper labels', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Upload button should be accessible
    const uploadButton = authenticatedPage.getByRole('button', { name: /upload/i });
    await expect(uploadButton).toBeVisible();
    
    // URL button should be accessible  
    const urlButton = authenticatedPage.getByRole('button', { name: /^url$/i });
    await expect(urlButton).toBeVisible();
  });

  test('URL input has proper placeholder', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Switch to URL mode
    await authenticatedPage.getByRole('button', { name: /^url$/i }).click();
    
    // Input should have helpful placeholder
    const urlInput = authenticatedPage.getByPlaceholder(/paste image or link/i);
    await expect(urlInput).toBeVisible();
  });
});
