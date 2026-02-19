import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  webServer: {
    ...baseConfig.webServer,
    command: 'rm -rf .next/cache/webpack && PORT=3100 npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
  },
  use: {
    ...baseConfig.use,
    baseURL: 'http://localhost:3100',
    video: 'on',
    trace: 'off',
    screenshot: 'off',
  },
});
