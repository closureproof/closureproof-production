import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3005', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: 'chrome' } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3005', reuseExistingServer: true },
});
