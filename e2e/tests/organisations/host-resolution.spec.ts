import { expect, test } from '../../fixtures/app';
import { MARKETING_URL } from '../../pages/marketing.page';
import { SystemPages } from '../../pages/system-pages.page';
import { BREAKPOINTS, hasHorizontalScroll } from '../../pages/viewport';

// Traces to: L2-131 AC2, AC3, L2-048 (docs/detailed-designs/organisations/tenancy-and-host-resolution).
// The pages are the server's; the fake (fixtures/mock-host.ts) serves the same unknown-host.html and suspended.html.
test.describe('Unknown host', () => {
  test.beforeEach(async ({ api }) => {
    await api.host.unknown();
  });

  for (const url of ['/', '/events', '/sign-in', `${MARKETING_URL}/`]) {
    test(`a visitor at ${url} sees only the neutral 404 page`, async ({ page, axe }) => {
      const pages = new SystemPages(page);

      const status = await pages.open(url);

      expect(status).toBe(404);
      await expect(pages.unknownHost).toBeVisible();
      await expect(pages.unknownHostLead).toBeVisible();
      await expect(pages.images).toHaveCount(0);
      await expect(pages.controls).toHaveCount(0);
      expect(await pages.everything()).not.toMatch(/faithtech|community|<script/i);
      await axe.check();
    });
  }

  for (const [name, viewport] of Object.entries(BREAKPOINTS)) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`the page fits at ${name} in ${colorScheme}`, async ({ page, axe }) => {
        const pages = new SystemPages(page);
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        await pages.open('/');

        await expect(pages.unknownHost).toBeVisible();
        expect(await hasHorizontalScroll(page)).toBe(false);
        await axe.check();
      });
    }
  }
});

test.describe('Suspended organisation', () => {
  test.beforeEach(async ({ api }) => {
    await api.host.suspended();
  });

  for (const url of ['/', '/people', '/sign-in']) {
    test(`a member at ${url} sees only the neutral 503 page`, async ({ page, axe }) => {
      const pages = new SystemPages(page);

      const status = await pages.open(url);

      expect(status).toBe(503);
      await expect(pages.suspended).toBeVisible();
      await expect(pages.suspendedLead).toBeVisible();
      await expect(pages.controls).toHaveCount(0);
      expect(await pages.everything()).not.toMatch(/faithtech|community|<script/i);
      await axe.check();
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the page fits on a phone in ${colorScheme}`, async ({ page, axe }) => {
      const pages = new SystemPages(page);
      await page.setViewportSize(BREAKPOINTS.xs);
      await page.emulateMedia({ colorScheme });

      await pages.open('/');

      await expect(pages.suspended).toBeVisible();
      expect(await hasHorizontalScroll(page)).toBe(false);
      await axe.check();
    });
  }
});
