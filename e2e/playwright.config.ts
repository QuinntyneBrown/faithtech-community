import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const marketingURL = process.env['E2E_MARKETING_URL'] ?? 'http://localhost:4300';

/** Chromium only (AGENTS.md). The API is mocked per test by fixtures/app.ts. */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Only the two Angular apps: the community app and the marketing page (ADR 0017). Never the API.
  webServer: [
    {
      command: 'npm --prefix ../frontend start -- --port 4200',
      url: baseURL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: 'npm --prefix ../frontend run start:marketing -- --port 4300',
      url: marketingURL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
