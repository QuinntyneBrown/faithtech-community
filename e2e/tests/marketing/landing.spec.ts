import { expect, test } from '../../fixtures/app';
import { MarketingPage } from '../../pages/marketing.page';

// Traces to: L2-055 (docs/detailed-designs/marketing/landing-page).
test.describe('Marketing page', () => {
  test('an anonymous visitor sees the marketing page', async ({ page, axe }) => {
    const marketing = new MarketingPage(page);

    await marketing.open();

    await expect(marketing.heading).toBeVisible();
    await axe.check();
  });
});
