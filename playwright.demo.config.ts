import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  // Use a dedicated port so demo capture doesn't accidentally reuse a
  // locally-running dev server with different env (which breaks demo mode).
  webServer: {
    ...baseConfig.webServer,
    command: 'PORT=3100 npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
  },
  use: {
    ...baseConfig.use,
    baseURL: 'http://localhost:3100',
    // Always record video for demo capture.
    video: 'on',
    // Keep artifacts minimal for demo runs.
    trace: 'off',
    screenshot: 'off',
  },
});
