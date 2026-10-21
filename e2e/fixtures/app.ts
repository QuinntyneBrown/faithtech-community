import AxeBuilder from '@axe-core/playwright';
import { Page, expect, test as base } from '@playwright/test';

import { MockApi } from './mock-api';

export interface Axe {
  /** Fails the test on any WCAG 2.2 A or AA violation on the current screen. */
  check(): Promise<void>;
}

export const test = base.extend<{ api: MockApi; axe: Axe }>({
  // Automatic: every test runs against the fake backend, so no request can reach a real server.
  api: [
    async ({ page }, use) => {
      const api = new MockApi(page);
      await api.install();
      await use(api);
      expect(api.unrecognised, 'requests the fake backend does not implement').toEqual([]);
    },
    { auto: true },
  ],
  axe: async ({ page }, use) => {
    await use({ check: () => checkAccessibility(page) });
  },
});

async function checkAccessibility(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

export { expect };
