import { join } from 'node:path';

/**
 * Records the journey videos (docs/videos/journeys). Separate from e2e/playwright.config.ts so
 * acceptance runs keep their own pacing, retries and video policy. Run it through
 * Record-JourneyVideos.ps1, which synthesizes the narration first and muxes it in afterwards.
 * A plain object rather than defineConfig: this folder has no node_modules of its own.
 */
const port = Number(process.env['DEMO_PORT'] ?? 4310);
const runDir = process.env['DEMO_RUN_DIR'] ?? join(__dirname, '.run');
// DEMO_JOURNEYS limits the run to some journeys, e.g. "sign-up,verify-email".
const journeys = process.env['DEMO_JOURNEYS']?.split(',').filter(Boolean);
// DEMO_NO_CAPTIONS=1 (Record-JourneyVideos.ps1 -NoCaptions) reaches presenter.ts through the workers' environment.

export default {
  testDir: './journeys',
  testMatch: journeys?.length ? journeys.map((slug) => `${slug}.story.ts`) : '*.story.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 8 * 60_000,
  expect: { timeout: 20_000 },
  outputDir: join(runDir, 'playwright'),
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    colorScheme: 'light',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    // A dedicated port, never an already running server whose data and settings are unknown.
    command: `npm --prefix ${join(__dirname, '..', '..', 'frontend')} start -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
};
