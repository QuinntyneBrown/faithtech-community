import { expect, test } from '../../fixtures/app';
import { MarketingPage } from '../../pages/marketing.page';
import { BREAKPOINTS, hasHorizontalScroll, undersizedTargets } from '../../pages/viewport';

// Traces to: L2-074 (docs/detailed-designs/marketing/landing-page).
test.describe('Marketing page', () => {
  test('an anonymous visitor sees the marketing page', async ({ page, axe }) => {
    const marketing = new MarketingPage(page);

    await marketing.open();

    await expect(marketing.heading).toBeVisible();
    await expect(marketing.eyebrow).toBeVisible();
    await expect(marketing.lead).toBeVisible();
    await expect(marketing.topBarJoin).toBeVisible();
    await expect(marketing.topBarSignIn).toBeVisible();
    await expect(marketing.benefitsHeading).toBeVisible();
    await expect(marketing.benefits).toHaveText([
      'Find your city team',
      'Show up together',
      'Build what matters',
    ]);
    await expect(marketing.callToActionJoin).toBeVisible();
    await expect(marketing.footer).toContainText('© 2026 FaithTech');
    await axe.check();
  });

  for (const [name, viewport] of Object.entries(BREAKPOINTS)) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`fits without sideways scroll at ${name} in ${colorScheme}`, async ({ page, axe }) => {
        const marketing = new MarketingPage(page);
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        await marketing.open();

        await expect(marketing.heading).toBeVisible();
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await undersizedTargets(page)).toEqual([]);
        await axe.check();
      });
    }
  }
});
