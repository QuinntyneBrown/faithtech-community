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
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

/**
 * Waits until the screen is at rest before axe reads it, so axe judges what a person sees:
 * - a dialog or toast fading in reads as low contrast, so short running animations are awaited.
 *   Endless ones (a busy pulse) never finish, and long ones such as a toast's 6-second timer bar,
 *   which also pauses while hovered or focused, would outlive the toast, so neither is awaited;
 * - content partly under the sticky top bar reads as a too-small target (a breadcrumb link
 *   after the page scrolled to Save or to an error summary), so once any smooth scroll has
 *   stopped, the page is read from the top, where the top bar covers nothing. Focus is kept.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const entering = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return (
        animation.playState === 'running' &&
        timing?.iterations !== Infinity &&
        Number(timing?.endTime ?? 0) <= 1000
      );
    });
    await Promise.all(entering.map((animation) => animation.finished.catch(() => undefined)));

    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let last = '';
    for (let still = 0; still < 3;) {
      await frame();
      const position = `${window.scrollX},${window.scrollY}`;
      still = position === last ? still + 1 : 0;
      last = position;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await frame();
  });
}

export { expect };
