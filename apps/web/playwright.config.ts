import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3006', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: 'chrome' } },
  ],
  workers: 1,
  webServer: [
    { command: 'node scripts/supabase-test-server.mjs', url: 'http://127.0.0.1:54330/health', reuseExistingServer: false },
    { command: 'npm run build && npm run start -- --port 3006', env: { AI_EXTRACTION_ENABLED: 'true', OPENAI_API_KEY: 'test_provider_fixture_only', OPENAI_EXTRACTION_MODEL:'test-review-fixture', SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_fixture_only', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54330', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' }, url: 'http://127.0.0.1:3006', reuseExistingServer: false, timeout: 180000 },
  ],
});
